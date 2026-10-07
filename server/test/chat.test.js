import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';
import { buildApp, signToken, verifyToken, saveMessage } from '../src/app.js';
import { findUserByEmail } from '../src/store.js';

// Mirrors the wiring in src/index.js so the same behaviour is tested over a real socket.
function startServer() {
  const server = http.createServer(buildApp());
  const io = new Server(server);
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
    socket.on('chat:send', ({ to, text }, ack) => {
      const msg = saveMessage(me.id, to, text);
      io.to(to).to(me.id).emit('chat:message', msg);
      ack?.({ ok: true });
    });
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ server, io, port: server.address().port })));
}

test('messages reach the receiver and are rejected without a token', async () => {
  const { server, io, port } = await startServer();
  const mali = findUserByEmail('mali@ait.ac.th');
  const aisha = findUserByEmail('aisha@ait.ac.th');
  const url = `http://127.0.0.1:${port}`;

  const bad = connect(url, { auth: { token: 'nope' }, reconnection: false });
  await new Promise((resolve) => bad.on('connect_error', (e) => { assert.equal(e.message, 'unauthorized'); resolve(); }));
  bad.close();

  const a = connect(url, { auth: { token: signToken(mali) } });
  const b = connect(url, { auth: { token: signToken(aisha) } });
  await Promise.all([new Promise((r) => a.on('connect', r)), new Promise((r) => b.on('connect', r))]);

  const received = new Promise((resolve) => b.on('chat:message', resolve));
  a.emit('chat:send', { to: aisha.id, text: 'Hi Aisha!' });
  const msg = await received;
  assert.equal(msg.text, 'Hi Aisha!');
  assert.equal(msg.from, mali.id);

  a.close(); b.close(); io.close(); server.close();
});
