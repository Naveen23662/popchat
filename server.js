// server.js — PopChat Signaling + Static Server
// Works locally and on Render

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();

// ✅ Serve frontend files from /public
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// In-memory waiting queue for random pairing
let waiting = null;

// Helper: safely send JSON messages
function send(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// Handle new WebSocket connections
wss.on('connection', (ws) => {
  ws.id = Math.random().toString(36).substring(2, 9);
  ws.partner = null;
  console.log(`🟢 Client connected: ${ws.id}`);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.warn('Invalid JSON message received');
      return;
    }

    switch (msg.type) {
      case 'join':
        console.log(`👥 ${ws.id} wants to join`);
        // If someone is waiting, pair them
        if (waiting && waiting !== ws) {
          ws.partner = waiting;
          waiting.partner = ws;

          send(ws, { type: 'paired', partner: waiting.id });
          send(waiting, { type: 'paired', partner: ws.id });

          console.log(`✅ Paired ${ws.id} with ${waiting.id}`);
          waiting = null;
        } else {
          // Otherwise, mark this user as waiting
          waiting = ws;
          send(ws, { type: 'waiting' });
          console.log(`⌛ ${ws.id} is waiting for a partner...`);
        }
        break;

      case 'offer':
      case 'answer':
      case 'ice':
        if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
          send(ws.partner, msg);
        }
        break;

      case 'leave':
        if (ws.partner) {
          send(ws.partner, { type: 'leave' });
          ws.partner.partner = null;
          ws.partner = null;
        }
        if (waiting === ws) waiting = null;
        break;

      default:
        console.warn('⚠️ Unknown message type:', msg.type);
    }
  });

  ws.on('close', () => {
    console.log(`🔴 Client disconnected: ${ws.id}`);
    if (ws.partner) {
      send(ws.partner, { type: 'leave' });
      ws.partner.partner = null;
    }
    if (waiting === ws) waiting = null;
  });
});

// ✅ Start server (Render automatically injects PORT)
server.listen(PORT, () => {
  console.log(`🚀 PopChat signaling server running on port ${PORT}`);
});

