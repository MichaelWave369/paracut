# ParaCut browser export readiness: field integration diagnostic

A Windows Chrome field test demonstrated a valid verified Framefield WebM,
with the source shown as **Ready** on the media shelf and the clip visible on
V1. Both export buttons remained disabled despite browser recording API
support. The last status said `Framefield WebM byte identity confirmed.`.

The previous `render()` routine evaluated export eligibility **after**
many inspector and timeline side effects. A failure there could leave both
buttons disabled from their previous empty-project state. The precise field
cause is not independently confirmed, so do not claim this is a measured
root-cause fix yet.

This change moves the *same strict eligibility gate* ahead of those redraws
and displays an export-readiness message next to the buttons:
- no V1 clip;
- any missing linked timeline source;
- missing browser recording or capture;
- unsupported format;
- ready to export.

It never force-enables export, drops SHA-256 evidence, skips source relink,
or weakens the recording-format checks. A pure test verifies that the
normal verified Video 1 asset + browser capability path enables both
formats and that unlinked sources still refuse export.

## Operator acceptance
1. After approved merge and green Pages deployment, hard refresh ParaCut.
2. In a new project, choose a rights-cleared Framefield WebM and its
   matching unsigned handoff JSON under **Verified WebM Intake**.
3. Click Verify then Add. Confirm shelf Ready, V1 clip, a visible
   **Ready to export** note, and enabled WebM/MP4 buttons.
4. Save draft, export both, and verify duration, starting frame and playback.
5. Open draft with source unlinked; confirm export is disabled with a
   **need relinking** message. Attempt altered bytes; verify SHA-256 rejects.
6. If a UI rendering exception continues, record its exact Console error.
   Moving the gate is not a substitute for fixing that error.

**No assumption of physical-device qualification from CI.**
