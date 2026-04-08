import { AppraisalDetailClient } from "@/components/appraisal-detail-client";
import { getAppraisal } from "@/lib/appraisal-store";

type Props = { params: Promise<{ id: string }> };

export default async function AppraisalPage({ params }: Props) {
  const { id } = await params;
  const initial = await getAppraisal(id);
  return (
    <AppraisalDetailClient key={id} id={id} initialAppraisal={initial} />
  );
}
