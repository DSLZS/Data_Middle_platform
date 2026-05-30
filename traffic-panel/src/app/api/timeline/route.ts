import { NextResponse } from "next/server";

import { getTimeline } from "@/lib/traffic/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 24);
  const result = await getTimeline(limit);

  return NextResponse.json({ success: true, ...result });
}
