# ParaCut Studio R6.1 — Clip Color Controls

R6.1 introduces functional basic color adjustments on **V1 and V2 clips** within the existing Color workspace and clip Inspector. This is deliberately a small, practical first Effects Controls milestone.

## What works

Select a V1 or V2 video clip in the timeline. In the Inspector's new **Color · Clip Controls**, adjust:

| Control | Range | Neutral |
|---|---|---|
| Brightness | 50–150% | 100% |
| Contrast | 50–150% | 100% |
| Saturation | 0–200% | 100% |
| Warmth | −50 to +50 | 0 |

Press **Apply Color** to commit. **Reset** restores neutral values and also creates an ordinary validated edit receipt. Undo/Redo and saved project JSON retain the settings. Color never changes source files, clip timing, sound or text layers. Imported older drafts with no optional `color` values remain neutral and valid.

### Preview and browser output

V1 and V2 video elements each receive their own CSS filter during Program playback. A V1 crossfade therefore blends two individually corrected moving videos. A V2 dissolve likewise blends individually corrected overlays; title layers are not tinted. Browser WebM and conditional native MP4 recording apply these controls to each original video before composition, using the Canvas 2D filter API.

### Local MP4 output

The opt-in local FFmpeg renderer adds per-source `eq` brightness/contrast/saturation controls, plus `colorbalance` red/blue warmth adjustments. Both the legacy V1/A1 graph and full four-media-lane R5.6 graph support the new settings. Old clips at neutral settings produce no extra video filter. The output still depends on local FFmpeg filter support and installed codec availability.

### Color fidelity limitations

**Browser and FFmpeg results are approximate, not pixel-identical.** CSS brightness is multiplicative whereas FFmpeg `eq` brightness is additive. The browser warmth effect uses a small sepia/hue rotation approximation, whereas FFmpeg adjusts red/blue balances. Neither path is an exposure-calibrated scene-linear workflow. There is no LUT import/export, color-space conversion management, true highlight/shadow wheel, scopes, keyframing or guarantee of preserving HDR/10-bit content. Avoid using the result for color-critical mastering until reviewed in your intended output player.

The four numeric controls are bounded and typed; the project validator rejects unknown filter keys, nonfinite values, unsafe fields and color metadata attached to audio tracks. No user-provided FFmpeg filter expressions, generated shell code, or remote processing.

### Manual acceptance

1. Import two original videos on V1 and create a moving V1 crossfade. Select each clip and give it visibly different saturation/brightness.
2. In the Color workspace, preview their transition: each source should keep its own correction. Select one clip, use Undo/Redo, save/reopen the draft.
3. Add two moving V2 overlays, set individual warmth/contrast, apply a V2 dissolve, then export a short browser WebM or MP4. Titles should retain their original colors.
4. Run the local Windows MP4 exporter and compare the final encode with the Program Monitor. Expect visually similar intent but *not* exact matching. Check source audio was not affected.
5. Press Reset and confirm the effect becomes neutral and remains recorded in the ledger.

`scripts/studio-r61-color-smoke.mjs` checks schema validation, malicious property rejection, legacy draft compatibility, UI wiring, color-graph output, and Undo/Redo. CI cannot replace watching the resulting media on an actual device.
