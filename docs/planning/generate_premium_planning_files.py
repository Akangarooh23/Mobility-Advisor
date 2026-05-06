import csv
from pathlib import Path

base = Path(__file__).resolve().parent

items = [
    {
        "id": "P-CW-001",
        "title": "Modelo de servicio Premium y taxonomía",
        "description": "Definir taxonomía oficial Premium: Resolución vs Mejora, reglas de naming y exclusión explícita de Premium como plan.",
        "priority": "P0",
        "team": "PM+COPY",
        "sprint": "Premium Sprint 0",
        "estimate_days": "1",
        "dependencies": "",
        "acceptance_criteria": "Documento aprobado con definiciones, alcance y lenguaje canónico",
        "kpi": "Consistencia de naming en web y producto",
    },
    {
        "id": "P-CW-002",
        "title": "Eventos Premium canónicos",
        "description": "Definir eventos premium_service_view, premium_service_cta, premium_checkout_started, premium_checkout_completed, premium_refund_requested, premium_service_closed.",
        "priority": "P0",
        "team": "DATA",
        "sprint": "Premium Sprint 0",
        "estimate_days": "1",
        "dependencies": "P-CW-001",
        "acceptance_criteria": "Diccionario de eventos versionado y aprobado",
        "kpi": "Cobertura de tracking Premium",
    },
    {
        "id": "P-CW-003",
        "title": "Instrumentación base Premium",
        "description": "Implementar endpoint/backend para eventos Premium con idempotencia y validación de payload.",
        "priority": "P0",
        "team": "BE",
        "sprint": "Premium Sprint 0",
        "estimate_days": "1.5",
        "dependencies": "P-CW-002",
        "acceptance_criteria": "Eventos Premium almacenados sin duplicados",
        "kpi": "Tasa de duplicados menor al 1%",
    },
    {
        "id": "P-CW-004",
        "title": "Sección web Servicios bajo demanda",
        "description": "Crear sección separada de planes con header y copy de conexión Plus vs Premium.",
        "priority": "P0",
        "team": "FE+COPY",
        "sprint": "Premium Sprint 1",
        "estimate_days": "2",
        "dependencies": "P-CW-001",
        "acceptance_criteria": "Premium visible fuera del comparador Free/Plus en desktop y mobile",
        "kpi": "Comprensión de propuesta Premium",
    },
    {
        "id": "P-CW-005",
        "title": "Grid de tarjetas Premium",
        "description": "Implementar tarjetas por servicio con precio, una línea de valor y CTA específico.",
        "priority": "P0",
        "team": "FE",
        "sprint": "Premium Sprint 1",
        "estimate_days": "1.5",
        "dependencies": "P-CW-004",
        "acceptance_criteria": "Se muestran 5 servicios con CTAs diferenciados",
        "kpi": "CTR por tarjeta Premium",
    },
    {
        "id": "P-CW-006",
        "title": "Tracking web Premium",
        "description": "Emitir premium_service_view y premium_service_cta por tarjeta y posición.",
        "priority": "P0",
        "team": "FE+DATA",
        "sprint": "Premium Sprint 1",
        "estimate_days": "0.5",
        "dependencies": "P-CW-003|P-CW-005",
        "acceptance_criteria": "Eventos visibles por servicio y canal",
        "kpi": "CTR por servicio",
    },
    {
        "id": "P-CW-007",
        "title": "Checkout base de servicios Premium",
        "description": "Flujo de pago único para servicios con resumen, T&C y confirmación.",
        "priority": "P0",
        "team": "FE+BE",
        "sprint": "Premium Sprint 1",
        "estimate_days": "2",
        "dependencies": "P-CW-005",
        "acceptance_criteria": "Checkout completo funcional en staging",
        "kpi": "Conversion checkout Premium",
    },
    {
        "id": "P-CW-008",
        "title": "Política de reembolsos y cancelación",
        "description": "Implementar reglas por servicio: fee venta, sello, informe y add-ons.",
        "priority": "P0",
        "team": "PM+LEGAL+BE",
        "sprint": "Premium Sprint 1",
        "estimate_days": "1.5",
        "dependencies": "P-CW-007",
        "acceptance_criteria": "Política visible y aplicada en backend",
        "kpi": "Conflictos de cobro",
    },
    {
        "id": "P-CW-009",
        "title": "Facturación automática Premium",
        "description": "Emitir comprobante/factura automática por compra de servicio Premium.",
        "priority": "P0",
        "team": "BE",
        "sprint": "Premium Sprint 1",
        "estimate_days": "1",
        "dependencies": "P-CW-007",
        "acceptance_criteria": "Factura generada en 100% de compras",
        "kpi": "Cobertura de facturación",
    },
    {
        "id": "P-CW-010",
        "title": "Add-on Destacar anuncio",
        "description": "Activación automática de boost en ranking por 7 o 14 días con precio 9/19.",
        "priority": "P0",
        "team": "FE+BE",
        "sprint": "Premium Sprint 1",
        "estimate_days": "2",
        "dependencies": "P-CW-007",
        "acceptance_criteria": "Boost activo con expiración automática",
        "kpi": "Venta de destacar anuncio",
    },
    {
        "id": "P-CW-011",
        "title": "Renovación destacar anuncio",
        "description": "Ofrecer renovación con descuento al vencer el boost.",
        "priority": "P1",
        "team": "FE+BE",
        "sprint": "Premium Sprint 2",
        "estimate_days": "1",
        "dependencies": "P-CW-010",
        "acceptance_criteria": "Oferta visible y aplicable post-expiración",
        "kpi": "Renewal rate boost",
    },
    {
        "id": "P-CW-012",
        "title": "Add-on Publicación premium",
        "description": "Desbloquear ficha ampliada, fotos extra, video y badge vendedor verificado por 30 días.",
        "priority": "P0",
        "team": "FE+BE",
        "sprint": "Premium Sprint 1",
        "estimate_days": "2",
        "dependencies": "P-CW-007",
        "acceptance_criteria": "Campos premium activos solo para anuncios de pago",
        "kpi": "Venta de publicación premium",
    },
    {
        "id": "P-CW-013",
        "title": "Reglas de elegibilidad Premium por anuncio",
        "description": "Validar estado del anuncio y evitar conflictos entre add-ons incompatibles.",
        "priority": "P0",
        "team": "BE",
        "sprint": "Premium Sprint 1",
        "estimate_days": "1",
        "dependencies": "P-CW-010|P-CW-012",
        "acceptance_criteria": "No hay activaciones inconsistentes",
        "kpi": "Errores de activación Premium",
    },
    {
        "id": "P-CW-014",
        "title": "Dashboard ingresos Premium Fase 1",
        "description": "Panel de ingresos por add-on, tasa de compra y repetición.",
        "priority": "P0",
        "team": "DATA",
        "sprint": "Premium Sprint 1",
        "estimate_days": "1",
        "dependencies": "P-CW-006|P-CW-007|P-CW-010|P-CW-012",
        "acceptance_criteria": "Reporte diario por servicio disponible",
        "kpi": "Ingresos premium por servicio",
    },
    {
        "id": "P-CW-015",
        "title": "QA end-to-end Fase 1 Premium",
        "description": "Pruebas completas: vista servicio, checkout, activación, expiración y reembolso.",
        "priority": "P0",
        "team": "QA",
        "sprint": "Premium Sprint 1",
        "estimate_days": "1.5",
        "dependencies": "P-CW-010|P-CW-012|P-CW-013",
        "acceptance_criteria": "Suite E2E verde en CI",
        "kpi": "Incidencias de post-lanzamiento",
    },
    {
        "id": "P-CW-016",
        "title": "Motor informe de mercado avanzado",
        "description": "Generar informe 19/29 con rango precio, histórico y recomendación de momento.",
        "priority": "P1",
        "team": "DATA+BE",
        "sprint": "Premium Sprint 2",
        "estimate_days": "3",
        "dependencies": "P-CW-007",
        "acceptance_criteria": "Informe generado en menos de 5 minutos",
        "kpi": "Tiempo de entrega informe",
    },
    {
        "id": "P-CW-017",
        "title": "Plantilla PDF informe y entrega app/email",
        "description": "Construir plantilla PDF y distribución automática tras pago.",
        "priority": "P1",
        "team": "BE+FE",
        "sprint": "Premium Sprint 2",
        "estimate_days": "2",
        "dependencies": "P-CW-016",
        "acceptance_criteria": "PDF descargable + resumen en app",
        "kpi": "Tasa de apertura informe",
    },
    {
        "id": "P-CW-018",
        "title": "Upsell informe a gestión de venta",
        "description": "Flujo para ofrecer gestión integral tras consumo de informe.",
        "priority": "P1",
        "team": "FE+PM",
        "sprint": "Premium Sprint 2",
        "estimate_days": "1",
        "dependencies": "P-CW-016|P-CW-017",
        "acceptance_criteria": "CTA contextual activo post-informe",
        "kpi": "Conversión informe a gestión",
    },
    {
        "id": "P-CW-019",
        "title": "Acuerdo partner seguros",
        "description": "Cerrar al menos un acuerdo de afiliación/lead para monetizar revisión de seguro.",
        "priority": "P1",
        "team": "BIZDEV+PM",
        "sprint": "Premium Sprint 2",
        "estimate_days": "3",
        "dependencies": "",
        "acceptance_criteria": "Contrato o acuerdo operativo firmado",
        "kpi": "Ingreso por lead de seguros",
    },
    {
        "id": "P-CW-020",
        "title": "Flujo revisión de seguro",
        "description": "Formulario póliza actual, comparación y recomendación con tracking de lead.",
        "priority": "P1",
        "team": "FE+BE",
        "sprint": "Premium Sprint 2",
        "estimate_days": "2",
        "dependencies": "P-CW-019|P-CW-007",
        "acceptance_criteria": "Lead enviado y trazable a partner",
        "kpi": "Leads cualificados enviados",
    },
    {
        "id": "P-CW-021",
        "title": "Dashboard seguros",
        "description": "Panel de rendimiento por partner: leads, aceptación, ingreso.",
        "priority": "P1",
        "team": "DATA",
        "sprint": "Premium Sprint 2",
        "estimate_days": "1",
        "dependencies": "P-CW-020",
        "acceptance_criteria": "Reporte semanal por partner",
        "kpi": "Ingreso neto por canal seguro",
    },
    {
        "id": "P-CW-022",
        "title": "Playbook operativo gestión integral venta",
        "description": "Definir SOP: intake, publicación, gestión contactos, negociación, cierre y documentación.",
        "priority": "P1",
        "team": "OPS+PM",
        "sprint": "Premium Sprint 3",
        "estimate_days": "2",
        "dependencies": "",
        "acceptance_criteria": "SOP completo con checklist y tiempos objetivo",
        "kpi": "Tiempo medio de gestión por venta",
    },
    {
        "id": "P-CW-023",
        "title": "Modelo de pricing gestión venta",
        "description": "Implementar fee fijo inicial 149/199 y framework para migrar a comisión o mixto.",
        "priority": "P1",
        "team": "PM+BE",
        "sprint": "Premium Sprint 3",
        "estimate_days": "1",
        "dependencies": "P-CW-022|P-CW-007",
        "acceptance_criteria": "Checkout soporta fee fijo y flag de comisión futura",
        "kpi": "Conversión contratación gestión",
    },
    {
        "id": "P-CW-024",
        "title": "CRM ligero para casos de venta",
        "description": "Pipeline de casos con estado y SLA para máximo 5-10 ventas simultáneas.",
        "priority": "P1",
        "team": "BE+OPS",
        "sprint": "Premium Sprint 3",
        "estimate_days": "2.5",
        "dependencies": "P-CW-022",
        "acceptance_criteria": "Cada caso tiene owner y estado trazable",
        "kpi": "SLA de respuesta por caso",
    },
    {
        "id": "P-CW-025",
        "title": "Lanzamiento beta gestión venta",
        "description": "Activar servicio para volumen limitado con QA operativo y control NPS.",
        "priority": "P1",
        "team": "OPS+QA+PM",
        "sprint": "Premium Sprint 3",
        "estimate_days": "2",
        "dependencies": "P-CW-023|P-CW-024",
        "acceptance_criteria": "Beta activa con cupo y política de calidad",
        "kpi": "NPS post-servicio gestión venta",
    },
    {
        "id": "P-CW-026",
        "title": "Red mínima de talleres homologados",
        "description": "Activar de 3 a 5 talleres partner en ciudades clave para sello.",
        "priority": "P2",
        "team": "BIZDEV+OPS",
        "sprint": "Premium Sprint 4",
        "estimate_days": "4",
        "dependencies": "",
        "acceptance_criteria": "Red operativa con SLA acordado",
        "kpi": "Cobertura geográfica sello",
    },
    {
        "id": "P-CW-027",
        "title": "Flujo sello de garantía",
        "description": "Pago, asignación cita taller, carga resultados y generación badge + PDF.",
        "priority": "P2",
        "team": "FE+BE",
        "sprint": "Premium Sprint 4",
        "estimate_days": "3",
        "dependencies": "P-CW-026|P-CW-007",
        "acceptance_criteria": "Proceso end-to-end sin intervención manual en sistema",
        "kpi": "Tasa de finalización sello",
    },
    {
        "id": "P-CW-028",
        "title": "Reglas de reembolso sello",
        "description": "Aplicar política de reembolso parcial si inspección no apta.",
        "priority": "P2",
        "team": "BE+LEGAL",
        "sprint": "Premium Sprint 4",
        "estimate_days": "1",
        "dependencies": "P-CW-027|P-CW-008",
        "acceptance_criteria": "Reembolso parcial aplicado automáticamente",
        "kpi": "Incidencias de reembolso sello",
    },
    {
        "id": "P-CW-029",
        "title": "Analítica global Premium",
        "description": "Panel consolidado de ingresos, márgenes y NPS por servicio y tipo.",
        "priority": "P1",
        "team": "DATA",
        "sprint": "Premium Sprint 2",
        "estimate_days": "1",
        "dependencies": "P-CW-014|P-CW-021",
        "acceptance_criteria": "Visión semanal por resolución y mejora",
        "kpi": "Ingresos premium totales",
    },
    {
        "id": "P-CW-030",
        "title": "Módulo de soporte y disputas Premium",
        "description": "Flujo de soporte para pagos, cancelaciones y calidad del servicio.",
        "priority": "P1",
        "team": "BE+OPS+QA",
        "sprint": "Premium Sprint 2",
        "estimate_days": "2",
        "dependencies": "P-CW-008|P-CW-009",
        "acceptance_criteria": "Ticketing de incidencias activo y SLA definido",
        "kpi": "Tiempo de resolución de incidencias",
    },
]


full_path = base / "CarsWise_Premium_Backlog_Completo.csv"
p0_path = base / "CarsWise_Premium_Backlog_P0.csv"
jira_path = base / "CarsWise_Premium_Jira_Import_P0.csv"
linear_path = base / "CarsWise_Premium_Linear_Import_P0.csv"
readme_path = base / "CarsWise_Premium_IMPORT_README.md"
assign_path = base / "CarsWise_Premium_Sprint0_2_Assignment.md"

fields = [
    "id",
    "title",
    "description",
    "priority",
    "team",
    "sprint",
    "estimate_days",
    "dependencies",
    "acceptance_criteria",
    "kpi",
]

with full_path.open("w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fields)
    writer.writeheader()
    writer.writerows(items)

p0_items = [i for i in items if i["priority"] == "P0"]
with p0_path.open("w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fields)
    writer.writeheader()
    writer.writerows(p0_items)

priority_map_jira = {"P0": "Highest", "P1": "High", "P2": "Medium"}
with jira_path.open("w", encoding="utf-8", newline="") as f:
    jira_fields = [
        "Summary",
        "Issue Type",
        "Priority",
        "Description",
        "Labels",
        "Sprint",
        "Original Estimate",
        "Dependencies",
        "Acceptance Criteria",
        "KPI",
        "Team",
        "External ID",
    ]
    writer = csv.DictWriter(f, fieldnames=jira_fields)
    writer.writeheader()
    for r in p0_items:
        est_h = int(round(float(r["estimate_days"]) * 8))
        labels = [
            "carswise",
            "premium",
            "execution-plan",
            f"team-{r['team'].lower().replace('+', '-').replace(' ', '-')}",
            r["sprint"].lower().replace(" ", "-"),
        ]
        writer.writerow(
            {
                "Summary": f"{r['id']} - {r['title']}",
                "Issue Type": "Task",
                "Priority": priority_map_jira.get(r["priority"], "Medium"),
                "Description": r["description"],
                "Labels": " ".join(labels),
                "Sprint": r["sprint"],
                "Original Estimate": f"{est_h}h",
                "Dependencies": r["dependencies"],
                "Acceptance Criteria": r["acceptance_criteria"],
                "KPI": r["kpi"],
                "Team": r["team"],
                "External ID": r["id"],
            }
        )

priority_map_linear = {"P0": "1", "P1": "2", "P2": "3"}
with linear_path.open("w", encoding="utf-8", newline="") as f:
    linear_fields = [
        "Title",
        "Description",
        "Priority",
        "State",
        "Project",
        "Cycle",
        "Labels",
        "Estimate",
        "External ID",
        "Dependencies",
        "Team",
        "KPI",
    ]
    writer = csv.DictWriter(f, fieldnames=linear_fields)
    writer.writeheader()
    for r in p0_items:
        est_points = max(1, int(round(float(r["estimate_days"]) * 2)))
        labels = [
            "carswise",
            "premium",
            "p0",
            r["sprint"].lower().replace(" ", "-"),
            r["team"].lower().replace("+", "-").replace(" ", "-"),
        ]
        writer.writerow(
            {
                "Title": f"{r['id']} - {r['title']}",
                "Description": r["description"],
                "Priority": priority_map_linear.get(r["priority"], "3"),
                "State": "Backlog",
                "Project": "CarsWise Premium",
                "Cycle": r["sprint"],
                "Labels": ",".join(labels),
                "Estimate": est_points,
                "External ID": r["id"],
                "Dependencies": r["dependencies"],
                "Team": r["team"],
                "KPI": r["kpi"],
            }
        )

readme_path.write_text(
    """# Premium Import Guide (Jira / Linear)

## Files
- CarsWise_Premium_Backlog_Completo.csv
- CarsWise_Premium_Backlog_P0.csv
- CarsWise_Premium_Jira_Import_P0.csv
- CarsWise_Premium_Linear_Import_P0.csv

## Recommended import order
1. Import P0 first.
2. Validate 3 sample tickets.
3. Map dependencies (manual pass if required by tool).
4. Import P1 and P2 from full backlog.

## Notes
- Premium must stay outside plan comparison in all tickets touching web pricing.
- Track both premium types: resolucion vs mejora.
- Do not launch insurance review without at least one active partner agreement.
- Do not launch guarantee seal without minimum workshop network.
""",
    encoding="utf-8",
)

assign_path.write_text(
    """# Premium Sprint 0-2 Assignment Plan

## Objective
Launch Premium phase 1 (automatic add-ons) with measurable revenue and low operational risk.

## Sprint 0 (Foundations)
- PM/COPY: P-CW-001
- DATA: P-CW-002
- BE: P-CW-003

Exit:
- Premium taxonomy and tracking approved.

## Sprint 1 (Launch Fase 1)
- FE/COPY: P-CW-004, P-CW-005
- FE/DATA: P-CW-006
- FE/BE: P-CW-007, P-CW-010, P-CW-012
- PM/LEGAL/BE: P-CW-008, P-CW-009
- BE: P-CW-013
- DATA: P-CW-014
- QA: P-CW-015

Exit:
- Destacar anuncio y Publicacion premium vendidos end-to-end.
- Premium shown as servicios bajo demanda (not plan).
- Revenue dashboard live.

## Sprint 2 (Expand controlled)
- DATA/BE: P-CW-016
- BE/FE: P-CW-017
- FE/PM: P-CW-018
- BIZDEV/PM: P-CW-019
- FE/BE: P-CW-020
- DATA: P-CW-021, P-CW-029
- BE/OPS/QA: P-CW-030

Exit:
- Informe avanzado live.
- Insurance review only if partner live.
- Global Premium metrics available.
""",
    encoding="utf-8",
)

print("Generated Premium planning files:")
print(full_path.name)
print(p0_path.name)
print(jira_path.name)
print(linear_path.name)
print(readme_path.name)
print(assign_path.name)
