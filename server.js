const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static("public"));

/* ---------------- CONFIG ---------------- */
const FREE_SKIPS = 3;

/* ---------------- STATE ---------------- */
let males = [];
let females = [];
let others = [];
let pairs = new Map();
let skips = new Map();

/* ---------------- HELPERS ---------------- */
function enqueue(ws) {
  const g = ws.gender;
  if (g === "male") males.push(ws);
  else if (g === "female") females.push(ws);
  else others.push(ws);
}

function dequeue(ws) {
  [males, females, others].forEach(q => {
    const i = q.indexOf(ws);
    if (i !== -1) q.splice(i, 1);
  });
}

function matchUsers() {
  while (males.length && females.length) {
    connect(males.shift(), females.shift());
  }
  while (others.length >= 2) {
    connect(others.shift(), others.shift());
  }
}

function connect(a, b) {
  pairs.set(a, b);
  pairs.set(b, a);
  a.send(JSON.stringify({ type: "match" }));
  b.send(JSON.stringify({ type: "match" }));
}

function disconnect(ws) {
  const peer = pairs.get(ws);
  if (peer) {
    peer.send(JSON.stringify({ type: "disconnect" }));
    pairs.delete(peer);
  }
  pairs.delete(ws);
  dequeue(ws);
}

/* ---------------- WS ---------------- */
wss.on("connection", ws => {
  ws.gender = "other";
  skips.set(ws, FREE_SKIPS);

  ws.on("message", msg => {
    const data = JSON.parse(msg);

    if (data.type === "setGender") {
      ws.gender = data.gender;
    }

    if (data.type === "find") {
      enqueue(ws);
      matchUsers();
    }

    if (data.type === "next") {
      const left = skips.get(ws) ?? 0;
      if (left <= 0) {
        ws.send(JSON.stringify({ type: "paywall" }));
        return;
      }
      skips.set(ws, left - 1);
      ws.send(JSON.stringify({ type: "skips", left: left - 1 }));
      disconnect(ws);
      enqueue(ws);
      matchUsers();
    }

    if (data.type === "chat") {
      const peer = pairs.get(ws);
      if (peer) peer.send(JSON.stringify({ type: "chat", msg: data.msg }));
    }

    if (data.type === "signal") {
      const peer = pairs.get(ws);
      if (peer) peer.send(JSON.stringify(data));
    }
  });

  ws.on("close", () => disconnect(ws));
});

/* ---------------- START ---------------- */
server.listen(8081, () => {
  console.log("PopChat running on http://localhost:8081");
});

