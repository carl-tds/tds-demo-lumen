# CLAUDE.md

> Read this file first when starting any task in this repo. Then follow the routing below.

## Optional but strongly recommended: install Superpowers

This bundle works on its own but pairs well with Jesse Vincent's Superpowers plugin, which adds auto-triggered engineering-discipline skills (brainstorming, TDD, debugging methodology, etc.). Install once per machine:

```bash
/plugin install superpowers@claude-plugins-official
```

If installed, Superpowers' skills auto-trigger alongside the TDS skills below — Superpowers handles general engineering quality, the TDS skills handle TDS-specific routing (Monday, Pathway A/B, build outcome format). They don't conflict; they layer.

## What this project is

**Client:** Lumen Dental — small private dental practice in central Bristol.
**Primary contact:** Dr. Sarah Chen (clinic owner). Non-technical; plain English, no jargon.
**Goal:** Web-based booking and intake flow replacing paper forms and phone bookings. Integrates with Dentally (practice management software).

**Monday workspace:** https://tailoreddigitalsystems.monday.com/workspaces/6262640
**Monday board (Lumen Dental tasks):** https://tailoreddigitalsystems.monday.com/boards/5095468302
**Project brief (read second):** https://tailoreddigitalsystems.monday.com/docs/5095472250
**Lessons learned:** see `LESSONS.md` — read the most recent 10 entries before starting

> ⚠️ **Note on the brief vs this CLAUDE.md:** The Monday brief was written assuming Replit hosting. **This project actually runs on Vercel + Neon Postgres** — see the Stack section below. If the brief and this CLAUDE.md disagree, this CLAUDE.md wins.

## How the agent system works

You — the human — talk only to the **Orchestrator**. The orchestrator reads the Monday task, decides which specialists to invoke, sequences their work, and posts the final Build Outcome on Monday.

```
You
 ↓
Orchestrator (the only one you converse with)
 ↓
Specialists (called as needed):
  - Frontend Dev      — UI, components, styling
  - Backend Dev       — API, DB, integrations, server logic
  - GHL Builder       — GHL workflows + API scripts (not used on this project)
  - Spec Interpreter  — for Pathway = Spec or thin specs
  - Code Reviewer     — runs on Haiku, after builders, before QA (skipped for GHL UI + Spec)
  - QA Reviewer       — runs on Haiku, last gate before Build Outcome posts
```

Seven skills total. Most code tasks invoke 3 specialists: a builder + Code Reviewer + QA. Spec-only tasks invoke 1: Spec Interpreter. Lumen Dental has no GHL component.

## The five behavioural gates

The orchestrator enforces five gates on every session and every task. These are non-negotiable:

1. **Session Planning Gate** — at the start of every session, orchestrator presents the next ~3 tasks and waits for human approval before dispatching anything
2. **Spec Sufficiency Check** — if the Monday Build Requirements update is thin or ambiguous, dispatch Spec Interpreter first, never let a builder guess
3. **TDD Trigger Check** — for code tasks, decide whether testable behaviour applies before dispatching the specialist (backend logic always; frontend forms with logic always; pure UI/styling no)
4. **Code Reviewer Dispatch** — between builder completion and QA Reviewer, dispatch Code Reviewer (Haiku) for any task with code
5. **Iron Law Verification Gate** — before posting Build Outcome to Monday, confirm fresh verification evidence is in the most recent specialist response

The Iron Law itself, applied throughout: *"If you haven't run the verification command in this message, you cannot claim it passes."*

## Routing — where to look for what

| What you need | Where it lives |
|---|---|
| Project context | The Monday project brief (linked above) |
| Task spec | The "Build Requirements" update on the Monday item |
| The orchestrator's playbook | `.claude/skills/orchestrator.md` |
| Frontend conventions | `.claude/skills/frontend-dev.md` |
| Backend conventions | `.claude/skills/backend-dev.md` |
| GHL conventions (not used here) | `.claude/skills/ghl-builder.md` |
| Spec interpretation | `.claude/skills/spec-interpreter.md` |
| Code review conventions | `.claude/skills/code-reviewer.md` |
| QA conventions | `.claude/skills/qa-review.md` |
| Past lessons | `LESSONS.md` (top of file = most recent) |
| Permissions for autonomous runs | `.claude/settings.json` |

## Workflow at a glance

1. **You start a session** — say "let's pick up some tasks on the Lumen Dental board" or "work on item <id>"
2. **Orchestrator runs Session Planning Gate** — reads the board, presents next ~3 tasks with reasoning, waits for your approval
3. **You approve / adjust** — orchestrator proceeds with the approved order
4. **For each task:**
   - **Spec Sufficiency Check** — if Build Requirements thin, dispatch Spec Interpreter first
   - **TDD Trigger Check** — for code tasks, decide whether tests are required
   - **Dispatch builders in sequence** — Backend before Frontend
   - **Each specialist** plans, builds with self-checks, reports back with Iron Law evidence
   - **Code Reviewer (Haiku)** runs for code tasks, before QA
   - **QA Reviewer (Haiku)** independently verifies acceptance criteria
   - **Iron Law Verification Gate** — orchestrator confirms evidence is present
   - **Build Outcome posted** to Monday with Lessons box on top
   - **Status moves to QA Pending** — never to Done; humans do final flip
5. **LESSONS.md updated** — orchestrator records orchestration lessons; specialists record domain lessons

## Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- **Backend:** Next.js API routes, Prisma ORM
- **Database:** **Neon Postgres** — connection via `DATABASE_URL` env var
- **Auth:** Clerk (clinic users only — patients use one-time email links). Not yet integrated; first auth-touching task will install it.
- **Email:** Postmark (transactional). Not yet integrated.
- **SMS:** Twilio (reminders). Not yet integrated.
- **Storage:** AWS S3 (patient documents). Not yet integrated.
- **Hosting:** **Vercel** — auto-deploys from GitHub on every push
- **Source of truth for code:** GitHub repo `carl-tds/tds-demo-lumen` (private)
- **Test runner:** (to be added — Vitest is the default for this stack) — `npm test`
- **Lint:** ESLint + Next.js defaults — `npm run lint`
- **Build:** `npm run build`
- **Local dev:** `npm run dev` → http://localhost:3000

## How work happens

1. Tasks come from the Monday Lumen Dental board (link above).
2. Agents work on a local checkout of the GitHub repo, on a branch named `tds/<monday-task-id>`.
3. PRs go into `main`. Vercel auto-deploys every branch as a preview URL, and `main` deploys to production.
4. **No one edits code directly on Vercel** — Vercel only consumes from GitHub.

## Conventions specific to this project

- Read this CLAUDE.md AND the task's Build Requirements update before planning.
- Print a 3–7 bullet action plan before making any file changes.
- Branch name: always `tds/<monday-task-id>` (e.g. `tds/2878713714`).
- Commit messages: `<task-id>: <short summary>` (e.g. `2878713714: add booking page step 1`).
- All new API endpoints get a Vitest test. No untested API routes ship to `main`.
- Server-side validation always with Zod. Re-use schemas on client where possible.
- All monetary values in GBP (£). Dates in UK format (DD/MM/YYYY) where displayed.
- Patient communication tone: warm, plain English. Never use medical jargon in patient-facing copy.

## What's already in place (this is a fresh demo project)

- ✅ Next.js scaffold, TypeScript, Tailwind v4, ESLint
- ✅ Vercel deployment connected to GitHub `main` branch
- ✅ Neon Postgres database (empty)
- ✅ `DATABASE_URL` configured in Vercel env vars
- ❌ Prisma not yet installed (first DB-touching task will install it)
- ❌ Clerk auth not yet integrated
- ❌ Postmark / Twilio / S3 not yet integrated
- ❌ No `bookings`, `patients`, or `services` tables yet — they get built when the first task needs them

## Blockers and external dependencies

- **Dentally API credentials** — requested, awaiting partner approval (5–7 working days). Any task depending on Dentally should be set to **Blocked** with a note explaining what's needed. Tracked on Monday item LD08.
- **Postmark account** — needs creating + verified sending domain. Required for first email-sending task.
- **Twilio account** — needs creating. Required for first SMS-sending task.
- **AWS S3 bucket** — needs creating. Required for first file-upload task.

## Things never to do in this repo

- Never `git push --force` to `main`
- Never commit `.env*`, `secrets/`, or anything matching `*token*`, `*secret*`, `*key*`
- Never set Monday status to "Done" — only humans
- Never run destructive scripts against the production Neon database without explicit human approval (`.claude/settings.json` enforces this)
- Never edit `package-lock.json` by hand
- Never claim something works without running the verification in the same response (Iron Law)
- Never deviate from the Stack section above without flagging it first

## When you're stuck (orchestrator or specialist)

If you're not 95% confident about how to proceed:

1. Re-read the relevant skill file
2. Re-read the Monday Build Requirements update
3. Check `LESSONS.md` for relevant past entries
4. If still stuck: post on the Monday item asking the specific question, set status to Blocked, fill Blocker Notes

Don't guess. A Blocked task is fine. A wrong build is expensive.

## Where to ask for help

Tag `@andrew` in a Monday item update if any of the above is unclear or out of date.

---

*Last updated: 2026-05-04. Demo project for the AI agent pilot. Keep this trim. Aim for under 200 lines total. Promote stable lessons from `LESSONS.md` into this file periodically; demote one-offs.*
