import { NextResponse } from "next/server";
import { readAppraisals } from "@/lib/appraisal-store";

export async function GET() {
  const appraisals = await readAppraisals();
  return NextResponse.json(appraisals);
}
