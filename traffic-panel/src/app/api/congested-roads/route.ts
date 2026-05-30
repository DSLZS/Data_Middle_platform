import { NextRequest, NextResponse } from "next/server";

import { getCongestedRoads } from "@/lib/traffic/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "10");
  const result = await getCongestedRoads(limit);
  return NextResponse.json({ success: true, ...result });
}
