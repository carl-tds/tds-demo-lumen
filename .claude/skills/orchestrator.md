# Skill: Orchestrator

> The main agent reads this on every Monday task. The orchestrator's job is **routing and sequencing** — it doesn't build, it decides who builds. It also owns the final Build Outcome update on Monday and enforces the verification gates that protect against false completion claims.

## When this skill applies

Always. The orchestrator is the entry point for every TDS work session and every Monday task. You — the human — only ever talk to the orchestrator. The orchestrator talks to specialists.

## The five behavioural gates (non-negotiable)

The orchestrator enforces five gates. Skipping any one of them is a policy violation, not a shortcut.

1. **Session Planning Gate** — at session start, present the next ~3 tasks before dispatching anything
2. **Spec Sufficiency Check** — before dispatching a specialist, verify the Build Requirements update is complete
3. **TDD Trigger Check** — for code tasks, decide whether testable behaviour applies and pass that decision to the specialist
4. **Code Reviewer Dispatch** — between specialist completion and QA Reviewer, dispatch Code Reviewer (Haiku) for any task with code
5. **Iron Law Verification Gate** — before posting Build Outcome to Monday, confirm fresh verification evidence is present in the most recent specialist response

## The seven specialists you can dispatch

| Specialist | Skill file | When to invoke | Model |
|---|---|---|---|
| **Frontend Dev** | `frontend-dev.md` | UI: pages, components, styling, client-side state, forms (UI part) | Sonnet/Opus |
| **Backend Dev** | `backend-dev.md` | API routes, business logic, DB, server validation, third-party integrations | Sonnet/Opus |
| **GHL Builder** | `ghl-builder.md` | GHL workflows + API scripts | Sonnet/Opus |
| **Spec Interpreter** | `spec-interpreter.md` | Pathway = Spec, OR Spec Sufficiency Check fails | Haiku |
| **Code Reviewer** | `code-reviewer.md` | Always after a code-touching specialist, before QA | Haiku |
| **QA Reviewer** | `qa-review.md` | Always at the end (after Code Reviewer if applicable) | Haiku |

Most code tasks invoke 3 specialists: a builder + Code Reviewer + QA Reviewer. GHL UI tasks invoke 2: GHL Builder + QA Reviewer (no Code Reviewer — no code).

## The orchestrator workflow

### Step 0 — Session Planning Gate (start of every session)

Before dispatching ANY specialist on ANY task:

1. Read all three Monday boards in the Demo workspace (or whichever boards the user names)
2. Identify all Pending tasks across boards
3. For each, check: priority, dependencies, blocker status
4. Filter out: Blocked tasks, tasks whose dependencies aren't Done
5. **Print a session plan**: the next ~3 tasks you would work on, in proposed order, with reasoning for each

Format:
```
SESSION PLAN

I see N pending tasks across the boards. Here's what I propose to pick up, in order:

1. [TASK CODE] — [Title] ([Project])
   Why first: [reasoning — priority, unblocking other tasks, etc.]
   Pathway: [A/B/Spec], Estimated complexity: [S/M/L]

2. [TASK CODE] — ...

3. [TASK CODE] — ...

Approve to proceed, adjust the order, or tell me to pick differently.
```

**Stop. Wait for human approval before continuing.** No exceptions. This is the most important gate — it's the single point in the workflow where the human sees the orchestrator's judgment before tokens are spent on building.

If a session is interrupted (blocker emerges, two QA failures on a task, scope shift), re-run Step 0 before resuming.

### Step 1 — Read everything before dispatching a single task

For the approved task, read in this order:

1. The full Monday item including the Build Requirements update
2. The project's `CLAUDE.md`
3. The most recent ~10 entries in `LESSONS.md`
4. The project brief (linked from CLAUDE.md)

### Step 2 — Spec Sufficiency Check

Before dispatching any specialist, verify the Build Requirements update has all five sections:

- **Objective** — clear, single-sentence outcome
- **Trigger** — what kicks this off / dependencies
- **Actions** — concrete bullet list of what to do
- **Acceptance Criteria** — testable conditions, at least 3
- **Technical Notes** — gotchas, design decisions

**If all five sections are present and clear:** proceed to Step 3.

**If any section is missing or ambiguous:** dispatch Spec Interpreter first. The Spec Interpreter produces a structured spec doc, posts it as a Monday update, and the task waits for human approval before a builder is dispatched. Don't try to fill gaps with assumptions.

### Step 3 — Classify and TDD Trigger Check

Based on the Pathway column:

- **Pathway A — Code**: needs Frontend Dev, Backend Dev, or both
- **Pathway B — GHL**: needs GHL Builder
- **Pathway = Spec**: handled in Step 2 already

For Pathway A tasks, also do the TDD Trigger Check:

- Read the Acceptance Criteria
- If criteria describe testable behaviours ("validates X", "returns Y", "fires Z when W"): **TDD applies**. Pass `tdd_required=true` to the specialist.
- If criteria are visual or stylistic ("looks right on mobile", "matches brand colours", "uses correct font"): **TDD does not apply**. Pass `tdd_required=false`.
- Backend Dev: TDD always applies for backend logic regardless. Frontend Dev: this check decides.

Document the TDD decision in your routing plan so it's traceable.

### Step 4 — Plan the dispatch sequence

Write a short routing plan in plain English. Examples:

**Code task with UI + API:**
> "LD01 needs both backend (API + DB + Postmark) and frontend (3-step form). TDD required: backend yes (validation logic, integration), frontend yes (form has business logic). Dispatching: Backend Dev → Frontend Dev → Code Reviewer → QA Reviewer."

**Code task UI-only stylistic:**
> "LD04-revision (move admin nav to top) is pure UI. TDD: not required (stylistic). Dispatching: Frontend Dev → Code Reviewer → QA Reviewer."

**GHL task:**
> "HR01 is a GHL UI workflow. No code. Dispatching: GHL Builder → QA Reviewer (skip Code Reviewer)."

**GHL B2 script task:**
> "HR07 is a GHL API script. Has code. TDD applies. Dispatching: GHL Builder (B2 mode) → Code Reviewer → QA Reviewer."

### Step 5 — Dispatch in sequence

Specialists run sequentially by default — backend before frontend matters because frontend needs to know the API contract. Parallelise only when work is genuinely independent (separate files, separate concerns, no shared state).

For each specialist:
1. Hand off only the relevant subset of the spec (don't dump the whole task on every specialist)
2. Pass the TDD decision, the relevant project conventions, and the Iron Law expectation
3. Wait for their completion report
4. Verify their report contains fresh evidence (not "should work" or "tests should pass" — actual command outputs)

### Step 6 — Code Reviewer Dispatch (skip for GHL UI workflows and Spec-only)

After all builders report complete, AND IF there is code to review:

1. Dispatch Code Reviewer (Haiku) with the diff and the original spec
2. Code Reviewer returns PASS / FAIL with structured findings
3. **If FAIL:** route findings back to the relevant builder. Up to 2 iterations before escalating to human.
4. **If PASS:** proceed to Step 7.

Skip Code Reviewer for: pure GHL UI workflows (no code), Spec-only tasks (no code). Don't skip for B2 GHL API scripts (those are code).

### Step 7 — QA Reviewer Dispatch

Always run QA Reviewer last. QA verifies acceptance criteria independently — a different concern from Code Reviewer's "is the code well-written" check.

1. Dispatch QA Reviewer (Haiku) with the original spec and the most recent verification evidence
2. QA returns APPROVAL / REJECTION
3. **If REJECTION:** route back to the relevant builder. Up to 2 iterations before escalating.
4. **If APPROVAL:** proceed to Step 8.

### Step 8 — Iron Law Verification Gate

Before posting Build Outcome to Monday, run this gate explicitly:

```
For each Acceptance Criterion:
  - What command/screenshot/test proves it?
  - Did the most recent specialist response contain that evidence?
  - If NO → STOP. Cannot post Build Outcome. Re-dispatch the specialist for missing verification.
  - If YES → criterion is verified.

If all criteria verified → proceed to post.
```

The Iron Law phrase, applied at the orchestrator level: *"If the most recent specialist response does not contain fresh verification evidence for every claim in the Build Outcome, the Build Outcome cannot be posted."*

### Step 9 — Compose and post Build Outcome

Compose the integrated Build Outcome update from each specialist's contribution. Always start with the Lessons box at the top.

```html
<p>📚 <b>Lessons from this build</b></p>
<ul>
  <li>[lessons recorded by orchestrator + specialists]</li>
</ul>
<p>(or "No new lessons — task fit existing patterns")</p>
<hr>
<p>✅ <b>Build Outcome — &lt;TASK-CODE&gt;</b></p>
<p><b>Specialists involved:</b> &lt;list&gt;<br>
<b>TDD applied:</b> &lt;yes/no, with reason&gt;<br>
<b>Code Review:</b> &lt;PASS / N/A — no code&gt;<br>
<b>QA Review:</b> APPROVED</p>
<p><b>Acceptance criteria — verified:</b></p>
<ul>
  <li>✅ Criterion 1 — &lt;evidence: command output, screenshot, etc.&gt;</li>
  <li>✅ Criterion 2 — &lt;evidence&gt;</li>
</ul>
<p><b>What changed:</b><br>
&lt;1–3 sentence plain-English summary&gt;</p>
<p><b>Open questions / follow-ups:</b><br>
&lt;anything the human should know — or "None"&gt;</p>
```

### Step 10 — Set Monday status to QA Pending

NEVER set status to Done — humans do that after their final review. Always QA Pending.

### Step 11 — Append orchestrator-level lessons

If the orchestration itself surfaced something worth recording (a specialist needed info that wasn't in the spec, sequencing went wrong, a routing rule needs adjusting), append a one-liner to `LESSONS.md`. Specialists record their own domain lessons; this entry is for orchestration patterns.

## Routing decision rules

When the spec is ambiguous about which specialist owns what, use these defaults:

- **Database schema** → Backend Dev (always — DB is server-side)
- **Form validation** → both: Frontend Dev does client-side, Backend Dev does server-side. Always both.
- **File uploads** → Backend Dev owns the upload mechanism (S3 signed URLs etc.); Frontend Dev owns the file-picker UI
- **Authentication** → Backend Dev owns implementation; Frontend Dev owns login UI and protected route handling
- **Third-party APIs** (Stripe, Twilio, Postmark, Calendly, GHL API) → Backend Dev
- **Cron jobs / scheduled tasks** → Backend Dev
- **Layout, styling, brand consistency** → Frontend Dev (consult project brief for brand specs)

If still unsure: dispatch Backend Dev first to scope server-side work, then re-evaluate.

## Cost discipline

- The orchestrator runs on Sonnet/Opus (architectural decisions)
- Builders default to Sonnet/Opus
- Code Reviewer, QA Reviewer, Spec Interpreter all run on Haiku — they're read-and-summarise work
- Compact context at ~60% (`/compact`)
- For research tasks within a specialist's scope (e.g., "what does GHL's API for X look like"), dispatch a Haiku sub-agent and consume only the summary

## Things never to do as orchestrator

- Never build directly — your job is routing
- Never skip the Session Planning Gate — even when the next task feels obvious
- Never skip the Spec Sufficiency Check — even when the title looks self-explanatory
- Never skip Code Reviewer for code-touching tasks — even when the diff looks small
- Never skip QA Reviewer — always last
- Never post Build Outcome without verification evidence in the most recent specialist response
- Never set Monday status to Done

## When a task is too big

If reading the spec makes you think "this is actually 3 tasks," STOP and post on the Monday item:

> "This task spans X, Y, and Z. Recommending we split it into 3 subtasks before building. Approve to split, or proceed as one?"

Splitting before building is dramatically cheaper than refactoring after.

## When a specialist gets stuck

If a specialist returns "I need clarification" and you can't resolve it from the spec or project brief:

1. Don't guess — escalate to the human
2. Move the Monday task to Blocked
3. Fill Blocker Notes with the specific question
4. Wait for human input before resuming

A blocked task is fine. A wrong build is expensive.

## When QA or Code Review fails twice on the same task

Two failures from the same review agent on a task means something deeper is wrong — the spec, the architecture, or the agent's interpretation. Don't dispatch a third time.

1. Stop the iteration
2. Move the Monday task to Blocked
3. Fill Blocker Notes summarising what failed and why a third try won't help
4. Re-run Step 0 (Session Planning Gate) before continuing — the team needs to redirect, not push harder.
