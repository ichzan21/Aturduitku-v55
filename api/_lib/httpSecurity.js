const PRODUCTION_ORIGINS = new Set([
  "https://aturduitku.com",
  "https://www.aturduitku.com",
]);

function configuredOrigins() {
  const origins = new Set(PRODUCTION_ORIGINS);
  String(process.env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .forEach((origin) => origins.add(origin));

  [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
    .filter(Boolean)
    .forEach((host) => origins.add(`https://${host}`));

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:5173");
    origins.add("http://127.0.0.1:5173");
  }
  return origins;
}

export function secureApi(req, res, options = {}) {
  const methods = options.methods || ["GET"];
  const allowHeaders = options.allowHeaders || ["Content-Type", "Authorization"];
  const origin = String(req.headers.origin || "");
  const originAllowed = !origin || configuredOrigins().has(origin);

  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", [...methods, "OPTIONS"].join(", "));
  res.setHeader("Access-Control-Allow-Headers", allowHeaders.join(", "));

  if (origin && originAllowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  if (!originAllowed) {
    res.status(403).json({ error: "Origin not allowed" });
    return { handled: true, originAllowed: false };
  }

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return { handled: true, originAllowed: true };
  }

  return { handled: false, originAllowed: true };
}

export function assertJsonSize(body, maxBytes = 96_000) {
  let size = 0;
  try {
    size = Buffer.byteLength(JSON.stringify(body || {}), "utf8");
  } catch {
    const error = new Error("Invalid JSON payload");
    error.status = 400;
    throw error;
  }
  if (size > maxBytes) {
    const error = new Error("Payload terlalu besar");
    error.status = 413;
    throw error;
  }
  return size;
}
