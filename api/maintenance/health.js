import { timingSafeEqual } from "node:crypto";
import { getAdminDb } from "../_lib/firebaseAdmin.js";
import { runProductionHealthCheck } from "../_lib/monitoringAlerts.js";
import { secureApi } from "../_lib/httpSecurity.js";

function authorized(req, secret) {
  const actual = Buffer.from(String(req.headers.authorization || ""));
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export default async function handler(req, res) {
  const security = secureApi(req, res, { methods:["GET"] });
  if (security.handled) return;
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error:"Health schedule is not configured" });
  if (!authorized(req, secret)) return res.status(401).json({ error:"Unauthorized" });
  try {
    return res.status(200).json(await runProductionHealthCheck(getAdminDb()));
  } catch (error) {
    console.error("Production health check failed", error?.message || error);
    return res.status(500).json({ error:"Production health check failed" });
  }
}
