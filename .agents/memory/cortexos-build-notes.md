---
name: CortexOS build notes
description: Durable implementation constraints for the CortexOS first version.
---

The initial CortexOS experience is intentionally route-complete and API-backed, while native Windows actions and cloud persistence remain replaceable follow-up layers.

**Why:** The user wants a complete first display surface with API connections now and plans to finish deeper native functionality later.

**How to apply:** Preserve the generated API client boundary and integration-status surface when adding Supabase, AI providers, Tauri commands, or persistent storage; do not move product data back into page-local mocks.

The current workspace uses a Zod version where generated `zod.int()` is not available.

**Why:** OpenAPI `integer` schemas cause codegen to produce `zod.int()`, which fails the workspace typecheck.

**How to apply:** Use numeric OpenAPI fields for this workspace unless the Zod/toolchain version is upgraded together with the generated client.