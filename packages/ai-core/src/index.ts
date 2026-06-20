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
): AssistantSuggestion {
  return {
    ...suggestion,
    status: "approved",
    reviewed_at: reviewedAt,
  };
}

export function rejectSuggestion(
  suggestion: AssistantSuggestion,
  reviewedAt = new Date().toISOString(),
): AssistantSuggestion {
  return {
    ...suggestion,
    status: "rejected",
    reviewed_at: reviewedAt,
  };
}

export function markSuggestionApplied(
  suggestion: AssistantSuggestion,
  reviewedAt = suggestion.reviewed_at ?? new Date().toISOString(),
): AssistantSuggestion {
  if (suggestion.status !== "approved") {
    throw new Error("Only approved suggestions can be marked applied");
  }

  return {
    ...suggestion,
    status: "applied",
    reviewed_at: reviewedAt,
  };
}
