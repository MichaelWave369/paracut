# ParaCut Ledger Events v0.6

ParaCut uses receipts to record meaningful project actions.

The ledger is append-only by default. State can be derived from the project file now and replayed from receipts in later versions.

## Event Shape

```json
{
  "event_id": "evt_000001",
  "type": "clip.cut",
  "project_id": "project_001",
  "source": "manual",
  "approved_by": "human",
  "created_at": "2026-06-19T12:00:00-07:00",
  "payload": {}
}
```

## Required Fields

| Field | Meaning |
|---|---|
| `event_id` | Stable ID for this receipt. |
| `type` | Namespaced event type. |
| `project_id` | Project the event belongs to. |
| `source` | Manual, automation, AI, import, render, system. |
| `approved_by` | Human, policy, system, pending, or rejected. |
| `created_at` | ISO timestamp. |
| `payload` | Event-specific data. |

## Event Sources

```txt
manual      Human direct action
automation  Non-AI automated workflow
ai          AI-generated suggestion or action
import      Media/project import process
render      Export/render process
system      Internal system event
```

## Approval States

```txt
human       Human approved or directly performed
policy      Allowed by explicit project policy
system      System-generated bookkeeping
pending     Proposed but not accepted yet
rejected    Proposed and rejected
```

## Core Event Types

### Project

- `project.created`
- `project.opened`
- `project.saved`
- `project.settings.updated`

### Media

- `media.imported`
- `media.hash.computed`
- `media.proxy.created`
- `media.thumbnail.created`
- `media.rights_note.updated`

### Timeline

- `track.created`
- `track.renamed`
- `track.deleted`
- `clip.added`
- `clip.moved`
- `clip.trimmed`
- `clip.split`
- `clip.cut`
- `clip.deleted`
- `clip.enabled`
- `clip.disabled`

### Captions and Text

- `caption.added`
- `caption.edited`
- `caption.deleted`
- `text.added`
- `text.edited`
- `text.deleted`

### Effects

- `effect.added`
- `effect.updated`
- `effect.removed`

### AI

- `ai.suggestion.proposed`
- `ai.suggestion.approved`
- `ai.suggestion.rejected`
- `ai.suggestion.applied`
- `ai.caption.generated`
- `ai.scene.detected`
- `ai.silence.detected`

### Render

- `render.queued`
- `render.plan.created`
- `render.started`
- `render.completed`
- `render.failed`

## Example: Clip Split

```json
{
  "event_id": "evt_000042",
  "type": "clip.split",
  "project_id": "project_001",
  "source": "manual",
  "approved_by": "human",
  "created_at": "2026-06-19T12:00:00-07:00",
  "payload": {
    "clip_id": "clip_001",
    "at": 12.482,
    "left_clip_id": "clip_001a",
    "right_clip_id": "clip_001b"
  }
}
```

## Example: AI Suggestion Proposed

```json
{
  "event_id": "evt_000087",
  "type": "ai.suggestion.proposed",
  "project_id": "project_001",
  "source": "ai",
  "approved_by": "pending",
  "created_at": "2026-06-19T12:00:00-07:00",
  "payload": {
    "suggestion_id": "sug_001",
    "kind": "caption",
    "status": "draft",
    "summary": "Add an intro caption card.",
    "rationale": "The opening beat needs context."
  }
}
```

## Boundary

A receipt proves what ParaCut recorded. It does not automatically prove legal ownership, authorship, copyright clearance, or external truth. Those claims require separate evidence.
