# ParaCut Project Format v0.1

A ParaCut project is a portable folder with readable metadata, media references, timeline state, and an append-only receipt log.

## Folder Layout

```txt
my-project.paracut/
  project.json
  receipts.jsonl
  media/
  proxies/
  thumbnails/
  renders/
  cache/
```

## project.json

```json
{
  "schema": "paracut.project.v0.1",
  "project_id": "project_001",
  "title": "Sample ParaCut Project",
  "created_at": "2026-06-19T12:00:00-07:00",
  "updated_at": "2026-06-19T12:00:00-07:00",
  "settings": {
    "fps": 30,
    "width": 1920,
    "height": 1080,
    "sample_rate": 48000
  },
  "media": [],
  "timeline": {
    "tracks": []
  },
  "exports": []
}
```

## Media Reference

```json
{
  "asset_id": "asset_001",
  "kind": "video",
  "name": "intro.mp4",
  "uri": "media/intro.mp4",
  "hash": "sha256:pending",
  "duration_seconds": 12.4,
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
  "clips": []
}
```

## Timeline Clip

```json
{
  "clip_id": "clip_001",
  "asset_id": "asset_001",
  "track_id": "track_video_001",
  "timeline_start": 0,
  "timeline_end": 10,
  "source_start": 1.2,
  "source_end": 11.2,
  "enabled": true,
  "effects": []
}
```

## receipts.jsonl

The receipt log is newline-delimited JSON. Each line is one append-only event.

```json
{"event_id":"evt_000001","type":"project.created","project_id":"project_001","source":"manual","approved_by":"human","created_at":"2026-06-19T12:00:00-07:00"}
```

## Design Rules

- `project.json` stores current state.
- `receipts.jsonl` stores history.
- Current state should be reconstructable from ledger events in future versions.
- File references should avoid absolute paths when possible.
- Hashes should be used for imported media verification when available.
- Rights metadata should be explicit and conservative.
