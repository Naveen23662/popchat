import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files
app.use(express.static(__dirname));

// --------------------
// WebSocket logic
// --------------------
let waitingUser = null;

wss.on("connection", (ws) => {
  ws.partner = null;

  // Pair users
  if (waitingUser) {
    ws.partner = waitingUser;
    waitingUser.partner = ws;

    ws.send(JSON.stringify({ type: "status", message: "Connected to stranger" }));
    waitingUser.send(JSON.stringify({ type: "status", message: "Connected to stranger" }));

    waitingUser = null;
  } else {
    waitingUser = ws;
    ws.send(JSON.stringify({ type: "status", message: "Waiting for stranger..." }));
  }

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    // Text chat
    if (msg.type === "chat" && ws.partner) {
      ws.partner.send(JSON.stringify({
        type: "chat",
        message: msg.message
      }));
    }

    // Next
    if (msg.type === "next") {
      if (ws.partner) {
        ws.partner.send(JSON.stringify({
          type: "status",
          message: "Stranger disconnected"
        }));
        ws.partner.partner = null;
        waitingUser = ws.partner;
      }
      ws.partner = null;
    }
  });

  ws.on("close", () => {
    if (ws === waitingUser) {
      waitingUser = null;
    }

    if (ws.partner) {
      ws.partner.send(JSON.stringify({
        type: "status",
        message: "Stranger left"
      }));
      ws.partner.partner = null;
      waitingUser = ws.partner;
    }
  });
});

// --------------------
// Catch-all (FIXED)
// --------------------
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// --------------------
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log("PopChat running on port", PORT);
});

