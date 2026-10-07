import http from 'node:http';
import { Server } from 'socket.io';
import { buildApp, verifyToken, saveMessage } from './app.js';
import { users } from './store.js';

const PORT = process.env.PORT || 4000;

let io;
const pushMessage = (msg) => io?.to(msg.to).to(msg.from).emit('chat:message', msg);

const app = buildApp({ onMessage: pushMessage });
const server = http.createServer(app);
io = new Server(server, { cors: { origin: '*' } });

// Each user joins a private room named after their id. Messages are sent to the
// receiver's room and echoed back to the sender, so contact details never leave the app.
io.use((socket, next) => {
  try {
    const user = verifyToken(socket.handshake.auth?.token || '');
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = user;
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  const me = socket.data.user;
  socket.join(me.id);

  socket.on('chat:send', ({ to, text } = {}, ack) => {
    const value = String(text || '').trim();
    if (!to || !value) return ack?.({ error: 'to and text required' });
    if (!users.has(to) || to === me.id) return ack?.({ error: 'Invalid receiver' });
    const msg = saveMessage(me.id, to, value);
    pushMessage(msg);
    ack?.({ ok: true, message: msg });
  });
});

// Listening without a host accepts both IPv4 and IPv6, which avoids the
// "localhost resolves to ::1" problem on some Windows machines.
server.listen(PORT, () => console.log(`UniNest API on http://localhost:${PORT}`));
