$ErrorActionPreference = 'Stop'

$taskBase = 'MoveAdvisorInventorySqlServer'
$scriptPath = Join-Path $PSScriptRoot 'run-inventory-sqlserver.cmd'

if (-not (Test-Path $scriptPath)) {
  throw "No existe el runner esperado: $scriptPath"
}

$times = @(
  @{ Name = "$taskBase-Morning"; Time = '06:00' },
  @{ Name = "$taskBase-Afternoon"; Time = '14:00' },
  @{ Name = "$taskBase-Night"; Time = '22:00' }
)

foreach ($slot in $times) {
  $taskName = $slot.Name
  $startTime = $slot.Time

  $args = @(
    '/Create',
    '/SC', 'DAILY',
    '/TN', $taskName,
    '/TR', ('"' + $scriptPath + '"'),
    '/ST', $startTime,
    '/F'
  )

  & schtasks.exe @args | Out-Null
  Write-Host "Registrada tarea: $taskName @ $startTime"
}

Write-Host 'Tareas programadas correctamente (06:00, 14:00, 22:00).'
