import {
  applyApprovedAssistantSuggestionForProject,
  approveAssistantSuggestionForProject,
  createProject,
  getProjectAssistantSuggestion,
  proposeAssistantSuggestionForProject,
  rejectAssistantSuggestionForProject,
} from "../packages/project-core/src/index";

function expectEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function expectTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function expectThrows(fn: () => unknown, message: string): void {
  try {
    fn();
  } catch {
    return;
  }

  throw new Error(message);
}

let project = createProject({
  project_id: "ai_approval_smoke_project",
  name: "AI Approval Smoke Project",
  created_at: "2026-06-19T12:00:00.000Z",
});

project = proposeAssistantSuggestionForProject(project, {
  suggestion_id: "sug_caption_intro",
  kind: "caption",
  summary: "Add an intro caption card for the first scene.",
  rationale: "The opening clip has no visible context for the viewer.",
  payload: {
    caption_text: "Welcome to ParaCut",
    target_timeline_seconds: 0,
    duration_seconds: 3,
  },
  created_at: "2026-06-19T12:01:00.000Z",
});

let suggestion = getProjectAssistantSuggestion(project, "sug_caption_intro");
if (!suggestion) throw new Error("Expected proposed suggestion to exist");

expectEqual(project.assistant_suggestions.length, 1, "Project should store proposed assistant suggestion");
expectEqual(suggestion.status, "draft", "New assistant suggestion should start as draft");
expectEqual(project.ledger.at(-1)?.type, "ai.suggestion.proposed", "Proposal should create a receipt");
expectEqual(project.ledger.at(-1)?.approved_by, "pending", "Proposal receipt should be pending");
expectEqual(project.ledger.at(-1)?.source, "ai", "Proposal receipt should come from AI source");

project = approveAssistantSuggestionForProject(project, "sug_caption_intro", {
  reviewed_at: "2026-06-19T12:02:00.000Z",
  reviewed_by: "michael",
  review_note: "Looks useful for the opening beat.",
});

suggestion = getProjectAssistantSuggestion(project, "sug_caption_intro");
if (!suggestion) throw new Error("Expected approved suggestion to exist");

expectEqual(suggestion.status, "approved", "Suggestion should be approved after human review");
expectEqual(suggestion.reviewed_by, "michael", "Approval should preserve reviewer");
expectEqual(project.ledger.at(-1)?.type, "ai.suggestion.approved", "Approval should create a receipt");
expectEqual(project.ledger.at(-1)?.approved_by, "human", "Approval receipt should be human-approved");

project = applyApprovedAssistantSuggestionForProject(project, "sug_caption_intro", {
  applied_at: "2026-06-19T12:03:00.000Z",
  applied_by: "michael",
});

suggestion = getProjectAssistantSuggestion(project, "sug_caption_intro");
if (!suggestion) throw new Error("Expected applied suggestion to exist");

expectEqual(suggestion.status, "applied", "Approved suggestion should be markable as applied");
expectEqual(suggestion.applied_by, "michael", "Application should preserve applier");
expectEqual(project.ledger.at(-1)?.type, "ai.suggestion.applied", "Application should create a receipt");

project = proposeAssistantSuggestionForProject(project, {
  suggestion_id: "sug_silence_trim",
  kind: "silence_removal",
  summary: "Remove a silent gap before the second beat.",
  rationale: "The detected silence may slow the pacing.",
  payload: {
    target_range_seconds: { start: 4.2, end: 5.8 },
  },
  created_at: "2026-06-19T12:04:00.000Z",
});

project = rejectAssistantSuggestionForProject(project, "sug_silence_trim", {
  reviewed_at: "2026-06-19T12:05:00.000Z",
  reviewed_by: "michael",
  review_note: "Keep the pause for dramatic timing.",
});

const rejected = getProjectAssistantSuggestion(project, "sug_silence_trim");
if (!rejected) throw new Error("Expected rejected suggestion to exist");

expectEqual(rejected.status, "rejected", "Rejected suggestion should stay rejected");
expectEqual(project.ledger.at(-1)?.type, "ai.suggestion.rejected", "Rejection should create a receipt");
expectEqual(project.ledger.at(-1)?.approved_by, "rejected", "Rejection receipt should be marked rejected");

expectThrows(
  () => applyApprovedAssistantSuggestionForProject(project, "sug_silence_trim"),
  "Rejected suggestions should not be applicable",
);

expectEqual(project.assistant_suggestions.length, 2, "Project should retain both assistant suggestions");
expectEqual(project.ledger.length, 6, "AI approval smoke project should have six receipts");
expectTrue(
  project.ledger.some((receipt) => receipt.type === "ai.suggestion.approved"),
  "Ledger should include an AI approval receipt",
);
expectTrue(
  project.ledger.some((receipt) => receipt.type === "ai.suggestion.rejected"),
  "Ledger should include an AI rejection receipt",
);

console.log("ParaCut AI approval smoke test passed.");
