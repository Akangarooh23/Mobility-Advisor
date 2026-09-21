# Deja el escaparate de importación publicándose solo.
#
#   powershell -ExecutionPolicy Bypass -File scripts\programa-publicacion.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\programa-publicacion.ps1 -Quitar
#
# ── Por qué una tarea de Windows y no un workflow de n8n ─────────────────────
#
# Porque n8n veta de fábrica el nodo que ejecuta programas. Está escrito en su
# propia configuración:
#
#     this.exclude = ['n8n-nodes-base.executeCommand', 'n8n-nodes-base.localFileTrigger'];
#
# Se puede levantar con NODES_EXCLUDE, pero eso se lo daría a TODOS los
# workflows, no solo a este. No compensa por una tarea que se lanza dos veces
# al día.
#
# ── Las horas ────────────────────────────────────────────────────────────────
#
#   13:40  el flujo de scoring calcula market_price_es a las 13:10 y tarda unos
#          15 minutos. Publicar antes es decidir con el precio español de ayer.
#   21:40  no recalcula mercado: está para que los coches que el verificador
#          haya dado por vendidos durante la tarde salgan el mismo día. En
#          septiembre hubo 454 publicados de 484 ya vendidos, y un cliente
#          podía pedir uno y pagar su fianza.
#
# ── Cómo se sabe que ha corrido ──────────────────────────────────────────────
#
# Una tarea programada que falla no dice nada. Por eso el script deja su parte
# en `moveadvisor_verify_runs` con portal='publicar', al lado de los de los
# verificadores: si un día no hay parte de hoy, es que la tarea no corrió.

param([switch]$Quitar)

$ErrorActionPreference = "Stop"
$NOMBRE = "PopCar - Publicar importacion"
$RAIZ = Split-Path -Parent $PSScriptRoot
$NODE = (Get-Command node -ErrorAction SilentlyContinue).Source

if ($Quitar) {
  if (Get-ScheduledTask -TaskName $NOMBRE -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $NOMBRE -Confirm:$false
    "  quitada la tarea: $NOMBRE"
  } else {
    "  no habia ninguna tarea: $NOMBRE"
  }
  exit 0
}

if (-not $NODE) { throw "no encuentro node en el PATH" }
$SCRIPT = Join-Path $RAIZ "scripts\recalcula-publicacion.cjs"
if (-not (Test-Path $SCRIPT)) { throw "no encuentro $SCRIPT" }

"  node   : $NODE"
"  script : $SCRIPT"
"  carpeta: $RAIZ"

# El directorio de trabajo importa: el script lee .env.local de donde corre.
$accion = New-ScheduledTaskAction -Execute $NODE `
  -Argument "scripts\recalcula-publicacion.cjs --aplica" -WorkingDirectory $RAIZ

$disparadores = @(
  (New-ScheduledTaskTrigger -Daily -At "13:40"),
  (New-ScheduledTaskTrigger -Daily -At "21:40")
)

# Sin despertar el equipo ni correr con el portátil a batería a medias: si la
# máquina está apagada, la pasada siguiente arregla lo que se perdió.
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable `
  -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1)

if (Get-ScheduledTask -TaskName $NOMBRE -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $NOMBRE -Confirm:$false
  "  (había una anterior, se reemplaza)"
}

Register-ScheduledTask -TaskName $NOMBRE -Action $accion -Trigger $disparadores `
  -Settings $ajustes -Description "Publica el escaparate de importacion con la regla de lib/coste-importacion.js" | Out-Null

""
"  registrada: $NOMBRE"
"  todos los dias a las 13:40 y a las 21:40"
""
"  para verla     : Get-ScheduledTask -TaskName '$NOMBRE'"
"  para lanzarla  : Start-ScheduledTask -TaskName '$NOMBRE'"
"  para quitarla  : ...\programa-publicacion.ps1 -Quitar"
