# ParaCut v0.4 File Adapter Layer

## Status

v0.4 adds the first real local project-folder adapter.

ParaCut is still not a working video editor, but it can now save and load its typed project spine from disk-like project folders using Node-backed adapters.

## Purpose

The v0.4 goal is to make ParaCut portable and inspectable before a desktop UI exists.

A ParaCut project folder now has three primary spine files:

```txt
my-project.paracut/
  project.json
  receipts.jsonl
  manifest.json
```

## Files

### `project.json`

Stores current project state:

- project identity
- media library
- timeline tracks and clips
- render jobs
- current embedded ledger snapshot
- metadata

### `receipts.jsonl`

Stores the append-only receipt history as newline-delimited JSON.

Each line is one `LedgerReceipt`.

### `manifest.json`

Stores a small folder-level index:

- folder schema version
- project id
- project name
- file names
- receipt count
- media count
- track count
- render job count

The manifest is intentionally redundant. It gives ParaCut a quick sanity-check surface before a future UI opens or indexes a project.

## Public API

The new `@paracut/file-adapter-core` package exports:

- `getProjectFolderPaths(rootDir)`
- `createProjectFolderManifest(project)`
- `serializeProjectFolderManifest(manifest)`
- `parseProjectFolderManifest(json)`
- `saveProjectFolder(project, rootDir)`
- `loadProjectFolder(rootDir)`

## Load Validation

`loadProjectFolder()` validates:

1. `manifest.json` uses `paracut.folder.v0`.
2. manifest project id matches `project.json`.
3. manifest name matches `project.json`.
4. manifest counts match loaded project/receipt data.
5. `project.json` ledger count matches `receipts.jsonl` count.
6. every receipt belongs to the loaded project id.

This keeps the local-first promise clean: a project folder is readable, but mismatched state cannot silently pass as valid.

## Smoke Test

`pnpm smoke:file` creates a temp folder, builds a small project, queues and plans a render, saves the folder, reloads it, validates counts, and deletes the temp folder.

`pnpm smoke` now runs both:

```bash
pnpm smoke:core
pnpm smoke:file
```

## Boundary

v0.4 does not copy media into the project folder yet.

Media URIs remain references. Future versions should add explicit media-copy, proxy, thumbnail, cache, and render-output adapters.
