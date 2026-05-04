# Skill: Slack Protocol

> Defines how the orchestrator and specialists surface status and decisions to the human via Slack. This skill is invoked by the orchestrator at every gate and by specialists at completion. **The chat session is no longer the primary interaction surface — Slack is.**

## When this skill applies

Always when the orchestrator or any specialist needs to:
- Notify the human of progress (Started, QA Pending)
- Request a decision from the human (Spec Sufficiency, Code Review escalation, scope ambiguity)
- Report a blocker or escalation

## The Iron Law applies to Slack messages too

> **If you haven't run the verification command in this message, you cannot claim it passes.**

Slack is just a different surface — the discipline doesn't change. A Slack message claiming "QA Pending — ready for review" must be backed by fresh verification evidence in the same agent response. A Slack post is *part of* the message that makes the claim, not a way to make claims separately from evidence.

## The channel naming convention

One Slack channel per project:
- `#tds-lumen` — Lumen Dental project
- `#tds-hartley` — Hartley Realty project
- `#tds-brightside` — Brightside Studios project

Each project's `CLAUDE.md` declares which channel its orchestrator posts to. **The orchestrator posts only to its own project's channel.** Cross-project posts are forbidden — they break the per-project mental model and the park-and-pivot rule (see below).

## The six message types

Every Slack post falls into exactly one of these categories. Use the prefix verbatim — it's how the human filters their attention.

### 1. STARTED — informational, no reply needed

Posted when the orchestrator picks up a new task autonomously.

```
[<PROJECT>] STARTED: <TASK-CODE> — <Title>

Pathway: <A | B1 | B2 | Spec>
Estimated complexity: <S | M | L>
Why now: <one sentence — priority, dependency, blocker just cleared>

I'll post again when there's a decision to make or when this is QA Pending.
Reply STOP to redirect me to a different task.
```

The human reads this passively. No reply required. The "Reply STOP to redirect" line is genuine — if they reply STOP within the next agent step, the orchestrator stops the dispatch and re-runs Session Planning.

### 2. DECISION NEEDED — requires reply, blocks the current task

Posted when a gate needs a human judgment call. **Always offers concrete options A/B/C with consequences.** Never asks open-ended "what do you think?"

```
[<PROJECT>] DECISION NEEDED: <TASK-CODE> — <topic>

Context:
<1–3 sentences describing the situation and what surfaced it.>

Options:
  A) <option> — <consequence>
  B) <option> — <consequence>
  C) <option> — <consequence>

Recommended: <A/B/C> because <reason>

Reply with A, B, or C.
(No timeout — I'll wait for your reply. While I wait, I'll pick up other 
unblocked tasks in this project. See park-and-pivot rule.)
```

When this is posted:
- The current task is paused at the gate that triggered this
- The orchestrator switches to **park-and-pivot mode** (see below)
- When the human replies A/B/C, the orchestrator resumes the parked task with that decision applied

### 3. CODE REVIEW FAIL — informational on first FAIL, decision-needed on second

Code Reviewer's first FAIL doesn't go to Slack — the orchestrator silently re-dispatches the builder with the findings. Only on the **second consecutive FAIL** does this hit Slack.

```
[<PROJECT>] CODE REVIEW FAIL (2nd): <TASK-CODE>

Builder retried once after first FAIL. Second review still failing.
Common findings across both rounds:
- <finding 1>
- <finding 2>

This is now a DECISION NEEDED. Options:
  A) Hand back to builder for a third try with explicit guidance: <suggestion>
  B) Split task — the scope is too big for one pass
  C) Block — there's a deeper problem (architectural, spec, or stack)

Recommended: <A/B/C> because <reason>

Reply with A, B, or C.
```

This is a Decision Needed under the hood — same park-and-pivot behaviour applies.

### 4. QA PENDING — informational, no reply needed (review at your pace)

Posted when QA Reviewer has APPROVED the task and the orchestrator has posted the Build Outcome to Monday.

```
[<PROJECT>] QA PENDING: <TASK-CODE> — <Title>

Build complete and self-verified. Ready for your final review.
Build Outcome posted on Monday: <URL>
Preview URL (if Pathway A): <URL>

I'll continue to the next task. You can review and flip to Done when convenient.
```

The human reviews on their own schedule. The orchestrator does NOT wait — it picks up the next task.

### 5. BLOCKED — requires reply, blocks the current task

Posted when a real blocker is hit (missing credentials, undocumented external dependency, ambiguous spec the agent genuinely can't resolve).

```
[<PROJECT>] BLOCKED: <TASK-CODE>

Cannot proceed. Reason:
<specific reason — e.g., "Postmark API key required, not yet in env">

What I need from you:
<concrete unblock action>

Monday status moved to Blocked. Blocker Notes filled in.
While I wait, I'll pick up other unblocked tasks in this project.
```

When this is posted:
- Monday task moved to Blocked status
- Park-and-pivot mode: orchestrator works on other unblocked tasks in same project

### 6. ESCALATION — requires reply, may block multiple tasks

Posted when something happens that needs human judgment beyond a single task — e.g., the agent discovers a stack inconsistency, a Monday data error, or a pattern that affects multiple pending tasks.

```
[<PROJECT>] ESCALATION: <topic>

What I noticed:
<specific observation>

What it affects:
<list of tasks that depend on resolution>

Recommended action:
<concrete suggestion>

Reply with how you want me to handle this.
```

This is a free-form decision (not A/B/C) because escalations are by definition not pre-categorisable.

## The park-and-pivot rule

When the orchestrator posts a DECISION NEEDED, BLOCKED, or ESCALATION (the three message types that block the current task), it does NOT sit idle. It picks up the next task in the same project that is **all of:**

- **Unblocked** — no missing dependencies, no missing credentials
- **Independent of the parked task** — doesn't read or write the same file/table/external resource as the parked task
- **In the same project** — never cross-project, even if other projects have urgent work

If no such task exists, then the orchestrator sits idle. That's the only case where idle is acceptable.

When the human replies to the parked decision:
1. Orchestrator finishes the current substep of the pivoted-to task
2. Resumes the parked task with the decision applied
3. Continues normally from there

The pivoted-to task is NOT abandoned — it stays in flight, just suspended at its current step until the parked task is unparked.

## What goes to Slack vs. what stays in chat

| Surface | What appears there |
|---|---|
| **Slack** | Status updates, decisions, blockers, QA-ready notifications |
| **Monday** | Build Outcomes, Build Requirements, task status, blocker notes |
| **Chat session** | (Largely silent during autonomous runs) Used for: initial session start, manual overrides, debugging the agent itself |

The chat session is no longer the primary surface during normal runs. The orchestrator runs autonomously, posts to Slack when it needs the human, and only the human's interaction with Slack drives the next decision.

## Cross-skill coordination

Other skills that interact with Slack should reference this protocol rather than reinvent it:

- **Orchestrator skill** — posts STARTED, DECISION NEEDED, QA PENDING, BLOCKED, ESCALATION
- **Code Reviewer skill** — its FAIL outcomes flow through to Slack via the Orchestrator (Code Reviewer doesn't post directly)
- **QA Reviewer skill** — its APPROVAL flows through to Slack via the Orchestrator
- **Builder skills (Frontend/Backend/GHL)** — never post to Slack directly. Their reports go to the Orchestrator, which decides whether to post.

This single point of Slack contact (the Orchestrator) is what keeps the channel readable.

## Rate limits and good citizenship

- No more than 1 STARTED message per task
- No more than 2 DECISION NEEDED in flight per project at once (more than 2 means the orchestrator is over-asking — pause and bundle decisions)
- QA PENDING goes immediately when ready — don't batch
- Never post a "still working" or "thinking..." message. Silence is the signal that work is happening.

## Things never to do

- Never post to Slack without verification evidence backing a claim (Iron Law)
- Never post DECISION NEEDED without offering A/B/C options with consequences
- Never set Monday status to Done from a Slack reply (humans flip Done; agents only move to QA Pending)
- Never post to a different project's channel
- Never use the chat session to post a status update that should have gone to Slack
- Never assume a Slack reply is binding without re-reading it — humans can change their mind, ask for clarification, or send a "wait" instead of an A/B/C

## When the human replies with something unexpected

If the human's Slack reply isn't a clean A/B/C (e.g., they say "wait, why is option C bad?" or "do D instead"):

1. Don't proceed with the parked task
2. Reply in Slack with the clarification or new option analysis
3. Keep the task parked
4. Continue park-and-pivot on the pivoted-to task
5. Wait for a final A/B/C/D from the human before resuming
