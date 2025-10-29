const express = require("express");
const path = require("path");
const http = require("http");
const app = express();
const server = http.createServer(app);
const io = require("socket.io")(server);

const PORT = process.env.PORT || 3000;
const staticDir = path.join(__dirname, "src");

app.use(express.static(staticDir));
app.get("*", (req, res) => res.sendFile(path.join(staticDir, "index.html")));

io.on("connection", (socket) => {
  console.log("user connected");
  socket.on("message", (m) => socket.broadcast.emit("message", m));
});

server.listen(PORT, () => console.log("Server running on port", PORT));

