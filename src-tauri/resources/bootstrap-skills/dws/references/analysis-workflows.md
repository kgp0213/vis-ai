# Evidence-based analysis workflows

## Shared rules

- Query only the minimum sources and time range needed for the request.
- Preserve stable object IDs, source type, author/sender and source timestamp internally while analyzing.
- Cite source type, title/person and time in user-facing conclusions. Do not expose unrelated enterprise content.
- Separate confirmed facts, reported claims, AI inference and missing evidence.
- Treat "not found" as "not visible to the current account in the queried range", not as proof that it does not exist.
- Never submit reports, send messages, create todos, modify calendars or perform approvals from an analysis workflow.

## Topic investigation

Require a topic. Use the user's time range or a conservative recent range. Start with `aisearch enterprise`; then use messages, reports, minutes, drive or wiki only when they can confirm or challenge a material claim. Return an evidence table, confirmed findings, conflicts, gaps and follow-up questions. Stop paging when additional results no longer add distinct evidence.

## Report collection and consistency review

Use `report inbox list`, `report outbox list` and `report entry get`. These commands access DingTalk report/log application entries, not arbitrary documents. Compare visible entries with relevant calendar events, completed todos and meeting minutes. Only identify a missing submitter when the user supplied an expected-person list; otherwise report coverage without claiming completeness.

## Meeting follow-through

Correlate calendar events and minutes using time overlap, normalized title and participants. Add related post-meeting messages and existing todos only when their topic clearly matches. Label uncertain joins. Extract decisions, actions, owner, deadline, dependency and unresolved questions. Missing owner or deadline is a gap, not permission to invent one.

## Response and attention radar

Distinguish direct requests, mentions, ordinary unread content, deadlines and likely unanswered threads. Unread does not imply that a response is required. Merge repeated messages by topic, state why attention may be needed and retain sender/source/time.

## Knowledge candidates

Produce a managed report first. Recommend knowledge promotion only when the result contains durable, reusable conclusions supported by evidence. Exclude routine status snapshots, transient reminders and unsupported speculation. Never write to a workspace selected implicitly at run time.

## Management materials

Render the same evidence into one requested style: leadership brief, weekly project status, risk/blocker list or decision log. Do not create a second collection pass unless evidence is missing. Every material claim must retain a source and time, and AI interpretation must be visibly separate from reported progress.
