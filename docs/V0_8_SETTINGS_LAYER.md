# ParaCut v0.8 — Local Settings Layer

## Status

v0.8 adds the first local app settings layer for ParaCut.

This is not a cloud account system, preference sync service, or full settings UI. It is a typed, local-first `settings.json` contract that future desktop commands and app windows can use.

## What v0.8 Adds

- `packages/settings-core`
- `settings.json` read/write adapter
- Settings normalization and validation
- Default workspace panel preference
- Default export preset preference
- Autosave preference flag
- Recent project folder memory
- Runtime settings load/save bridge
- Runtime recent-project updates when opening or save-as'ing project folders
- Settings smoke test

## Settings Spine

```json
{
  "settings_version": "0.8.0",
  "default_panel": "timeline",
  "default_export_preset_id": "preset_vertical_1080x1920",
  "autosave_enabled": false,
  "max_recent_projects": 10,
  "recent_projects": [],
  "created_at": "...",
  "updated_at": "..."
}
```

## Boundary

v0.8 does not decide where the native app config directory lives. The smoke test passes an explicit settings root directory. A future Tauri/native adapter should choose the real platform path.

v0.8 also does not auto-save projects. It only adds the preference flag and settings persistence contract.

## Why This Matters

ParaCut now has a small creator-memory layer without needing accounts, cloud storage, or a database. The app can remember the creator's preferred panel, export preset, autosave preference, and recent project folders while staying local-first.
