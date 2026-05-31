# Non-Conformity Log

| ID | Clause | Description | Severity | Status |
|---|---|---|---|---|
| NC-001 | 4.3 | The QMS Scope is informally defined in README.md but lacks formal documentation, approval, and control as required by the standard. | Minor | Closed |
| NC-002 | 4.1 | Internal issues (Technical Manifesto) and external constraints (Target Environment) are present in README.md but are not systematically monitored or reviewed. | Minor | Closed |
| NC-003 | 4.2 | No documented identification of relevant interested parties nor their specific requirements. | Minor | Closed |
| NC-004 | 5.2 | Absence of a formal Quality Policy. No documented commitment to satisfy applicable requirements and continually improve the QMS. | Major | Closed |
| NC-005 | 6.2 | Absence of Quality Objectives. No measurable goals established to ensure the quality of the software product. | Major | Closed |
| NC-006 | 7.5 | Inadequate control of documented information. The current policy lacks procedures for review, approval, and version control. | Minor | Closed |
| NC-007 | 8.7 | Absence of a formal process for the control of non-conforming outputs. While technical tests exist in /tests, there is no documented procedure to treat failures as NCs or track their resolution. | Major | Closed |
| NC-008 | 8.7 | Multi-part tool responses caused the LLM to trigger a critical error, rejecting the input format. Fixed by aggregating text responses in TurnProcessor. | Major | Closed |
| NC-009 | 8.7 | Silent failure in `fs.writeFile` for files > 5KB with high escape character density (LaTeX). Mitigated via Layered Construction Protocol. | Major | Mitigated |