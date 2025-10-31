cd ~/Downloads/popchat
# use bash if zsh errors: run `bash` then paste
cat > server.js <<'NODE'
const express = require('express');
const http = require('http');
const path = require('path');
const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');

const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 10000;
app.use(express.static(path.join(__dirname, 'src')));

// route root to index
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

// simple room pairing: each room holds 2 sockets max
const rooms = {}; // roomId -> [socketId,...]

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  // Join a simple default room "popchat"
  const ROOM = 'popchat';
  socket.join(ROOM);

  // track participants
  if (!rooms[ROOM]) rooms[ROOM] = [];
  rooms[ROOM].push(socket.id);
  // trim to last 2 only
  rooms[ROOM] = rooms[ROOM].slice(-2);

  // emit updated user count
  io.to(ROOM).emit('user-count', rooms[ROOM].length);

  // signaling messages: offer/answer/ice
  socket.on('webrtc-offer', (data) => {
    // forward to specific target or other peer
    if (data.to) {
      io.to(data.to).emit('webrtc-offer', data);
    } else {
      socket.to(ROOM).emit('webrtc-offer', { from: socket.id, sdp: data.sdp });
    }
  });

  socket.on('webrtc-answer', (data) => {
    if (data.to) {
      io.to(data.to).emit('webrtc-answer', data);
    } else {
      socket.to(ROOM).emit('webrtc-answer', { from: socket.id, sdp: data.sdp });
    }
  });

  socket.on('webrtc-ice', (data) => {
    if (data.to) {
      io.to(data.to).emit('webrtc-ice', data);
    } else {
      socket.to(ROOM).emit('webrtc-ice', { from: socket.id, candidate: data.candidate });
    }
  });

  // simple chat message (text)
  socket.on('message', (msg) => {
    socket.broadcast.to(ROOM).emit('message', msg);
  });

  socket.on('disconnect', () => {
    // remove from room array
    rooms[ROOM] = (rooms[ROOM] || []).filter(id => id !== socket.id);
    io.to(ROOM).emit('user-count', rooms[ROOM].length);
    console.log('socket disconnected', socket.id);
  });
});

server.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
NODE

