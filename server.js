// server.js — PopChat signaling server + static serving (paired role assignment)
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
let waiting = null;

function send(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

wss.on('connection', (ws) => {
  ws.id = Math.random().toString(36).substring(2, 9);
  ws.partner = null;
  console.log('🟢 Client connected:', ws.id);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'join':
        console.log(`👥 ${ws.id} join`);
        // If someone is waiting, pair them and assign roles:
        if (waiting && waiting !== ws) {
          // waiting is the older client — make the NEW client the initiator (creates offer)
          ws.partner = waiting;
          waiting.partner = ws;

          // send paired info with initiator flag
          send(ws, { type: 'paired', initiator: true, partner: waiting.id });
          send(waiting, { type: 'paired', initiator: false, partner: ws.id });

          console.log(`✅ Paired ${ws.id} (initiator) <-> ${waiting.id} (answerer)`);
          waiting = null;
        } else {
          // no one waiting, mark this ws as waiting
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
        console.warn('Unknown message type:', msg.type);
    }
  });

  ws.on('close', () => {
    console.log('🔴 Client disconnected:', ws.id);
    if (ws.partner) {
      send(ws.partner, { type: 'leave' });
      ws.partner.partner = null;
    }
    if (waiting === ws) waiting = null;
  });

  ws.on('error', (e) => console.warn('WS error', e));
});

server.listen(PORT, () => {
  console.log(`🚀 PopChat signaling server running on port ${PORT}`);
});

