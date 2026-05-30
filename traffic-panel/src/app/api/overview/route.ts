import { NextResponse } from "next/server";

import { getOverview } from "@/lib/traffic/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const result = await getOverview();
  return NextResponse.json({ success: true, ...result });
}
