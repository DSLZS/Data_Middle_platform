import { NextResponse } from "next/server";

import { getMapLayers } from "@/lib/traffic/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const result = await getMapLayers();
  return NextResponse.json({ success: true, ...result });
}
