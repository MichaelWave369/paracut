# ParaCut Framefield two-file drop intake (candidate)

The **Framefield Studio · Verified WebM Intake** panel now has an explicit local
drop target. Drop the Framefield-produced `<name>.webm` and
`<name>.webm.framefield-handoff.json` together or one at a time.
Alternatively, use the two accessible file selectors.

Dropped files are only staged in browser memory. They do not automatically
launch video decoding, mutate the edit timeline, authorize export or upload.
**Verify exact WebM bytes** is still required; the original strict unsigned
sidecar checks SHA-256, filename, size and false rights/authority flags.
**Add verified WebM to Video 1** is still a distinct explicit action and
rehashes the selected file immediately before adding. Draft reopening must
relink and rehash original media.

Bad extensions, duplicate entries, oversized files and unsupported files
are rejected and the drop selection clears. A changed file invalidates the
prior verification. The separate generic **Import media** remains available
for ordinary clips, but does **not** attach Framefield signed/unsigned receipt
metadata as the guarded importer does.

## Acceptance
1. On a deployed build, drag BOTH original matching files into the Framefield
   intake drop region, confirm both filenames appear and Add is disabled.
2. Click Verify and see SHA-256 MATCHED, then Add to V1. Export controls
   should enable once all referenced sources are linked and recorder is supported.
3. Repeat by dropping one file at a time or using the file pickers.
4. Alter the video bytes or use an incorrect receipt: verification must refuse
   and V1 must not gain a clip.
5. Use ordinary Import media and compare: it imports freely but is NOT a
   guarded SHA-256 Framefield handoff.

CI tests check selection logic and source wiring; they do not simulate real
browser DataTransfer events. A real browser check is required before calling
drag/drop field-qualified.
