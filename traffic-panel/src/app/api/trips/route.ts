import { NextRequest, NextResponse } from "next/server";

import { getTrips } from "@/lib/traffic/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "16");
  const result = await getTrips(limit);
  return NextResponse.json({ success: true, ...result });
}
