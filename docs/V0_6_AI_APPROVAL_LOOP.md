# ParaCut v0.6 AI Approval Loop

ParaCut v0.6 adds the first assistant-review bridge.

The goal is simple: AI can propose useful work, but ParaCut records the proposal and waits for a human decision before the suggestion can be marked applied.

## What landed

- Project state now includes `assistant_suggestions`.
- New projects start with an empty assistant suggestion inbox.
- Older `paracut.project.v0` files are normalized with an empty assistant suggestion list on parse.
- AI proposals are receipt-tracked with `approved_by: "pending"`.
- Human approval is receipt-tracked with `approved_by: "human"`.
- Human rejection is receipt-tracked with `approved_by: "rejected"`.
- Only approved suggestions can be marked applied.
- A new AI approval smoke test covers propose, approve, apply, propose, reject, and rejected-suggestion protection.

## Receipt lifecycle

```txt
ai.suggestion.proposed
  source: ai
  approved_by: pending

ai.suggestion.approved
  source: ai
  approved_by: human

ai.suggestion.rejected
  source: ai
  approved_by: rejected

ai.suggestion.applied
  source: ai
  approved_by: human
```

## Current boundary

v0.6 does not generate real captions, detect scenes, edit audio, or mutate clips from AI payloads yet.

It establishes the governance loop first:

```txt
suggest -> record -> approve/reject -> apply only if approved -> record again
```

That means future adapters can add real captioning, silence detection, scene detection, and short-form clip suggestions without bypassing the human approval ledger.

## Next likely step

v0.7 should either wire the desktop shell to a real runtime or add the first concrete assistant adapter. The safer product path is to keep runtime wiring next, then connect real AI tools after open/save workflows are in place.
