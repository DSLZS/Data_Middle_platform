import { NextResponse } from "next/server";

import { getTimeline } from "@/lib/traffic/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const result = await getTimeline();
  return NextResponse.json({ success: true, ...result });
}
