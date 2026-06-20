# ParaCut Project Format v0.6

A ParaCut project is a portable local folder with readable current state, an append-only receipt log, assistant suggestion state, and a small manifest for fast validation.

## Folder Layout

```txt
my-project.paracut/
  project.json
  receipts.jsonl
  manifest.json
  media/        # future copied/imported media storage
  proxies/      # future generated proxy media
  thumbnails/   # future generated thumbnails
  renders/      # future render outputs
  cache/        # future disposable working cache
```

v0.4+ writes and reads the three spine files only:

- `project.json`
- `receipts.jsonl`
- `manifest.json`

Media files are not copied yet. Media assets currently store URI references.

## project.json

`project.json` stores current state.

```json
{
  "project_id": "project_001",
  "name": "Sample ParaCut Project",
  "schema_version": "paracut.project.v0",
  "created_at": "2026-06-19T12:00:00.000-07:00",
  "updated_at": "2026-06-19T12:00:00.000-07:00",
  "media": {
    "assets": []
  },
  "timeline": {
    "tracks": []
  },
  "ledger": [],
  "render_jobs": [],
  "assistant_suggestions": [],
  "metadata": {}
}
```

Older `paracut.project.v0` files without `assistant_suggestions` are normalized to an empty assistant suggestion list when parsed.

## receipts.jsonl

`receipts.jsonl` stores history as newline-delimited JSON. Each line is one receipt.

```json
{"event_id":"evt_000001","type":"project.created","project_id":"project_001","source":"system","approved_by":"human","created_at":"2026-06-19T12:00:00.000-07:00","payload":{"name":"Sample ParaCut Project"}}
```

## manifest.json

`manifest.json` stores a small folder-level sanity index.

```json
{
  "schema_version": "paracut.folder.v0",
  "project_id": "project_001",
  "name": "Sample ParaCut Project",
  "created_at": "2026-06-19T12:00:00.000-07:00",
  "updated_at": "2026-06-19T12:00:00.000-07:00",
  "files": {
    "project": "project.json",
    "receipts": "receipts.jsonl",
    "manifest": "manifest.json"
  },
  "counts": {
    "receipts": 1,
    "media_assets": 0,
    "tracks": 0,
    "render_jobs": 0
  }
}
```

## Media Reference

```json
{
  "asset_id": "asset_001",
  "kind": "video",
  "name": "intro.mp4",
  "uri": "file://media/intro.mp4",
  "duration_seconds": 12.4,
  "imported_at": "2026-06-19T12:00:00.000-07:00",
  "metadata": {
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "codec": "h264"
  },
  "rights_note": "User imported media. Rights not verified by ParaCut."
}
```

## Timeline Track

```json
{
  "track_id": "track_video_001",
  "kind": "video",
  "name": "Video 1",
  "locked": false,
  "muted": false,
  "clips": []
}
```

## Timeline Clip

```json
{
  "clip_id": "clip_001",
  "asset_id": "asset_001",
  "track_id": "track_video_001",
  "timeline": {
    "start": 0,
    "end": 10
  },
  "source": {
    "start": 1.2,
    "end": 11.2
  },
  "enabled": true,
  "effects": []
}
```

## Assistant Suggestion

```json
{
  "suggestion_id": "sug_001",
  "project_id": "project_001",
  "kind": "caption",
  "status": "draft",
  "summary": "Add an intro caption card.",
  "rationale": "The opening beat needs context.",
  "payload": {
    "caption_text": "Welcome to ParaCut",
    "target_timeline_seconds": 0
  },
  "created_at": "2026-06-19T12:00:00.000-07:00"
}
```

Suggestion status values:

```txt
draft     Proposed by AI, awaiting review
approved  Human approved but not yet applied
rejected  Human rejected
applied   Approved suggestion marked applied
```

## Design Rules

- `project.json` stores current state.
- `receipts.jsonl` stores history.
- `manifest.json` stores quick validation metadata.
- Assistant suggestions must be receipt-tracked when proposed, approved, rejected, or applied.
- Current state should be reconstructable from ledger events in future versions.
- File references should avoid absolute paths when possible.
- Hashes should be used for imported media verification when available.
- Rights metadata should be explicit and conservative.
- Loaders should fail loudly when project state and receipt logs disagree.
