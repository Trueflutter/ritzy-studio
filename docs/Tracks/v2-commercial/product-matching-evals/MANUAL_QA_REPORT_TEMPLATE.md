# Product Matching Engine Manual QA Report Template

Use this template for one local or preview Product Matching Engine V1 QA run.

This template does not authorize production flag enablement, live catalog writes, deployments, or runtime rollout. See `PR_E_Runtime_Rollout_QA.md` for stop rules and rollout gates.

## Run Details

- Date:
- Reviewer:
- Environment:
- Branch / commit:
- Room ID:
- Concept ID:
- `ai_jobs.id` for `product_visual_sourcing`:
- Product Matching Engine V1 flag value:

## Scenario

- Room type:
- Concept title:
- Concept notes:
- Required roles expected:
- Supporting roles expected:

## Input Metadata

Record values from `ai_jobs.input_summary`.

- `productMatchingEngineEnabled`:
- `candidateCount`:
- `blueprintRoleCount`:
- `roleCandidateCounts`:
- `rolePoolQuality`:
- `rolePoolDiversity`:
- `rolePoolQaRollup`:

## Output Metadata

Record values from `ai_jobs.output_summary`.

- `roleStatuses`:
- `roleConfidence`:
- `roleConfidenceGate`:
- Missing roles:
- Retry used:
- Usable:

## Selected Product Checks

For each required role, record the selected product and QA metadata.

| Role | Product ID | Status | Confidence tier | Evidence completeness | Dimension fit | Freshness | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |

For supporting roles, record only meaningful concerns.

| Role | Product ID | Concern | Notes |
| --- | --- | --- | --- |
|  |  |  |  |

## Visual Review

- Required anchors visually match object type:
- Required anchors visually match color/material direction:
- Required anchors avoid contradictory silhouette or scale:
- Dining chairs are not bulky lounge chairs:
- TV media console roles prefer media/storage units over generic bookcases:
- Beige/cream sofa concepts avoid olive/green sofas when beige options exist:

## Issues

| Severity | Role | Metadata field | Finding | Required follow-up |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Decision

- QA outcome:
- Production rollout allowed by this report: No
- Follow-up PR or catalog action needed:
- Chief architect / Sam decision needed:

## Attachments

- Screenshot paths:
- Relevant logs:
- PR or commit links:
