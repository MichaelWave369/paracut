import type { RenderPlan } from "./index";

export interface ParallaxWaveForgeBridgeOptions {
  contentHash?: string | null;
  createdAt?: string;
}

export function renderPlanToWaveForgeBridge(
  plan: RenderPlan,
  options: ParallaxWaveForgeBridgeOptions = {},
) {
  const contentHash = options.contentHash ?? null;
  const createdAt = options.createdAt ?? plan.created_at;
  return {
    schema: "parallax.bridge.v1" as const,
    protocol: "parallax-bridge" as const,
    version: 1 as const,
    transferId: `paracut-waveforge:${plan.plan_id}`,
    source: "ParaCut",
    target: "WaveForgeStudio",
    createdAt,
    localOnly: true,
    payloadType: "application/vnd.paracut.render-plan+json",
    payloadRefOrInline: {
      native: plan,
    },
    contentHash,
    trustLabels: [],
    warnings: contentHash
      ? []
      : ["No render-plan content hash supplied by caller; native plan remains preserved."],
    compatibilityNotes: [
      "Reference-only handoff. WaveForgeStudio must not treat this bridge as render authorization.",
    ],
    lineageRef: null,
    requiresUserAction: true,
  };
}
