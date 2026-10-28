import test from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';
import { signToken } from '../src/app.js';
import { db } from '../src/db/index.js';
import { attachChat } from '../src/socket.js';
import { startTestServer } from './helpers.js';

test('messages reach the receiver live, are saved, and need a valid token', async () => {
  let chat;
  const ctx = await startTestServer({ onMessage: (m) => chat.pushMessage(m) });
  chat = attachChat(ctx.server);
  const mali = await db.users.findByEmail('mali@ait.ac.th');
  const aisha = await db.users.findByEmail('aisha@ait.ac.th');

  const bad = connect(ctx.base, { auth: { token: 'nope' }, reconnection: false });
  await new Promise((resolve) => bad.on('connect_error', (e) => { assert.equal(e.message, 'unauthorized'); resolve(); }));
  bad.close();

  const a = connect(ctx.base, { auth: { token: signToken(mali) } });
  const b = connect(ctx.base, { auth: { token: signToken(aisha) } });
  await Promise.all([new Promise((r) => a.on('connect', r)), new Promise((r) => b.on('connect', r))]);

  const received = new Promise((resolve) => b.on('chat:message', resolve));
  const ack = await a.timeout(3000).emitWithAck('chat:send', { to: aisha.id, text: 'Hi Aisha!' });
  assert.equal(ack.ok, true);
  const msg = await received;
  assert.equal(msg.text, 'Hi Aisha!');
  assert.equal(msg.from, mali.id);

  const saved = await db.messages.between(mali.id, aisha.id);
  assert.equal(saved.length, 1);

  const toNobody = await a.timeout(3000).emitWithAck('chat:send', { to: 'nobody', text: 'x' });
  assert.ok(toNobody.error);

  a.close(); b.close();
  chat.io.close();
  await ctx.stop().catch(() => {});
});
