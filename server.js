// server.js — presence API (no external packages)
const http = require("http");
const { URL } = require("url");

const online = new Map();

function sendJson(res, statusCode, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*"
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try {
        if (!raw) return resolve({});
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  if (url.pathname === "/presence" && req.method === "POST") {
    try {
      const body = await parseBody(req);

      const userId = String(body.userId ?? "unknown");
      const username = body.username ?? "unknown";
      const gameId = body.gameId ?? null;
      const placeId = body.placeId ?? null;
      const time = body.time ?? Date.now();

      online.set(userId, { userId, username, gameId, placeId, time });

      console.log(`[Presence] ${username} (${userId}) online in game ${gameId}`);

      sendJson(res, 200, {
        status: "ok",
        online: Array.from(online.values())
      });
    } catch (err) {
      sendJson(res, 400, { status: "error", message: "invalid json" });
    }
    return;
  }

  sendJson(res, 404, { status: "error", message: "not found" });
});

const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`Presence API running on port ${port}`);
});
