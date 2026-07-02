# Knowledge Base

Onboarding and reference material for taking over the Homiquity application.

## Layout

| Directory | Who writes here | What goes in it |
|-----------|-----------------|-----------------|
| [`my-research/`](my-research/) | **You** | Your own notes, research, experiments, questions, links |
| [`app-guide/`](app-guide/) | Generated/maintained by Claude | The application handbook: architecture, data flow, schema, APIs, security, ops |

## Reading order (new developer path)

1. [01-start-here.md](app-guide/01-start-here.md) — what this app is and how to run it today
2. [02-architecture.md](app-guide/02-architecture.md) — the stack, layers, and request lifecycle
3. [05-data-flow.md](app-guide/05-data-flow.md) — the critical path a loan takes through the system
4. [03-database.md](app-guide/03-database.md) — the schema, domain by domain
5. [04-api-routes.md](app-guide/04-api-routes.md) — the API surface
6. [06-auth-security-secrets.md](app-guide/06-auth-security-secrets.md) — auth, RBAC, secrets, encryption
7. [07-frontend.md](app-guide/07-frontend.md) — the React app
8. [08-services.md](app-guide/08-services.md) — the business-logic service catalog
9. [09-integrations.md](app-guide/09-integrations.md) — every external service we call
10. [10-deploy-ops.md](app-guide/10-deploy-ops.md) — deploy, revert, environments
11. [11-domain-glossary.md](app-guide/11-domain-glossary.md) — mortgage-industry terms decoded

Related repo docs that predate this kb: [PRODUCT_SPINE.md](../PRODUCT_SPINE.md),
[LOCAL_DEV.md](../LOCAL_DEV.md), [CICD.md](../CICD.md), [ROLLBACK.md](../ROLLBACK.md),
[threat_model.md](../threat_model.md), [LAUNCH_READINESS_CHECKLIST.md](../LAUNCH_READINESS_CHECKLIST.md).
