# LESSONS.md

> Append-only log of things learned while building this project. Newest entries at the top.
>
> **Format:** `[YYYY-MM-DD] <task-code>: <one-line lesson>`
>
> **Discipline:**
> - Agents append a line here whenever they learn something a future agent should know.
> - Agents always read the most recent ~10 entries before starting a new task.
> - Humans periodically promote stable lessons into `CLAUDE.md` and demote one-offs (delete or move to an archive).
> - Keep entries to one line. If a lesson needs more detail, link to a doc or a Monday item.

---

## Recent lessons (newest first)

[2026-05-06] LD01a: React 19's eslint rule `react-hooks/set-state-in-effect` flags ANY setState() inside an effect body, not just synchronous-before-await ones. Move pre-fetch UI flips ("loading") into the input/event handler that triggers the dependency change, leave the effect to consume the response only.
[2026-05-06] LD01a: Vitest 4 + globals:false + @testing-library/react 16 does NOT auto-register cleanup() between tests — DOM nodes from previous render() calls stack and getByRole reports duplicates from the prior test. Register `afterEach(cleanup)` in the setupFiles entry explicitly.
[2026-05-06] LD01a: Vitest 4 supports a `projects: [...]` array on the root `test:` config so the same repo can run node-environment tests (API routes) and jsdom-environment tests (React components) in one `vitest run` — each project gets its own `include`, `environment`, and `setupFiles`.
[2026-05-06] LD01a: Prisma 7 dropped `datasourceUrl`/`datasources` from `PrismaClientOptions` — `new PrismaClient()` at module top-level throws during `next build` page-data collection. Use a Proxy that constructs the client lazily on first property access; the singleton stays compatible with Next.js dev hot reload.
[2026-05-06] LD01a: Vitest 4 + ESM-only `vitest-mock-extended` — top-level `const x = mockDeep()` runs AFTER `vi.mock` factory and breaks the mock. Use `await vi.hoisted(async () => { const { mockDeep } = await import('vitest-mock-extended'); return { x: mockDeep() } })` to construct the mock before any imports resolve. `vi.hoisted` with `require()` fails because vitest itself is ESM-only.
[2026-05-06] LD01a: `prisma generate` reads `prisma.config.ts` which references `env("DATABASE_URL")` — `prisma generate` (and probably any prisma CLI cmd) refuses to run without it set. Pass a dummy when generating without a real DB: `DATABASE_URL=postgres://noop:noop@localhost:5432/noop npx prisma generate`.
[2026-05-06] LD01a: `.gitignore` had `.env*` blanket-ignored — adding `.env.example` to the repo requires `!.env.example` exception, otherwise `git add` silently drops it.

<!--
Example entries (delete these once real ones exist):

[2026-05-01] LD03: Google Calendar sync token expires every 30 days — handle the "invalid sync token" error path with a full backfill, don't crash.
[2026-05-02] LD06: Vercel Cron has a 60-second execution limit. Reminders cron runs in batches of 50 to stay under it.
[2026-05-03] HR04: Calendly Enterprise webhook payloads are versioned — pin to v2 in the webhook config; v1 silently drops the agent_id field.
[2026-05-05] BS02: react-pdf renders synchronously — for >5 page briefs, run PDF gen in a background job, not in the request handler.

-->

---

## Promoted to CLAUDE.md

*When a lesson stops being a "watch out" and becomes a stable convention, move it into CLAUDE.md and note the date here. This keeps `CLAUDE.md` lean and `LESSONS.md` accurate.*

*(empty until a lesson graduates)*

---

## Archived (no longer relevant)

*Lessons that were true once but no longer apply — keep for searchability but out of the active scan.*

*(empty)*
