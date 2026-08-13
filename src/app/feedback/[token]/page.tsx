import type { Metadata } from "next";
import { FeedbackResponseForm } from "@/components/feedback-response-form";

export const metadata: Metadata = {
  title: "Feedback request | AEMG Appraisal",
  description: "Provide requested feedback on an employee's appraisal",
  // Reviewers are outside parties reaching a tokened URL; keep these pages
  // out of search indexes even if a link is ever pasted somewhere public.
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

export default async function FeedbackRequestPage({ params }: Props) {
  const { token } = await params;
  return <FeedbackResponseForm token={token} />;
}
