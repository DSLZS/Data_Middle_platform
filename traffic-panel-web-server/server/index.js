import express from "express";
import cors from "cors";
import {
  getCongestedRoads,
  getHotspots,
  getMapLayers,
  getOverview,
  getSimulationStats,
  getTimeline,
  getTrips,
  initSimulationData,
  startSimulationWriter
} from "./dataService.js";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/api/overview", (_, res) => {
  res.json({ success: true, data: getOverview() });
});

app.get("/api/timeline", (_, res) => {
  res.json({ success: true, data: getTimeline() });
});

app.get("/api/hotspots", (req, res) => {
  const limit = Number(req.query.limit || 5);
  res.json({ success: true, data: getHotspots(limit) });
});

app.get("/api/congested-roads", (req, res) => {
  const limit = Number(req.query.limit || 10);
  res.json({ success: true, data: getCongestedRoads(limit) });
});

app.get("/api/trips", (req, res) => {
  const limit = Number(req.query.limit || 10);
  res.json({ success: true, data: getTrips(limit) });
});

app.get("/api/map-layers", (_, res) => {
  res.json({ success: true, data: getMapLayers() });
});

app.get("/api/health", (_, res) => {
  res.json({ success: true, message: "ok", data: getSimulationStats() });
});

app.get("/api/simulation/stats", (_, res) => {
  res.json({ success: true, data: getSimulationStats() });
});

initSimulationData();
startSimulationWriter();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Traffic mock server listening on http://localhost:${port}`);
});
