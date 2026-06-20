# ParaCut Master Spec v0.1

**Tagline:** The timeline is a ledger.

## 1. Mission

ParaCut is a local-first, AI-assisted video editor for creators who want speed, ownership, and accountability.

The first principle is simple: every meaningful edit should be represented as structured data and every meaningful action should be recorded as a receipt.

## 2. What ParaCut Is

ParaCut is:

- A timeline editor.
- A project format.
- A receipt ledger.
- A creator-memory system.
- An AI-assisted workflow with human approval.
- A future plugin platform for effects, exports, captions, and media intelligence.

## 3. What ParaCut Is Not Yet

ParaCut v0.1 is not trying to compete with DaVinci Resolve, Premiere, Final Cut, or CapCut feature-for-feature.

The first target is a clean core that can safely grow.

## 4. Core Principles

### Local-first

Projects should be usable as folders on disk. A creator should be able to inspect the project data without needing a remote account.

### Timeline as Data

The timeline is not only UI state. It is a structured model of tracks, clips, timing, effects, captions, and render intent.

### Receipts by Default

Every import, cut, trim, move, text edit, AI suggestion, human approval, and export can become an append-only receipt event.

### Human Approved AI

AI can suggest. Humans approve. ParaCut should clearly mark whether an action came from manual editing, automation, or AI suggestion.

### Reversible Editing

The ledger should make undo/redo, replay, version comparison, and audit trails natural.

### Portable Projects

A ParaCut project should be able to travel between machines with predictable folder conventions and readable JSON files.

## 5. Primary User

The first user is an independent creator making:

- Music videos
- Shorts/Reels/TikToks
- Podcast clips
- Explainers
- Lyric videos
- AI-assisted creative videos
- Demo videos for software/products

## 6. v0.1 Scope

The first milestone should focus on core state, not a polished editor UI.

Required:

- Project model
- Media asset model
- Timeline model
- Ledger event model
- Render job model
- AI suggestion/approval model
- Example project

Deferred:

- Full desktop UI
- Realtime preview engine
- GPU compositor
- Plugin marketplace
- Multi-user cloud collaboration

## 7. System Modules

### ledger-core

Defines receipt events, event authorship, timestamps, source classification, and append-only project history.

### timeline-core

Defines tracks, clips, time ranges, timeline mutations, and pure reducer logic.

### media-core

Defines imported assets, hashes, file references, duration, format, and rights notes.

### render-core

Defines export jobs, platform presets, output dimensions, frame rate, audio settings, and render receipts.

### ai-core

Defines AI suggestions, confidence, model/provider metadata, risk notes, and human approval status.

### ui-kit

Reserved for shared UI primitives.

### apps/desktop

Reserved for the first desktop editor shell.

## 8. Claim Boundary

ParaCut may describe itself as AI-assisted, local-first, receipt-aware, and ledger-backed.

ParaCut should not claim that AI edits are objectively best, that outputs are copyright-cleared, or that provenance receipts create legal ownership by themselves.

## 9. First Definition of Done

ParaCut v0.1 scaffold is considered valid when the repository contains:

- README
- License
- Master spec
- Project format spec
- Ledger event spec
- Roadmap
- TypeScript workspace
- Timeline core contracts
- Ledger core contracts
- Media core contracts
- Render core contracts
- AI core contracts
- Example project with receipt log

## 10. North Star

ParaCut should feel like a creator cockpit:

- Fast enough for daily edits.
- Honest enough for provenance.
- Simple enough for beginners.
- Deep enough for builders.
- Flexible enough to become a platform.
