import csv
from pathlib import Path

base = Path(__file__).resolve().parent
source = base / "CarsWise_Backlog_Completo.csv"

jira_out = base / "CarsWise_Jira_Import_P0.csv"
linear_out = base / "CarsWise_Linear_Import_P0.csv"
readme_out = base / "IMPORT_README.md"
assignment_out = base / "CarsWise_Sprint0_1_Assignment.md"

priority_map_jira = {"P0": "Highest", "P1": "High", "P2": "Medium"}
priority_map_linear = {"P0": "1", "P1": "2", "P2": "3"}

rows = []
with source.open("r", encoding="utf-8", newline="") as f:
    reader = csv.DictReader(f)
    for row in reader:
        rows.append(row)

p0_rows = [r for r in rows if r.get("priority") == "P0"]

with jira_out.open("w", encoding="utf-8", newline="") as f:
    fields = [
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
    writer = csv.DictWriter(f, fieldnames=fields)
    writer.writeheader()
    for r in p0_rows:
        est_days = float(r.get("estimate_days") or 0)
        est_hours = int(round(est_days * 8))
        labels = [
            "carswise",
            "execution-plan",
            f"team-{(r.get('team') or 'unknown').lower().replace('+', '-').replace(' ', '-')}",
            f"{(r.get('sprint') or 'no-sprint').lower().replace(' ', '-')}",
        ]
        writer.writerow(
            {
                "Summary": f"{r['id']} - {r['title']}",
                "Issue Type": "Task",
                "Priority": priority_map_jira.get(r["priority"], "Medium"),
                "Description": r.get("description") or "",
                "Labels": " ".join(labels),
                "Sprint": r.get("sprint") or "",
                "Original Estimate": f"{est_hours}h",
                "Dependencies": r.get("dependencies") or "",
                "Acceptance Criteria": r.get("acceptance_criteria") or "",
                "KPI": r.get("kpi") or "",
                "Team": r.get("team") or "",
                "External ID": r.get("id") or "",
            }
        )

with linear_out.open("w", encoding="utf-8", newline="") as f:
    fields = [
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
    writer = csv.DictWriter(f, fieldnames=fields)
    writer.writeheader()
    for r in p0_rows:
        est_days = float(r.get("estimate_days") or 0)
        est_points = max(1, int(round(est_days * 2)))
        labels = [
            "carswise",
            "p0",
            (r.get("sprint") or "no-sprint").lower().replace(" ", "-"),
            (r.get("team") or "unknown").lower().replace("+", "-").replace(" ", "-"),
        ]
        writer.writerow(
            {
                "Title": f"{r['id']} - {r['title']}",
                "Description": r.get("description") or "",
                "Priority": priority_map_linear.get(r["priority"], "3"),
                "State": "Backlog",
                "Project": "CarsWise Execution",
                "Cycle": r.get("sprint") or "",
                "Labels": ",".join(labels),
                "Estimate": est_points,
                "External ID": r.get("id") or "",
                "Dependencies": r.get("dependencies") or "",
                "Team": r.get("team") or "",
                "KPI": r.get("kpi") or "",
            }
        )

readme_out.write_text(
    """# Import Guide (Jira / Linear)

## Files
- CarsWise_Backlog_Completo.csv: full backlog (P0-P2).
- CarsWise_Backlog_P0.csv: execution-critical subset.
- CarsWise_Jira_Import_P0.csv: Jira-ready import for P0.
- CarsWise_Linear_Import_P0.csv: Linear-ready import for P0.

## Jira Import Mapping (recommended)
- Summary -> Summary
- Issue Type -> Issue Type (Task)
- Priority -> Priority
- Description -> Description
- Labels -> Labels
- Sprint -> Sprint (or custom field if required)
- Original Estimate -> Original estimate
- Dependencies -> Issue links (manual post-import if your Jira instance does not map automatically)
- Acceptance Criteria -> custom field or Description appendix
- KPI -> custom field or label prefix `kpi:`
- Team -> Component or Team field
- External ID -> custom field for traceability

## Linear Import Mapping (recommended)
- Title -> Title
- Description -> Description
- Priority -> Priority (1 highest)
- State -> Status (Backlog)
- Project -> Project
- Cycle -> Cycle
- Labels -> Labels
- Estimate -> Estimate (points)
- External ID -> custom field or keep in title
- Dependencies -> relation field (manual review suggested)
- Team -> Team label
- KPI -> label or custom field

## Import Order
1. Import P0 first.
2. Validate field mapping on 2-3 sample rows.
3. Import rest of P0.
4. Run dependency linking pass.
5. Only then import P1/P2 from full backlog.
""",
    encoding="utf-8",
)

assignment_out.write_text(
    """# Sprint 0-1 Assignment Plan

## Objective
Ship a measurable activation funnel and a clear pricing frame without Plus/Premium confusion.

## Suggested Roles
- FE Lead: onboarding and pricing UX implementation.
- BE Lead: tracking endpoint and alert foundations.
- Data Lead: funnel dashboards and KPI definitions.
- QA Lead: E2E flow and event integrity.
- Copy/PM: final messaging and acceptance rules.

## Sprint 0 (Instrumentation)
### Frontend
- CW-003, CW-004, CW-005, CW-006, CW-007

### Backend
- CW-002

### Data
- CW-001, CW-008

### QA
- CW-009

### Exit Criteria
- All 5 funnel events visible in dashboard by cohort.
- Duplicate events below 1%.

## Sprint 1 (Pricing and framing)
### Frontend
- CW-010, CW-012, CW-013, CW-014

### Copy/PM
- CW-011

### QA
- CW-015

### Exit Criteria
- Premium fully separated from plan comparison.
- 4/5 users understand Free vs Plus vs Premium framing in test.

## Working Rules
- No ticket closes without tracking verification.
- No new feature ticket enters sprint without KPI mapping.
- Block P1 work until Sprint 0-1 exit criteria pass.
""",
    encoding="utf-8",
)

print("Generated:")
print(jira_out.name)
print(linear_out.name)
print(readme_out.name)
print(assignment_out.name)
