# ParaCut v0.7 — Desktop Runtime Wiring

v0.7 adds the first local desktop runtime bridge.

This is not a finished Tauri app yet. It is the tested command layer that a future Tauri shell can call.

## Runtime Boundary

The runtime can:

1. Create an empty desktop runtime state.
2. Open a ParaCut project folder through the file adapter.
3. Save the loaded project back to its attached folder.
4. Save the loaded project as a new folder.
5. Replace the in-memory project after a command mutation and mark the shell dirty.
6. Track the last runtime command ID.

The runtime does not yet:

- Open native file dialogs.
- Render a real app window.
- Copy imported media into a project media folder.
- Execute FFmpeg.
- Manage user settings.

## Command Bridge

The runtime intentionally sits between the UI shell and the file adapter.

```txt
Desktop UI
  -> runtime command
    -> file adapter / project core
      -> updated shell state
        -> visible UI state
```

This keeps the UI from directly owning persistence logic.

## Runtime Commands

- `runtime.create`
- `project.open_folder`
- `project.save`
- `project.save_as`
- `project.replace_in_memory`

## Smoke Test

`pnpm smoke:runtime` proves the loop:

1. Create a sample ParaCut project.
2. Save it to a temp project folder.
3. Open it through the desktop runtime.
4. Verify the shell is clean and attached to a folder.
5. Mutate the loaded project by importing a media reference.
6. Mark the runtime shell dirty.
7. Save the project back to the source folder.
8. Save the project as a second folder.
9. Confirm manifest counts match the updated project.

## Claim Boundary

v0.7 is local command wiring only.

It prepares ParaCut for a real desktop app without claiming that ParaCut is already a usable video editor.
