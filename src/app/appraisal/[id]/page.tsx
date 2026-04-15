import { AppraisalDetailClient } from "@/components/appraisal-detail-client";
import { getAppraisal } from "@/lib/appraisal-store";

/** Always read current appraisal from the store (avoids stale RSC vs list after status changes). */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AppraisalPage({ params }: Props) {
  const { id } = await params;
  const initial = await getAppraisal(id);
  return (
    <AppraisalDetailClient key={id} id={id} initialAppraisal={initial} />
  );
}
