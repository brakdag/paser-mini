# Non-Conformity Procedure

## 1. Purpose
To establish a systematic process for identifying, documenting, and resolving non-conformities (NCs) to prevent the delivery of non-conforming outputs and drive continuous improvement.

## 2. Identification of Non-Conformities (Clause 8.7.1)
An NC is identified when a product, process, or document fails to meet a specified requirement. Sources include:
- QA Audits (e.g., Leo's reports).
- Failed automated tests in `/tests`.
- User-reported bugs or friction points.
- Internal architectural reviews.

## 3. Control and Treatment
Once identified, the NC must be handled as follows:
1. **Containment**: Immediate action to prevent the NC from affecting the end-user (e.g., disabling a buggy tool).
2. **Documentation**: Record the NC in `qms/non_conformities.md` with ID, Clause, Description, and Severity.
3. **Analysis**: Determine the root cause of the failure.
4. **Correction**: Implement the necessary fix to resolve the immediate issue.
5. **Corrective Action**: Implement systemic changes to prevent recurrence.

## 4. Documentation Requirements (Clause 8.7.2)
Every NC entry must include:
- **Description**: What went wrong and which requirement was violated.
- **Actions Taken**: Detailed log of the correction and corrective actions.
- **Authority**: The person who approved the resolution.
- **Status**: Open $\rightarrow$ In Progress $\rightarrow$ Closed.

## 5. Verification of Effectiveness
Before closing an NC, the QA lead must verify that the correction is effective and that no new non-conformities were introduced.

## 6. Approval
- **Role**: Product Manager / UX Strategist
- **Date**: 2026-05-25
- **Status**: Approved
