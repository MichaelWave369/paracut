# ParaCut

**The timeline is a ledger.**

ParaCut is a local-first, AI-assisted video editor built around a clean timeline core, reversible edit receipts, creator memory, and human-approved automation.

This repository starts ParaCut as a ground-up build inspired by the open-source creator-editor space, but designed around a Parallax-style ledger spine from day one.

## Product Promise

ParaCut helps creators make videos fast without losing control of their files, edits, style, or provenance.

It is not only a timeline UI. It is a creator workbench where every meaningful action can be saved, replayed, audited, reverted, and exported with context.

## Core Ideas

- **Local-first projects**: project folders remain readable and portable.
- **Timeline as data**: clips, tracks, captions, effects, and exports live in structured project files.
- **Receipts for every edit**: cuts, trims, moves, AI suggestions, approvals, and exports are logged.
- **Human-approved AI**: AI may suggest edits, captions, scenes, or exports, but the creator stays in control.
- **Creator memory**: preferred styles, caption formats, pacing, and export presets can be remembered.
- **Plugin-ready future**: effects, transitions, render presets, caption styles, and AI tools should become modular.

## Initial Build Target

The first real version should do six things well:

1. Import video, audio, and image media.
2. Place clips on a timeline.
3. Cut, trim, move, and delete clips.
4. Save/load a readable project file.
5. Export through a render job definition.
6. Append every action to a receipt log.

## Repository Layout

```txt
paracut/
  apps/
    desktop/          # Future desktop shell
  packages/
    ai-core/          # AI suggestion and approval contracts
    ledger-core/      # Receipt/event model
    media-core/       # Media asset model
    render-core/      # Export/render job model
    timeline-core/    # Timeline state and reducer logic
    ui-kit/           # Shared UI primitives later
  docs/
    MASTER_SPEC.md
    PROJECT_FORMAT.md
    LEDGER_EVENTS.md
    ROADMAP.md
  examples/
    sample-project/
```

## Status

**Stage:** v0.1 scaffold

This repo is not yet a working editor. The first milestone is a clean project/timeline/ledger core that can support a real desktop editor without becoming a tangled UI-first codebase.

## License

MIT. See [LICENSE](./LICENSE).
