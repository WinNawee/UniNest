// Live chat over Socket.IO.
// Each user joins a private room named after their id. Messages are sent to the
// receiver's room and echoed back to the sender, so contact details never leave the app.
import { Server } from 'socket.io';
import { verifyToken, saveMessage } from './app.js';
import { db } from './db/index.js';

export function attachChat(server) {
  const io = new Server(server, { cors: { origin: '*' } });
  const pushMessage = (msg) => io.to(msg.to).to(msg.from).emit('chat:message', msg);

  io.use(async (socket, next) => {
    try {
      const user = await verifyToken(socket.handshake.auth?.token || '');
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

    socket.on('chat:send', async ({ to, text } = {}, ack) => {
      try {
        const value = String(text || '').trim();
        if (!to || !value) return ack?.({ error: 'to and text required' });
        if (to === me.id || !(await db.users.findById(to))) return ack?.({ error: 'Invalid receiver' });
        const msg = await saveMessage(me.id, to, value);
        pushMessage(msg);
        ack?.({ ok: true, message: msg });
      } catch (err) {
        console.error(err);
        ack?.({ error: 'Could not send message' });
      }
    });
  });

  return { io, pushMessage };
}
