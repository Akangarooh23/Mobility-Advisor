# CarsWise - Plan Diario de Ejecucion (Sprint 2 y Sprint 3)

## Objetivo general
Ejecutar el nucleo del modelo:
- Onboarding MVP completo.
- Motor de alertas Fase 1.
- Primer valor en menos de 24h.
- Conversion a Plus por trigger conductual.
- Expansion Premium fase 2 con control operativo.

## Resultado esperado al final de Sprint 3
- Secuencia activa y medible: registro -> IDCar -> alerta -> first_value_seen -> upgrade.
- Alertas de ITV, seguro e impuestos funcionando por email + in-app.
- Dashboard de conversion y retencion temprana operativo.
- Premium fase 2 activado solo con dependencias cumplidas.

## Sprint 2 (Dias 11-15) - Onboarding, alertas y primer valor

### Dia 11 - UX y flujo de onboarding MVP
Objetivo del dia:
- Cerrar flujo final de onboarding en 4-5 pantallas y estados.

Tareas:
- FE: estructura final de pantallas de onboarding.
- PM/COPY: mensajes de activacion y microcopy de friccion.
- QA: casos base de interrupcion y reanudacion.

Tickets foco:
- CW-016
- CW-017
- CW-020

Criterio de salida:
- Flujo UX aprobado y listo para implementacion completa.

### Dia 12 - Implementacion IDCar + primera alerta
Objetivo del dia:
- Hacer que el usuario complete IDCar y active 1 alerta en la misma sesion.

Tareas:
- FE+BE: alta IDCar en 2 pasos.
- FE: configuracion de primera alerta en onboarding.
- DATA: verificar activacion en sesion y 24h.

Tickets foco:
- CW-018
- CW-019
- CW-021

Criterio de salida:
- KPI activacion en sesion visible por cohorte.

### Dia 13 - Motor de alertas Fase 1 (backend)
Objetivo del dia:
- Dejar operativos los jobs de alertas.

Tareas:
- BE: modelo de alertas y estados.
- BE: job ITV (30/7 dias).
- BE: job seguro.
- BE: job impuestos.

Tickets foco:
- CW-023
- CW-024
- CW-025
- CW-026

Criterio de salida:
- Alertas generadas correctamente en entorno de prueba.

### Dia 14 - Envio y bandeja in-app
Objetivo del dia:
- Entrega real por canales Fase 1.

Tareas:
- BE: servicio email con retry y logging.
- FE: bandeja in-app de avisos.
- DATA: panel de salud de alertas.

Tickets foco:
- CW-027
- CW-028
- CW-029

Criterio de salida:
- Sent/open/click/fail medibles por tipo de alerta.

### Dia 15 - Primer valor en 24h + QA Sprint 2
Objetivo del dia:
- Asegurar valor inmediato para reducir abandono temprano.

Tareas:
- BE: generacion valor mercado inicial + SLA 24h.
- COPY+BE: plantilla email primer valor.
- FE: modulo in-app de valor.
- QA: suite Sprint 2 completa (onboarding + alertas + primer valor).

Tickets foco:
- CW-031
- CW-032
- CW-033
- CW-034
- CW-035
- CW-036
- CW-022
- CW-030

Criterio de salida Sprint 2:
- Time to first value con P50/P90 visible.
- Flujo principal estable y medible end-to-end.

## Sprint 3 (Dias 16-20) - Conversion Plus y Premium fase 2 controlada

### Dia 16 - Trigger conductual de conversion a Plus
Objetivo del dia:
- Activar upgrade en el momento de valor percibido.

Tareas:
- FE: trigger post first_value_seen.
- FE/PM: copy y UX de invitacion contextual.
- DATA: panel de conversion por cohorte con first_value_seen.

Tickets foco:
- CW-037
- CW-040

Criterio de salida:
- Trigger activo sin afectar onboarding.

### Dia 17 - Checkout Plus, estado de plan y QA
Objetivo del dia:
- Cerrar flujo de upgrade con trial completo.

Tareas:
- FE+BE: checkout con trial.
- BE: persistencia estado de plan y trial.
- QA: pruebas de exito/fallo/reintento.

Tickets foco:
- CW-038
- CW-039
- CW-041

Criterio de salida:
- Conversion Free->Plus trazable sin inconsistencias de estado.

### Dia 18 - Premium fase 2: informe avanzado
Objetivo del dia:
- Activar servicio premium de bajo riesgo operativo y alto margen.

Tareas:
- DATA+BE: motor informe avanzado.
- BE+FE: plantilla PDF y entrega app/email.
- FE+PM: upsell informe -> gestion venta.

Tickets foco:
- P-CW-016
- P-CW-017
- P-CW-018

Criterio de salida:
- Informe entregado en menos de 5 min tras pago.

### Dia 19 - Premium fase 2: seguros con partner
Objetivo del dia:
- Lanzar solo si existe acuerdo de monetizacion firmado.

Tareas:
- BIZDEV+PM: validar contrato partner.
- FE+BE: flujo revision seguro + tracking lead.
- DATA: dashboard por partner.

Tickets foco:
- P-CW-019
- P-CW-020
- P-CW-021

Criterio de salida:
- Servicio habilitado solo si partner activo.

### Dia 20 - Operacion premium y cierre Sprint 3
Objetivo del dia:
- Consolidar operacion, incidencias y gobierno de calidad.

Tareas:
- DATA: dashboard global premium.
- BE+OPS+QA: modulo de soporte y disputas premium.
- PM+OPS: readiness de gestion integral venta para siguiente fase.

Tickets foco:
- P-CW-029
- P-CW-030
- P-CW-022
- P-CW-023
- P-CW-024
- P-CW-025

Criterio de salida Sprint 3:
- Conversion Plus operativa con cohorte medible.
- Premium fase 2 bajo control de calidad e ingresos.

## Reglas de control para estos sprints
- No cerrar ticket sin evidencia de evento y KPI asociado.
- No habilitar servicio premium dependiente de terceros sin acuerdo firmado.
- No escalar adquisicion hasta estabilidad de activacion y first value.
- Revisar dashboard cada dia en el cierre operativo.

## Evidencias diarias obligatorias
- Captura de dashboard funnel y premium.
- Lista de tickets cerrados con evidencia QA.
- Incidencias abiertas y responsable asignado.
- Decisiones y cambios de alcance registrados.
