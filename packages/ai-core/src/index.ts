export type AssistantSuggestionKind =
  | "caption"
  | "silence_removal"
  | "scene_split"
  | "shorts_candidate"
  | "title_card"
  | "thumbnail_frame"
  | "music_sync"
  | "effect";

export type AssistantSuggestionStatus = "draft" | "approved" | "rejected" | "applied";

export interface AssistantSuggestion {
  suggestion_id: string;
  project_id: string;
  kind: AssistantSuggestionKind;
  status: AssistantSuggestionStatus;
  summary: string;
  rationale: string;
  payload: Record<string, unknown>;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  review_note?: string;
  applied_at?: string;
  applied_by?: string;
}

export interface CreateAssistantSuggestionInput {
  suggestion_id: string;
  project_id: string;
  kind: AssistantSuggestionKind;
  summary: string;
  rationale?: string;
  payload?: Record<string, unknown>;
  created_at?: string;
}

export interface AssistantSuggestionReviewInput {
  reviewed_at?: string;
  reviewed_by?: string;
  review_note?: string;
}

export interface AssistantSuggestionApplyInput {
  applied_at?: string;
  applied_by?: string;
}

export function createAssistantSuggestion(input: CreateAssistantSuggestionInput): AssistantSuggestion {
  if (!input.suggestion_id) throw new Error("Suggestion requires suggestion_id");
  if (!input.project_id) throw new Error("Suggestion requires project_id");
  if (!input.summary) throw new Error("Suggestion requires summary");

  return {
    suggestion_id: input.suggestion_id,
    project_id: input.project_id,
    kind: input.kind,
    status: "draft",
    summary: input.summary,
    rationale: input.rationale ?? "No rationale supplied.",
    payload: input.payload ?? {},
    created_at: input.created_at ?? new Date().toISOString(),
  };
}

export function approveSuggestion(
  suggestion: AssistantSuggestion,
  reviewedAt = new Date().toISOString(),
  reviewedBy = "human",
  reviewNote?: string,
): AssistantSuggestion {
  if (suggestion.status !== "draft") {
    throw new Error(`Only draft suggestions can be approved. Current status: ${suggestion.status}`);
  }

  return {
    ...suggestion,
    status: "approved",
    reviewed_at: reviewedAt,
    reviewed_by: reviewedBy,
    ...(reviewNote ? { review_note: reviewNote } : {}),
  };
}

export function rejectSuggestion(
  suggestion: AssistantSuggestion,
  reviewedAt = new Date().toISOString(),
  reviewedBy = "human",
  reviewNote?: string,
): AssistantSuggestion {
  if (suggestion.status !== "draft") {
    throw new Error(`Only draft suggestions can be rejected. Current status: ${suggestion.status}`);
  }

  return {
    ...suggestion,
    status: "rejected",
    reviewed_at: reviewedAt,
    reviewed_by: reviewedBy,
    ...(reviewNote ? { review_note: reviewNote } : {}),
  };
}

export function markSuggestionApplied(
  suggestion: AssistantSuggestion,
  appliedAt = new Date().toISOString(),
  appliedBy = "human",
): AssistantSuggestion {
  if (suggestion.status !== "approved") {
    throw new Error("Only approved suggestions can be marked applied");
  }

  return {
    ...suggestion,
    status: "applied",
    applied_at: appliedAt,
    applied_by: appliedBy,
  };
}
