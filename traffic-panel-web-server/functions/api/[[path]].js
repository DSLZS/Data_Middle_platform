import {
  getCongestedRoads,
  getHotspots,
  getMapLayers,
  getOverview,
  getSimulationStats,
  getTimeline,
  getTrips
} from "../_lib/dataService.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders
    }
  });
}

export const onRequestOptions = () => new Response(null, { headers: corsHeaders });

export function onRequestGet(context) {
  const { pathname, searchParams } = new URL(context.request.url);

  if (pathname === "/api/overview") {
    return json({ success: true, data: getOverview() });
  }

  if (pathname === "/api/timeline") {
    return json({ success: true, data: getTimeline() });
  }

  if (pathname === "/api/hotspots") {
    const limit = Number(searchParams.get("limit") || 5);
    return json({ success: true, data: getHotspots(limit) });
  }

  if (pathname === "/api/congested-roads") {
    const limit = Number(searchParams.get("limit") || 10);
    return json({ success: true, data: getCongestedRoads(limit) });
  }

  if (pathname === "/api/trips") {
    const limit = Number(searchParams.get("limit") || 10);
    return json({ success: true, data: getTrips(limit) });
  }

  if (pathname === "/api/map-layers") {
    return json({ success: true, data: getMapLayers() });
  }

  if (pathname === "/api/health") {
    return json({ success: true, message: "ok", data: getSimulationStats() });
  }

  if (pathname === "/api/simulation/stats") {
    return json({ success: true, data: getSimulationStats() });
  }

  return json({ success: false, message: "Not Found" }, 404);
}
