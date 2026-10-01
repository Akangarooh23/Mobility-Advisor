# Lo que hay que arreglar

Las **67 cosas abiertas** de `lo-que-cambiaria.md`, ordenadas para trabajar. El informe
explica el porqué de cada una; esto es la lista.

Al 1 de octubre de 2026: **149 hallazgos, 82 cerrados, 67 abiertos** — 2 🔴, 18 🟠,
31 🟡, 16 ⚪. Los números salen de contar los encabezados del informe:

```bash
grep '^### ' docs/lo-que-cambiaria.md | grep -oE '^### (✅|🔴|🟠|🟡|⚪)' | sort | uniq -c
```

**Siete de los 67 no son tareas**: §3.3, §18.3, §22.2, §29.4, §29.5, §31.3 y §34.2 son
notas de método o cosas comprobadas que no hay que tocar. Quedan **60 tareas**.

---

## 1 · Antes de lanzar

Lo que puede salir mal delante de un cliente.

| | Qué | Dónde | Cuánto |
|---|---|---|---|
| ⚠️ | ~~La tasación tarda 24 s; filtrar por marca vale 5×~~ — **medido bien, vale 1,23× y cambia la tasación. Revertido.** Los 20 s son leer de disco: es §9.1, y es decisión tuya | §35.2 | — |
| ✅ | ~~Con el tabulador no se puede abrir un coche del listado~~ — **hecho**: las tres tarjetas son `<a href="/marketplace-vo/<id>">`. Teclado, lector de pantalla, abrir en otra pestaña y enlaces para los buscadores | §33.1 | hecho |
| 🟡 | ~~Seis buscadores del ERP lanzan una petición por tecla~~ — **hecho**: 350 ms de retardo en `SearchInput`, un solo sitio para las seis. **Queda la mitad**: mientras `api.get` no sepa cancelar, dos respuestas pueden llegar al revés si el servidor va lento | §29.2 | 2 h |
| 🟠 | **Un coche sin precio se enseña a 0 €**, y ese 0 llega a la cuota y al depósito | §22.1 | 2 h |
| 🟠 | **87 ofertas de un proveedor que ya no existe**, servidas a los clientes | §7.2 | decisión + 1 h |
| 🟠 | **`register` dice si un correo tiene cuenta.** El freno está puesto; falta que el 409 no delate | §10.2 | 1 h |
| 🟠 | **Si Postgres falla, el garaje contesta lista vacía** en vez de decir que ha fallado. Las escrituras ya están; faltan las siete lecturas | §5.7 | 2 h |
| 🟡 | **Entre medianoche y las 02:00, «hoy» es ayer** | §23.1 | 1 h |
| 🟡 | **«Hoy» en UTC nueve veces en el ERP**, y una es la fecha de un contrato | §25.2 | 2 h |
| 🟡 | **SSRF por los resultados del buscador** | §4.3 | 2 h |
| 🟡 | **Los modelos de `BuscarCochePage`** se piden sin guardia, veinte líneas debajo de uno que sí la tiene | §29.3 | 20 min |
| 🟡 | **Un efecto del mapa de talleres no corre nunca**: el encuadre que mete todos los talleres dentro | §30.2 | 1 h |
| 🟡 | **Las 26 fugas del mensaje de error** que quedan. Seis son legítimas —el mensaje de Stripe, escrito para leer—. La lista vive en §31.2, que está cerrada porque van 36 de 62 | §3.2 | 2 h |
| 🟡 | **117 campos sin etiqueta** en Mobility y 325 en el ERP | §33.3 | 1 día |

## 2 · Rendimiento y factura

Todo esto toca Neon, así que el orden lo marcas tú.

| | Qué | Dónde |
|---|---|---|
| 🔴 | **El acierto de caché es del 36,8 %**, donde una base sana pasa del 99. Dos de cada tres lecturas van al almacenamiento | §9.1 |
| 🔴 | **La búsqueda ejecuta la misma consulta dos veces** con perfil estrecho: 253 segundos | §8.2 |
| 🟠 | **La consulta central del consejero tarda 8,6 s** y toca 520 MB | §8.1 |
| 🟠 | **294 GB escritos en ficheros temporales** — es el `work_mem` de 4 MB, el valor por defecto | §9.2 |
| 🟠 | **11 bloqueos mutuos** y un 3,8 % de transacciones deshechas | §9.3 |
| 🟠 | **523 MB de índices que casi nadie ha leído nunca** | §1.1 |
| 🟡 | **El refresco de las facetas cuesta 63 s y corre cada hora** | §9.4 |
| 🟡 | **126 MB y 490.033 filas** que nada de lo desplegado lee | §12.5 |
| 🟠 | **Hay dos vistas materializadas refrescadas cada hora** y ninguna cubre la pregunta cara del consejero: el arreglo está inventado y sin usar | §8.3 |
| 🟡 | **Planificar cuesta más que ejecutar** en las consultas pequeñas | §8.5 |

**Lo más barato de todo esto**: subir `work_mem` de 4 MB a 64 MB. Medido en la tasación,
vale 1,75×, y de 64 en adelante no compra nada.

**Y antes de decidir lo demás**: dejar `pg_stat_statements` unos días y volver a
`npm run consultas-lentas`. Qué índices tirar de los 523 MB se decide con medias de
miles de llamadas reales, no con mediciones a mano — las mías ya fallaron tres veces.

## 3 · Que no vuelva a pasar

Lo que hace que mañana sea más caro. Invisible hoy, caro en seis meses.

| | Qué | Dónde |
|---|---|---|
| ✅ | ~~El ERP no tiene CI, y su suite está en rojo~~ — **hecho**: tipos, 2.813 pruebas y build en cada empujón. Los ocho `comprueba-*.js` quedan fuera: leen el `.env` del repositorio y la base de verdad | §27.2 |
| ✅ | ~~Y la que está roja es justo el guardia~~ — **hecho**: no era regresión, PopCar añadió dos puertas al panel y el flujo no las traía | §27.3 |
| 🟠 | **280 sentencias de esquema dentro de las peticiones** del ERP, y ninguna migración | §19.1 |
| 🟠 | **`npm run test:lib` corre 934 de las 1.690 en Linux** | §11.2 |
| 🟠 | **Nadie lee los latidos de n8n**, que son la mitad de su diseño | §15.2 |
| 🟠 | **Dos frenos de ritmo, y el de memoria no funciona** en serverless | §3.4 |
| 🟡 | **El ERP no tiene ESLint** | §30.4 |
| 🟡 | **El CI prueba la autenticación contra un servidor que servía 31 de 49 rutas** — ya son 42 + el comodín, falta repasar qué más cubre | §12.3 |
| 🟡 | **Nada comprueba las cabeceras por su cuenta**: hay que lanzarlo a mano | §17.4 |
| 🟡 | **Tres funciones de dinero sin prueba directa** | §5.4 |
| 🟡 | **El trabajo de CI contra SQL Server no puede correr** | §11.4 |
| 🟡 | **Stripe no garantiza el orden de los eventos** | §3.6 |
| 🟡 | **Los códigos de recuperación viven en la tabla de sesiones** | §10.5 |
| 🟡 | **Cada petición autenticada escribe en la base** | §10.6 |
| 🟡 | **El número de factura se coge fuera de cualquier transacción** | §20.2 |
| 🟡 | **Tres flujos de n8n a las 07:00 exactas**, y uno sin avisador | §13.3 |
| 🟡 | **El aviso de las citas acierta en Vercel y falla en local** | §23.2 |
| 🟡 | **119 guiones leen `DATABASE_URL` sin distinguir entorno** | §7.3 |
| 🟡 | **El arreglo de fondo de `/api/analyze`**, que sí es un cambio | §4.2 |
| 🟡 | **La CSP en `Report-Only`**, que ya no tiene el obstáculo que decía tener | §17.3 |

## 4 · Limpieza

Nada de esto rompe nada. Son minutos cada uno y quitan ruido.

- ⚪ Dos tablas de respaldo del 22 de agosto, en producción (§1.3)
- ⚪ Cinco tablas que ningún código menciona (§1.4)
- ⚪ Siete scripts `tmp_*` en el repositorio (§11.6)
- ⚪ Once variables de entorno usadas y sin documentar (§11.7)
- ⚪ 340 líneas de SQL Server en el fichero más caliente (§12.6)
- ⚪ Un flujo de n8n vacío, creado el 21-sep y nunca terminado (§13.4)
- ⚪ Dos prototipos de portada que nadie abre (§14.2)
- ⚪ El servidor de los mockups sirve cualquier fichero del disco (§14.1)
- ⚪ Dos precios tipados como texto (§5.5) y dos que se pintan «0,00 €» (§25.3)
- ⚪ La gratuita se puede pedir dos veces a la vez (§5.6)
- ⚪ Las facetas se construyen con texto sin normalizar (§8.6)
- ⚪ Dos `SELECT *` que se esparcen en la respuesta del ERP (§31.3)
- ⚪ El ERP valida poco, pero detrás de `requireRole` (§32.5)
- 🟡 Cuatro funciones del garaje copiadas con seis comportamientos (§6.1)
- 🟡 `normalizeText` definida en 10 pantallas (§6.2)
- 🟡 2.725 objetos de estilo en línea (§6.3)

---

## Lo que no puedo hacer yo

**Decisiones tuyas**, porque tocan dinero, datos o la empresa:

1. 🔴 **`AUTH_EXPOSE_RESET_CODE` en Vercel**, verificada como falsa o ausente. En
   `.env.local` está en `true`, y con ese valor la API devuelve el código de
   recuperación de cualquier cuenta. **Treinta segundos, y es lo único de la lista que
   no puedo comprobar yo**: el código solo se genera para un correo que existe, así que
   probarlo mandaría un correo de verdad a una cuenta de verdad.
2. **`work_mem` a 64 MB** en Neon. Medido: 1,75× en la tasación.
3. **`WHATSAPP_APP_SECRET`** cuando exista la app de Meta. No urge: WhatsApp no ha
   recibido un mensaje nunca. Y la clave secreta **no necesita empresa verificada** —eso
   hace falta para mandar mensajes, no para leerla—.
4. **Los 87 `leasys-%`**: ¿se retiran o se quedan? (§7.2)
5. **Las siete lecturas** que devuelven lista vacía: ¿aviso de error o «no tienes nada»?
   Yo lo cambiaría. (§5.7)
6. **El consentimiento en el alta** y **si el ERP tiene su propia base**.
7. **HSTS preload** y **las facetas de cada hora a cada día**.

**Credenciales de prueba**, que es lo que bloquea el 75 % de la capa 5. Hoy `.env.local`
apunta a la base de producción y lleva una clave de Stripe **de producción**, así que
darse de alta crea un usuario real, reservar manda un correo real y un pago sería un
objeto real. Con una base de desarrollo y unas claves `sk_test_` se recorren el alta, el
pago y la reserva sin ensuciar nada.

**Levantar el ERP**: su `test:rutas` y cinco guiones más piden la API en el puerto 4000 y
dan `ECONNREFUSED`, así que hoy ni su propia puerta de pruebas se pasa entera.

---

## Por dónde empezaría

1. ~~Los 24 segundos de la tasación~~ — **hecho, medido y revertido** (§35.2). El filtro
   de marca vale 1,23×, no 5×, y cambia la mediana de la tasación. El cuello no está en
   el código: con un acierto de caché del 36,8 %, el 63 % de las lecturas vienen del
   almacenamiento. Pasa a ser §9.1, que es decisión tuya.
2. ~~Las tarjetas como enlaces~~ (§33.1) — **hecho.** Cuatro problemas con un cambio, y
   el barrido lo confirma: los controles sin teclado bajan de 20 a 17.
3. **Los seis buscadores del ERP** (§29.2). El patrón del arreglo ya está escrito en el
   propio repositorio: `MarketplacePage` retarda sus filtros de columna 350 ms cuatro
   veces, en el mismo fichero donde no retarda el buscador.
4. ~~El CI del ERP~~ (§27.2) — **hecho.** Tipos, 2.813 pruebas y construcción en cada
   empujón. Y su suite vuelve a estar verde: lo rojo era el guardia del panel, que PopCar
   había cambiado.
