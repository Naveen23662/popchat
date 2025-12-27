import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// App setup
const app = express();
const PORT = process.env.PORT || 8081;

// Serve static files (HTML, JS, CSS)
app.use(express.static(__dirname));

// Root route → serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Health check (optional but good)
app.get("/health", (req, res) => {
  res.send("OK");
});

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`✅ PopChat running on port ${PORT}`);
});

// WebSocket server
const wss = new WebSocketServer({ server });

// Simple WebSocket logic (safe default)
wss.on("connection", (ws) => {
  console.log("🔌 Client connected");

  ws.on("message", (msg) => {
    // Echo or signaling placeholder
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === 1) {
        client.send(msg);
      }
    });
  });

  ws.on("close", () => {
    console.log("❌ Client disconnected");
  });
});

