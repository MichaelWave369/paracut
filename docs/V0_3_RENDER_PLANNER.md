# ParaCut v0.3 Render Planner

**Status:** Scaffold / non-executing render contract

v0.3 adds the first render-planning layer. The planner does not execute FFmpeg yet. It converts a queued render job, the current timeline, and the media library into an inspectable command plan.

This keeps ParaCut's core promise intact:

> The timeline is a ledger.

Before ParaCut writes an output file, the system should be able to show what it intends to render, which inputs it will use, which clips are involved, which preset applies, which warnings exist, and which receipt records the planning step.

## What landed

- `RenderPlan` contract in `packages/render-core`
- input inventory from timeline clips and media assets
- normalized render-plan clip list
- FFmpeg-style argument planner
- command-preview serializer
- render-plan warnings
- project-level `render.plan.created` receipt
- smoke test coverage for queueing and planning a vertical render

## Render plan shape

A render plan includes:

- `plan_id`
- `job_id`
- `project_id`
- `output_uri`
- `preset`
- `duration_seconds`
- `inputs`
- `clips`
- `filter_graph`
- `argv`
- `warnings`
- `created_at`

The `argv` field is a command plan, not an execution promise.

## Current safety boundary

v0.3 does **not** render files. It only creates a plan.

That boundary is intentional. The next layers should be:

1. validate plan
2. approve plan
3. execute plan through a bounded adapter
4. capture output metadata
5. write completion/failure receipts

## Receipt added

When `planRenderJobForProject` is called, the project ledger receives:

```json
{
  "type": "render.plan.created",
  "source": "render",
  "approved_by": "human",
  "payload": {
    "job_id": "render_vertical_test",
    "plan_id": "plan_render_vertical_test",
    "preset_id": "preset_vertical_1080x1920",
    "output_uri": "file://exports/paracut-smoke.mp4",
    "duration_seconds": 13,
    "input_count": 1,
    "clip_count": 2,
    "warning_count": 0
  }
}
```

## Why this matters

A normal editor often hides the render pipeline behind a button.

ParaCut should make that pipeline visible:

- what media was used
- what timeline state was rendered
- what preset was used
- what warnings existed
- what command plan was generated
- what human or system approved it

That is the difference between a normal export and a receipt-backed creative workflow.
