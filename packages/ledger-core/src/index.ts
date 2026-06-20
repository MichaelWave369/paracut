export type ReceiptSource = "manual" | "automation" | "ai" | "import" | "render" | "system";

export type ApprovalState = "human" | "policy" | "system" | "pending" | "rejected";

export type ReceiptPayload = Record<string, unknown>;

export interface LedgerReceipt<TPayload extends ReceiptPayload = ReceiptPayload> {
  event_id: string;
  type: string;
  project_id: string;
  source: ReceiptSource;
  approved_by: ApprovalState;
  created_at: string;
  payload: TPayload;
}

export interface CreateReceiptInput<TPayload extends ReceiptPayload = ReceiptPayload> {
  type: string;
  project_id: string;
  source: ReceiptSource;
  approved_by: ApprovalState;
  payload?: TPayload;
  created_at?: string;
  event_id?: string;
}

export function createReceipt<TPayload extends ReceiptPayload = ReceiptPayload>(
  input: CreateReceiptInput<TPayload>,
): LedgerReceipt<TPayload> {
  return {
    event_id: input.event_id ?? createEventId(),
    type: input.type,
    project_id: input.project_id,
    source: input.source,
    approved_by: input.approved_by,
    created_at: input.created_at ?? new Date().toISOString(),
    payload: input.payload ?? ({} as TPayload),
  };
}

export function appendReceipt<TPayload extends ReceiptPayload>(
  ledger: readonly LedgerReceipt[],
  receipt: LedgerReceipt<TPayload>,
): LedgerReceipt[] {
  return [...ledger, receipt];
}

export function toJsonLine(receipt: LedgerReceipt): string {
  return JSON.stringify(receipt);
}

export function fromJsonLine(line: string): LedgerReceipt {
  const parsed = JSON.parse(line) as LedgerReceipt;
  assertReceipt(parsed);
  return parsed;
}

export function assertReceipt(value: LedgerReceipt): void {
  if (!value.event_id) throw new Error("Receipt missing event_id");
  if (!value.type) throw new Error("Receipt missing type");
  if (!value.project_id) throw new Error("Receipt missing project_id");
  if (!value.source) throw new Error("Receipt missing source");
  if (!value.approved_by) throw new Error("Receipt missing approved_by");
  if (!value.created_at) throw new Error("Receipt missing created_at");
  if (typeof value.payload !== "object" || value.payload === null) {
    throw new Error("Receipt payload must be an object");
  }
}

function createEventId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `evt_${Date.now().toString(36)}_${random}`;
}
