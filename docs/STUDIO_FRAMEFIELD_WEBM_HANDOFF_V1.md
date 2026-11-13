# Framefield → ParaCut verified WebM intake (candidate)

FramefieldStudio PR #28 produces a bounded WebM plus unsigned JSON sidecar.
ParaCut's new **Project Media → Framefield Studio** intake requires choosing both
files locally. **Verify exact WebM bytes** checks strict sidecar structure,
false authentication/rights/release flags, size, name, EBML signature and
SHA-256. A second click to **Add verified WebM to Video 1** rehashes,
probes browser-decoded duration, and commits the normal asset/clip/source mute
edits with native ParaCut receipts. Browser drafts retain the unsigned
source digest, never media; relink always rehashes the original WebM.

**Not established:** actual Unreal/Fab source license, complete PixelForge
GLB import or Framefield rigging, source authentication, general WebM codec
compatibility, physical workstation/Quest tests, public release authorization.
Synthetic tests use fake EBML-shaped bytes and do not prove video playback.

Run `node scripts/studio-framefield-handoff-smoke.mjs`,
`pnpm smoke:studio`, `pnpm typecheck`. Then record a real locally
animated clip in Framefield, import the exact files into ParaCut, save/reopen
draft, reject an altered-file relink, export a movie and watch it.
