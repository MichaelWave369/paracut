import assert from "node:assert/strict";

import type { RenderPlan } from "../packages/render-core/src/index";
import { renderPlanToWaveForgeBridge } from "../packages/render-core/src/parallax";

const plan: RenderPlan = {
  plan_id: "plan_freshness_005",
  job_id: "job_freshness_005",
  project_id: "project_freshness",
  output_uri: "./exports/freshness.mp4",
  preset: {
    preset_id: "preset_wide_1080p",
    name: "Wide 1080p",
    platform: "wide",
    width: 1920,
    height: 1080,
    fps: 30,
    video_codec: "h264",
    audio_codec: "aac",
    container: "mp4",
  },
  duration_seconds: 12,
  inputs: [],
  clips: [],
  filter_graph: [],
  argv: [],
  warnings: [],
  created_at: "2026-08-25T22:40:00Z",
};

const legacy = renderPlanToWaveForgeBridge(plan, {
  contentHash: `sha256:${"b".repeat(64)}`,
});
assert.equal("planRevision" in legacy, false, "Legacy bridge shape must remain unchanged when no revision is supplied");

const revisioned = renderPlanToWaveForgeBridge(plan, {
  contentHash: `sha256:${"b".repeat(64)}`,
  planRevision: 5,
});
assert.equal(revisioned.planRevision, 5);
assert.equal(revisioned.localOnly, true);
assert.equal(revisioned.requiresUserAction, true);
assert.ok(
  revisioned.compatibilityNotes.some((note) => note.includes("consumers still own accepted-revision state")),
  "Freshness metadata must not be described as consumer state or authority",
);

for (const invalid of [0, -1, 1.5]) {
  assert.throws(
    () => renderPlanToWaveForgeBridge(plan, { planRevision: invalid }),
    /positive integer/,
  );
}

console.log("ParaCut Pass 7 freshness contract smoke passed", {
  projectId: plan.project_id,
  planId: plan.plan_id,
  planRevision: revisioned.planRevision,
  legacyShapePreserved: !("planRevision" in legacy),
});
