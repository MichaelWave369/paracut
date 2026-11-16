# ParaCut MP4/WebM export lock-up: inspector DOM mismatch

Physical Chrome evidence showed a valid Framefield WebM, SHA-256 verified,
native Video 1 clip, and both export buttons enabled. Clicking MP4 changed
the button to **Cancel Export**, but did not begin rendering. Console recorded:

```
TypeError: Cannot set properties of null (setting 'hidden')
  at drawInspector (studio.js:1167)
  at render (studio.js:1282)
  at renderVideo (studio.js:2742)
```

**Root cause established from exact source:** inspector uses
`keyframe-opacity-editor` and `keyframe-volume-editor` selectors;
HTML provides `opacity-keyframe-editor` and `volume-keyframe-editor`.
This affects selected V1/V2 clip redraws, including both export formats.

**Secondary lifecycle issue:** `render()` was called after the export
flag changed but *before* `try/catch/finally` began, so a rendering
exception left the export flags stuck, with no actual recording underway.

Repair: use the two existing HTML IDs and run initial export redraw inside
the guarded try block. Existing `finally` restores export flags/buttons
if any new render exception occurs. No checksum, file permission,
media relink, codec or publication gate is relaxed.

Regression smoke checks selectors against HTML and asserts that initial
export redraw is in the error-cleanup scope.

**After reviewed merge and Pages deployment:** save draft before refreshing
any stuck tab; reload ParaCut, open the saved draft and reimport/relink
the unchanged original Framefield WebM. Confirm SHA-256 verified intake on
a fresh project, selected V1 panel, no null-element Console error,
MP4 and WebM exports complete. Keep browser tab visible. CI source checks
do not replace physical Windows Chrome export acceptance.
