# NDCAK Tournament System Documentation

This directory is the working product and engineering record for the NDCAK Digital Tournament Management System.

## Source material

- [`idea/full_product_PRD_v1.pdf`](idea/full_product_PRD_v1.pdf) - approved PRD and technical blueprint.
- [`product/full_product_PRD_v1_extracted.txt`](product/full_product_PRD_v1_extracted.txt) - complete 25-page text extraction of the PRD for search and implementation work.
- [`idea/system_flow_architecture.png`](idea/system_flow_architecture.png) - supplied participant, admin, operator, and backend flow.
- [`idea/color_designs.png`](idea/color_designs.png) - supplied design system direction.
- [`assets/logo_full.jpg`](assets/logo_full.jpg) - supplied NDCAK identity artwork.
- [`assets/README.md`](assets/README.md) - source and generated asset register.

## Working documents

- [`product/PRODUCT_BRIEF.md`](product/PRODUCT_BRIEF.md) - concise implementation interpretation of the PRD.
- [`product/PARTICIPANT_UI.md`](product/PARTICIPANT_UI.md) - participant-facing structure, visual rules, and content guardrails.
- [`planning/ROADMAP.md`](planning/ROADMAP.md) - seven-phase delivery plan and exit criteria.
- [`planning/STATUS.md`](planning/STATUS.md) - current progress, decisions, and next work.
- [`planning/PHASE_2_COMPLETION.md`](planning/PHASE_2_COMPLETION.md) - Phase 1 and Phase 2 exit-criteria evidence.
- [`planning/PHASE_3_PROGRESS.md`](planning/PHASE_3_PROGRESS.md) - operator implementation, flow, evidence, and remaining live rehearsal.
- [`planning/EXTERNAL_ACCESS.md`](planning/EXTERNAL_ACCESS.md) - credentials and external setup that will be requested only when needed.
- [`architecture/SYSTEM_ARCHITECTURE.md`](architecture/SYSTEM_ARCHITECTURE.md) - runtime boundaries and major workflows.
- [`architecture/DATA_MODEL.md`](architecture/DATA_MODEL.md) - relational model, invariants, and indexes.
- [`architecture/STATE_FLOWS.md`](architecture/STATE_FLOWS.md) - registration and match state machines.
- [`architecture/AUTHORIZATION.md`](architecture/AUTHORIZATION.md) - staff roles, assignment scopes, and access resolution.
- [`integrations/SUPABASE.md`](integrations/SUPABASE.md) - connection modes, security boundaries, and migration workflow.
- [`integrations/EMAIL.md`](integrations/EMAIL.md) - Resend application email and Supabase Auth SMTP configuration.
- [`research/UI_BENCHMARKS.md`](research/UI_BENCHMARKS.md) - UI research and adopted patterns.
- [`qa/QUALITY_BARS.md`](qa/QUALITY_BARS.md) - engineering, UX, security, and release quality gates.

## Documentation rules

- The PDF remains the product authority. Working documents clarify implementation but do not silently change scope.
- Event dates, fees, capacities, rules, payment accounts, and schedules are configuration data.
- Material product decisions are recorded in `planning/STATUS.md` before implementation diverges from the PRD.
- Diagrams use Mermaid so their source remains reviewable and versionable.
