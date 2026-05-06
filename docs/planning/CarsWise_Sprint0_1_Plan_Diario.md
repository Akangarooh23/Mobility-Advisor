# CarsWise - Plan Diario de Ejecucion (Sprint 0 y Sprint 1)

## Objetivo de este plan
Tener una guia diaria para ejecutar sin perder foco ni olvidarse de dependencias criticas.

Resultados esperados al final de Sprint 1:
- Funnel de activacion completamente medible.
- Pricing de Free y Plus claro.
- Premium separado como servicios bajo demanda.
- Base lista para entrar en Sprint 2 (onboarding y alertas) sin retrabajo.

## Alcance de estos sprints
- Sprint 0: instrumentacion y datos.
- Sprint 1: framing comercial, pricing y capa web de Premium.

## Principios de ejecucion
- Ningun ticket se cierra sin verificacion de tracking.
- Ningun cambio de copy se publica sin validar consistencia Free/Plus/Premium.
- Premium nunca aparece como tercer plan simetrico.
- Si una dependencia bloquea, se escala en el mismo dia.

## Cadencia diaria recomendada
- 09:30: Daily de 15 minutos (bloqueos, foco del dia, riesgo principal).
- 13:30: checkpoint tecnico (estado de dependencias y pruebas).
- 18:00: cierre del dia con evidencia (capturas, logs, links a PR/tickets).

## Definicion de done por tarea
- Funciona en entorno local y staging.
- Tiene evento asociado y visible en dashboard.
- Tiene criterio de aceptacion cumplido.
- Tiene evidencia de QA (manual o automatizada).

## Sprint 0 (5 dias) - Instrumentacion y visibilidad

### Dia 1 - Alineacion y contrato de datos
Objetivo del dia:
- Congelar definiciones de eventos y propiedades para evitar cambios en cascada.

Tareas:
- DATA: cerrar diccionario de eventos del funnel principal y Premium.
- PM/COPY: validar naming canonicamente (sin sinonimos ambiguos).
- BE: definir contrato de endpoint de tracking.
- QA: preparar checklist de validacion de eventos.

Tickets foco:
- CW-001
- P-CW-001
- P-CW-002

Entregables del dia:
- Documento de eventos version 1.0 aprobado.
- Lista de propiedades obligatorias por evento.
- Lista de propiedades opcionales por evento.

Riesgo a vigilar:
- Cambios de nomenclatura de ultima hora.

Criterio de salida del dia:
- Todo el equipo usa exactamente los mismos nombres de eventos.

### Dia 2 - Backend de tracking
Objetivo del dia:
- Tener endpoint de tracking robusto con idempotencia y logging.

Tareas:
- BE: implementar endpoint de tracking principal y Premium.
- BE: agregar control de duplicados por idempotency key.
- DATA: definir tabla o store de eventos con esquema minimo.
- QA: preparar casos de prueba de duplicacion y payload invalido.

Tickets foco:
- CW-002
- P-CW-003

Entregables del dia:
- Endpoint operativo en staging.
- Logs de entrada/salida y errores de validacion.

Riesgo a vigilar:
- Eventos repetidos por reintentos de frontend.

Criterio de salida del dia:
- Duplicados controlados y eventos persistidos correctamente.

### Dia 3 - Instrumentacion frontend del funnel
Objetivo del dia:
- Emitir eventos reales desde frontend para funnel Free/Plus.

Tareas:
- FE: emitir user_registered.
- FE: emitir idcar_created.
- FE: emitir alert_configured.
- FE+BE: emitir first_value_seen.
- FE+BE: emitir plus_conversion_triggered.
- QA: validar orden de emision y payload minimo.

Tickets foco:
- CW-003
- CW-004
- CW-005
- CW-006
- CW-007

Entregables del dia:
- Flujo end to end de eventos en staging.
- Registro de pruebas con casos felices y edge cases.

Riesgo a vigilar:
- Eventos faltantes cuando el usuario navega rapido o refresca.

Criterio de salida del dia:
- Todos los eventos del funnel aparecen en tiempo real en raw logs.

### Dia 4 - Dashboards operativos
Objetivo del dia:
- Tener visibilidad del embudo por paso y cohorte.

Tareas:
- DATA: dashboard funnel 5 pasos.
- DATA: dashboard por cohorte semanal (7d y 30d).
- DATA: panel preliminar de time to first value.
- QA+PM: verificar que las metricas responden a eventos reales.

Tickets foco:
- CW-008

Entregables del dia:
- Dashboard principal compartido con equipo.
- Dashboard de cohorte y conversion por paso.

Riesgo a vigilar:
- Mapeo incorrecto de eventos a pasos del funnel.

Criterio de salida del dia:
- Se puede identificar claramente la fuga por paso.

### Dia 5 - QA completo de instrumentacion y cierre Sprint 0
Objetivo del dia:
- Certificar que la capa de datos es confiable.

Tareas:
- QA: checklist completo de eventos.
- QA: pruebas de idempotencia y eventos duplicados.
- PM+DATA: validar que KPIs reflejan realidad del flujo.
- Todos: retro de 30 min con accionables para Sprint 1.

Tickets foco:
- CW-009

Entregables del dia:
- Informe QA de instrumentacion.
- Lista corta de incidencias y correcciones.
- Decesion Go de Sprint 1.

Riesgo a vigilar:
- Dashboard bonito pero con datos inconsistentes.

Criterio de salida del Sprint 0:
- Eventos visibles y consistentes por cohorte.
- Duplicados por debajo de objetivo.

## Sprint 1 (5 dias) - Pricing y Premium en web

### Dia 6 - Arquitectura de pricing y separacion Premium
Objetivo del dia:
- Diseñar estructura final de la pagina de pricing sin ambiguedad.

Tareas:
- FE: maquetar bloques separados (Planes vs Servicios bajo demanda).
- COPY: cerrar copy de encabezados y conectores entre bloques.
- PM: validar que Premium no compite visualmente con Plus.

Tickets foco:
- CW-010
- CW-011
- P-CW-004

Entregables del dia:
- Estructura web funcional en staging.
- Copy base aprobado.

Riesgo a vigilar:
- Volver a presentar Premium como tercera columna de planes.

Criterio de salida del dia:
- Separacion visual y semantica correcta en desktop y mobile.

### Dia 7 - Comparativa Free/Plus y tarjetas Premium
Objetivo del dia:
- Completar comparativa principal y tarjetas por servicio Premium.

Tareas:
- FE: limitar comparativa a Free/Plus.
- FE: construir grid de tarjetas Premium con CTA por servicio.
- COPY: revisar descripciones de una linea por servicio.
- QA: smoke test de visualizacion responsive.

Tickets foco:
- CW-012
- P-CW-005

Entregables del dia:
- Tabla Free/Plus final.
- Grid Premium de 2-3 columnas funcional.

Riesgo a vigilar:
- Inconsistencias entre precios y texto legal de compra.

Criterio de salida del dia:
- Cada servicio Premium tiene precio visible y CTA claro.

### Dia 8 - Tracking de pricing y Premium
Objetivo del dia:
- Medir interaccion real en pricing y tarjetas de servicios.

Tareas:
- FE+DATA: emitir eventos de pricing y premium_service_view/cta.
- DATA: panel de CTR por bloque y por tarjeta.
- QA: validar eventos por dispositivo y ruta.

Tickets foco:
- CW-014
- P-CW-006
- P-CW-014

Entregables del dia:
- Tracking activo por bloque y servicio.
- Dashboard de CTR listo para analisis.

Riesgo a vigilar:
- Eventos disparados varias veces por scroll o re-render.

Criterio de salida del dia:
- Se puede medir que servicios generan interes real.

### Dia 9 - Checkout y politicas Premium (base)
Objetivo del dia:
- Dejar listo el esqueleto de compra unica Premium.

Tareas:
- FE+BE: flujo checkout base de servicios.
- PM+LEGAL+BE: reglas de reembolso y cancelacion por servicio.
- BE: facturacion automatica al completar pago.
- QA: pruebas de compra exito/error/reintento.

Tickets foco:
- P-CW-007
- P-CW-008
- P-CW-009

Entregables del dia:
- Checkout Premium funcional en staging.
- Politica de reembolso visible y aplicada.

Riesgo a vigilar:
- Cobro sin trazabilidad o politica no alineada con UX.

Criterio de salida del dia:
- Compra premium completa con evidencia de factura y estado.

### Dia 10 - Validacion final Sprint 1 y release interno
Objetivo del dia:
- Cerrar Sprint 1 con evidencia de comprension y readiness.

Tareas:
- QA+PM: test rapido de comprension (5 usuarios).
- QA: checklist final de pricing y premium web.
- DATA: corte inicial de metricas de CTR.
- Todos: retro y plan de entrada a Sprint 2.

Tickets foco:
- CW-015
- P-CW-015

Entregables del dia:
- Informe de comprension de propuesta.
- Estado Go/No-Go para Sprint 2.
- Lista priorizada de ajustes post Sprint 1.

Riesgo a vigilar:
- Tomar decisiones sin muestra minima de comportamiento.

Criterio de salida del Sprint 1:
- Premium claramente separado de planes.
- Tracking completo de interacciones.
- Base de checkout y politicas lista para evolucionar.

## Checklist de no olvidos (obligatorio)
- Naming de eventos congelado y compartido.
- Dependencies mapeadas antes de empezar cada ticket.
- Criterios de aceptacion visibles en cada issue.
- Evidencia QA adjunta antes de cerrar tarea.
- Revision de coherencia de copy al final de cada dia.
- Dashboard revisado diariamente por PM y Data.

## Riesgos principales y mitigacion
- Riesgo: confusion Plus vs Premium.
  - Mitigacion: Premium siempre en bloque separado y sin lenguaje de plan.
- Riesgo: decisiones por intuicion en lugar de datos.
  - Mitigacion: revisar dashboard todos los dias y registrar decisiones.
- Riesgo: cerrar tickets sin trazabilidad.
  - Mitigacion: definicion de done obligatoria con tracking+QA.
- Riesgo: dependencias rotas entre FE y BE.
  - Mitigacion: checkpoint tecnico a mitad del dia.

## Evidencias que hay que guardar cada dia
- Captura de dashboard actualizado.
- Lista de tickets cerrados con link a prueba.
- Lista de bloqueos abiertos.
- Decisiones tomadas y por que.

## Siguiente paso al terminar Sprint 1
Entrar en Sprint 2 con foco en:
- Onboarding MVP de activacion.
- Motor de alertas Fase 1.
- Primer valor en 24h.
- Trigger conductual de conversion a Plus.
