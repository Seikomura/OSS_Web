# OSS Client Portal — agent entry point

These repository instructions apply to every coding agent working in this checkout. Human instructions define the task and take precedence. Respond to the owner in Thai; keep code identifiers in English.

## Start each task

1. Read [README.md](README.md) and [docs/HANDOFF.md](docs/HANDOFF.md). Check `git status --short`, the current branch, and recent commits before editing. Treat the handoff as a dated snapshot and verify facts relevant to the task against current files.
2. Work only on the requested scope. Preserve existing uncommitted work. Use a separate `codex/<task>` branch for new independent work unless the owner specifies another branch; continue an existing task on its assigned branch.
3. For setup, collaboration, or moving to another agent/tool, read [docs/AGENT-WORKFLOW.md](docs/AGENT-WORKFLOW.md). For account/Auth changes, read [docs/ผู้ดูแลระบบ.md](docs/ผู้ดูแลระบบ.md) and [docs/คู่มือ-ระบบจริง.md](docs/คู่มือ-ระบบจริง.md).

## Implementation boundaries

- The active app is vanilla JavaScript + Vite (`src/`), Vercel API (`api/`, `server/`), and Supabase Auth/PostgreSQL (`supabase/migrations/`). `dist/` is the old Sites demo; edit it only for an explicit legacy-demo task. Build output is `build/`.
- Preserve customer isolation: customers read only their own jobs; account and status mutations require verified server-side Admin access. Use Supabase Auth for passwords and keep privileged keys on the server. Never put secrets in browser code, `VITE_*` variables, commits, reports, or chat output.
- Maintain 15 stable step IDs: S1–S4, A1–A3, B1–B4, F1–F4. Factory and Lab run in parallel. Waiting and pending steps use gray. Use “ขั้นตอน” in Thai UI. Progress counts completed steps only. Preserve the B2 label override for มอ.5.
- The selected live design is Metro Focus, light and responsive. The CSS order is `styles.css` → `refresh.css` → `modern.css` → `metro-focus.css`. Verify geometry-dependent track lines after layout changes. A carousel selection alone does not authorize switching the deployed design.
- Keep form errors visible and wait for successful server saves. Password fields left blank during edits retain the current password. Preserve the last-active-Admin and self-disable guards. Archive behavior retains records; do not replace it with permanent deletion.

## Verification and delivery

- Run checks appropriate to the change. For executable changes, use `npm test` and `npm run build`. For UI changes, inspect the actual screen at desktop and mobile widths, check all 15 steps and their connections, and exercise the affected interaction. Static tests alone are not visual verification.
- Documentation-only changes need link/path and factual checks, not database mutations. `npm run test:live` mutates data and requires an explicitly designated disposable test database/account workflow. It is not an offline test.
- Before deployment, migration, account changes, or credential work, verify the target environment and the owner's authorization for that action. Development credentials may point to the shared database. Adding a migration file does not authorize applying it remotely. Routine local edits and offline checks do not require repeated permission.
- Stage only intended files; review the diff for secrets and unrelated changes. Commit/push within authorized scope. Keep separate agents' changes isolated until reviewed. Never overwrite another worker's files or force-push a shared branch.
- At completion, report what changed, what was verified, and remaining limitations. Update `docs/HANDOFF.md` when behavior, architecture, release state, or outstanding work changes; record the date and distinguish local, tested, and deployed results.
