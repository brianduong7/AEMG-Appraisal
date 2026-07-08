import type { Metadata } from "next";
import { BranchManagerCommentForm } from "@/components/branch-manager-comment-form";

export const metadata: Metadata = {
  title: "Branch manager feedback | AEMG Appraisal",
  description: "Demo form for branch manager appraisal feedback",
};

export default function BranchManagerCommentFormPage() {
  return <BranchManagerCommentForm />;
}
