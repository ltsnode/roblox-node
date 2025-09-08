// server.js — presence + simple command relay (no external packages)
const http = require("http");
const { URL } = require("url");

const online = new Map();
let commands = []; // in-memory store of recent commands (time in ms)

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
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  // === Presence ===
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

  // === Post a command ===
  if (url.pathname === "/command" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const entry = {
        userId: String(body.userId ?? "unknown"),
        username: body.username ?? "unknown",
        command: body.command ?? "",
        time: body.time ?? Date.now()
      };

      if (!entry.command || !String(entry.command).trim()) {
        return sendJson(res, 400, { status: "error", message: "no command" });
      }

      commands.push(entry);
      if (commands.length > 200) commands = commands.slice(-200);

      console.log(`[Command] ${entry.username}: ${entry.command}`);

      sendJson(res, 200, { status: "ok" });
    } catch (err) {
      sendJson(res, 400, { status: "error", message: "invalid json" });
    }
    return;
  }

  // === Get commands after a given timestamp (ms) ===
  if (url.pathname === "/commands" && req.method === "GET") {
    const since = parseInt(url.searchParams.get("since") || "0", 10);
    const newCmds = commands.filter(c => Number(c.time) > since);
    return sendJson(res, 200, newCmds);
  }

  // === Not found ===
  sendJson(res, 404, { status: "error", message: "not found" });
});

const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`Presence + Command API running on port ${port}`);
});
