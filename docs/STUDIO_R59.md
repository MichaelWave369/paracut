# ParaCut Studio R5.9 — Tool Palette, Razor Targets & JKL Transport

R5.9 adds an explicit fast-editing layer to the existing dual Source/Program workspace, without rewriting the 5-track timeline or changing saved drafts.

## Tool palette

Above the timeline, choose:

- **Selection (V)**: the existing select/drag behavior. Click any clip to select it in Inspector and seek Program to its start. V1/A1 reordering and V2/A2 layer dragging remain.
- **Razor (C)**: click *within* a clip on a **targeted** media track, at the exact horizontal point you want to cut. The click's fraction of that clip's current timeline width maps to a millisecond-rounded project timestamp. The existing core `clip.split` command checks whether the split is legal, writes a receipt, and supports Undo/Redo.

**Track targets:** V1, V2, A1 and A2 buttons toggle whether Razor may cut clips on those tracks. Only V1 is enabled initially. Target buttons do *not* mute tracks, lock editing generally, change exported audio/video, or choose Source Insert/Replace destinations. They are temporary editor preferences; save/reopen drafts do not need a migration. Click another target to cut that lane. Razor mode disables clip dragging to avoid accidental reorder/moves.

The existing **Split (S)** toolbar button still splits the selected clip at Program playhead, independent of these new click targets, preserving earlier workflows. These are two separate controls by design.

**Crossfade safety:** The core rejects V1 cuts inside active crossfades, or too close to a crossfade's incoming/outgoing handles, so a Razor click cannot silently damage a joined transition. Existing V2 joined-clip safety also remains. Cuts less than 0.08 seconds from either clip edge are rejected.

## J/K/L transport

| Key / button | Effect |
|---|---|
| J | Jog Program **one 1/30-second frame backward** and stop playback |
| K | Stop Program playback |
| L | Start Program playback at 1×. Press L again to switch to 2×; repeat to switch back to 1× |
| V | Select tool |
| C | Razor tool |
| I / O | Source Monitor IN / OUT marks (unchanged) |
| S | Split currently selected clip at Program playhead (unchanged) |
| Space | Program play/pause (unchanged) |

Buttons duplicate keyboard controls. Shortcuts are ignored when typing into an input/select or during export. J is **backward frame jog**, not reverse continuous playback or reverse audio decoding. L uses `HTMLMediaElement.playbackRate` for the Program video and preview A1/A2/V2 elements. At 2×, browser audio pitch and multi-decoder synchrony can vary. Returning to stop restores 1×. Exports always use the original clip timing and are independent of the transport speed.

## Guarantees & boundaries

- Existing V1/V2/A1/A2 clips, V1/V2 crossfades, source monitoring, A1/A2 ducking, titles, ledger and both browser and local MP4 render paths continue.
- Every cut is still a `change(state,{type:'clip.split',...})` transaction with normal validation, undo/redo and receipts. Failed cuts do not commit edits.
- Track targets/tool selection and shuttle speed are interface state only; they do not appear in `paracut.studio.draft.v3`, exports or local FFmpeg graph.
- **Not implemented in R5.9:** ripple tool, rolling edit, slip/slide, Pen/keyframes, multiple simultaneous cuts on several tracks, track locks/sync locks, full-speed reverse playback or user-customizable key mappings. These need separate validated semantics, not decorative buttons.

## Acceptance tests

1. Add V1 and V2 video plus A1 music and A2 voiceover. Choose Razor (C), click a V1 clip near the center: it splits at that position and records a receipt.
2. Disable V1 target, enable A2; a V1 Razor click should *not* split, but A2 should. Press V to return to Selection.
3. Create a V1 crossfade and try Razor inside the dissolve. The clip must stay unchanged and show an error.
4. Tap J for single-frame backward jog, K for stop and L for forward 1× / 2×. Test Space and S to ensure earlier keys still work.
5. Undo/Redo, save/reopen the draft and export a movie. Neither target preferences nor playback speed should affect the encoded file.

`scripts/studio-r59-smoke.mjs` checks all four lane split commands, V1 transition safety, receipts/Undo/Redo, draft compatibility, and toolbar/keyboard wiring. CI does **not** replace hands-on testing of high-speed playback synchronization on your PC.
