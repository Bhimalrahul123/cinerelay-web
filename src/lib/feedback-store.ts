export type FeedbackCategory =
  | "bug"
  | "ticket"
  | "feature"
  | "account"
  | "feedback"
  | "other";

export interface FeedbackSubmission {
  id: string;
  name?: string;
  email?: string;
  category: FeedbackCategory;
  subject: string;
  message: string;
  page_url?: string;
  user_agent?: string;
  created_at: string;
  status: "received" | "in_review" | "resolved";
}

declare global {
  // eslint-disable-next-line no-var
  var __cinerelay_feedback: FeedbackSubmission[] | undefined;
}

if (!globalThis.__cinerelay_feedback) {
  globalThis.__cinerelay_feedback = [];
}

export function addLocalFeedback(
  entry: Omit<FeedbackSubmission, "id" | "created_at" | "status">
): FeedbackSubmission {
  if (!globalThis.__cinerelay_feedback) {
    globalThis.__cinerelay_feedback = [];
  }
  const id = `CR-C${Math.floor(100000 + Math.random() * 900000)}`;
  const item: FeedbackSubmission = {
    ...entry,
    id,
    created_at: new Date().toISOString(),
    status: "received",
  };
  globalThis.__cinerelay_feedback.unshift(item);
  return item;
}

export function getLocalFeedback(): FeedbackSubmission[] {
  return globalThis.__cinerelay_feedback ?? [];
}
