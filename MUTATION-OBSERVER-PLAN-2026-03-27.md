# Mutation Observer Bug Plan (Entered 2026-03-27)

## Scope
This plan addresses only the unchecked bug entered on 2026-03-27 in BUGLIST.md:
- Reprocessing commands/requests due to repeated/lazy mutations.
- Cascading chat noise where RoboKJ-generated messages trigger more processing.
- Need for exactly-once command/request handling in arrival order.

## Current Findings
1. The observer forwards many node updates from subtree mutations, including lazy-rendered fragments and character-data updates, which can point back to already-seen messages.
2. Any marker written to DOM attributes is not durable because W2G can rewrite nodes and remove those attributes.
3. Current dedupe logic is TTL-based (`RECENT_MESSAGE_TTL_MS = 15000`) and not strict exactly-once.
4. The logic has no guaranteed in-order processing queue; processing is callback-driven by mutation timing.
5. `sendToAll` emits plain messages without a RoboKJ token, making it harder to distinguish extension-originated messages from user messages during diagnostics.

## Implementation Strategy

### 1. Convert Observer to Queue-Based Intake
- In `src/content/chat-observer.ts`, stop calling `processMessageElement` directly from each mutation callback.
- Replace with `enqueueCandidateMessage(element)` and a single scheduled flush (`setTimeout(..., 0)` or `requestAnimationFrame`).
- During flush:
1. Normalize candidates to top-level chat message elements.
2. Build one ordered snapshot of visible chat messages.
3. Process a bounded suffix window of messages in display order.
4. Call `processMessageElement` once per candidate in that window.

Outcome: burst mutations collapse into one deterministic processing pass.

### 2. Use Token-Anchored Reverse Windowing
Do not rely on `data-mid`, `data-id`, `data-message-id`, or custom attributes.

Instead, for each flush in `src/content/chat-observer.ts`:
- Start from the end of the chat list (newest messages first).
- Find the most recent RoboKJ tokened message matching `\bAC\d{6}\b`.
- Define the processing window as messages after that anchor token.
- If no anchor is found yet, process only a capped tail window (example: last 30 messages) to avoid deep rescans.
- Reverse this selected subset to oldest-first before dispatch so processing order remains arrival order.

Outcome: we only reconsider the newest region where unprocessed user messages can exist.

### 3. Add Processing State Machine
Track message lifecycle in-memory:
- `pending`: discovered but not yet fully actionable (lazy children still loading).
- `ready`: command or strict request payload can be extracted.
- `dispatched`: sent to background.
- `finalized`: response handled (or intentionally ignored).

Only transition forward, never backward.

Outcome: prevents same message from being dispatched repeatedly while DOM continues mutating.

### 4. Use Sender + Exact Text Key Dedupe
Retain and simplify the old dictionary approach in `src/content/commands.ts`.

Key design:
- Primary dedupe key: `senderW2gId + "|" + exactMessageText`.
- Dictionary value: last-seen timestamp and a small count.
- Apply bounded TTL and max-size cleanup so memory stays stable.

Why this now works better:
- Reverse token anchoring limits the scan region.
- Within that limited region, sender+exact-text checks are sufficient in most realistic chat flows.
- We avoid expensive structural fingerprinting or unstable DOM identity assumptions.

Collision handling:
- If the same sender sends the same exact command again after TTL expiry, treat it as a new intent.
- Keep TTL conservative (example 10-20 seconds) and configurable constant.

### 5. Filter Self-Generated Chat Messages
Before command/request parsing:
- Ignore messages authored by RoboKJ itself (class markers like `w2g-me`, and/or sender identity if available).
- Ignore messages containing RoboKJ token suffix pattern: `\bAC\d{6}\b`.

Outcome: `sendToAll` traffic cannot recursively trigger command/request handling.

### 6. Add Outbound Counter Token and Persist It
Implement tokenization in `src/content/w2g-client.ts`:
- Wrap outbound text as: `<message> AC000001` (incrementing).
- Store current counter in IndexedDB object `KCurrentState`.

Schema proposal:
- Extend DB schema in `src/background/db.ts` with object store `currentState`.
- Add type in `src/types/index.ts`:
  - `interface KCurrentState { sendCounter: number }`
- Add helpers:
  - `getKCurrentState()`
  - `setKCurrentState()`
  - `nextOutboundToken()`

Behavior:
- On startup, initialize `sendCounter = 0` if absent.
- On each `sendToAll`, increment then append formatted token.

### 7. Harden Actionability Checks
In `processMessageElement`:
- Parse once from a normalized payload object: `{ sender, text, timestamp, url, title, isMine }`.
- Process command only when text starts with `/`.
- Process request only when strict URL text exists and provider-expanded link/title is available.
- If payload is incomplete, keep state as `pending`; let later flush retry.

This aligns with the repository lesson: do not dedupe before actionable content is fully available.

### 8. Add Tests and Debug Hooks
Add unit tests for content parsing/dedupe helpers (extract to testable pure functions):
- Same message mutated 10 times -> exactly one dispatch.
- Two different commands in one mutation batch -> preserved order.
- RoboKJ tokened messages -> ignored.
- Lazy-render flow (text first, link later) -> one request dispatch once complete.

Add temporary debug logging behind a flag:
- `enqueued`, `ready`, `dispatched`, `ignored-self`, `duplicate-suppressed`.

## Suggested Rollout Order
1. Queue intake + token-anchored reverse windowing.
2. Sender+exact-text dedupe + self-message filter.
3. Outbound AC token + `KCurrentState` persistence.
4. Payload normalization and pending/ready state handling.
5. Tests and cleanup.

## Acceptance Criteria
1. Each user command/request message is dispatched to background exactly once.
2. Processing order matches chat arrival/DOM order.
3. RoboKJ outbound chat responses do not trigger additional command/request dispatches.
4. Stress case with mutation bursts does not trigger deep rescans of old chat history.
5. AC tokens are monotonic and persisted across reloads.

## Notes
- This plan intentionally does not modify already checked bugs from prior dates.
- The sample HTML in `src/content/working-data/w2g-chat-1.html` should be retained as a fixture reference for parser tests.
