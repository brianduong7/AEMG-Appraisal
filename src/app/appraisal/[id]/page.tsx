import { AppraisalDetailClient } from "@/components/appraisal-detail-client";
import { resolveActor } from "@/lib/appraisal-actor";
import { getById } from "@/lib/appraisal-source";

/** Always read current appraisal from the store (avoids stale RSC vs list after status changes). */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AppraisalPage({ params }: Props) {
  const { id } = await params;
  // Server component: no demo id available here (that lives in the client's
  // localStorage), so a demo session resolves to no actor and falls through
  // to the local store. The client re-fetches through /api/appraisals/[id]
  // with its own identity immediately on mount, so this only affects the
  // first paint, never what is finally shown.
  const actor = await resolveActor(null);
  const initial = await getById(actor, id).catch(() => null);
  return (
    <AppraisalDetailClient key={id} id={id} initialAppraisal={initial} />
  );
}
