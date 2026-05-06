# Import Guide (Jira / Linear)

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
