import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';
import assert from 'assert';

const SERVER_URL = 'ws://localhost:1234';

function waitFor(predicate: () => boolean, timeoutMs = 5000, msg = 'condition'): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('Timeout: ' + msg));
      setTimeout(check, 10);
    };
    check();
  });
}

async function runEndToEndAcceptanceTest() {
  const nonce = Date.now();
  const roomId = `e2e-room-${nonce}`;
  const filePath = 'main.js';
  const docKey = `${roomId}:${filePath}`;

  console.log(`\n======================================================`);
  console.log(`  E2E COLLABORATION ACCEPTANCE SCENARIO (${docKey})`);
  console.log(`======================================================\n`);

  // Step 1: Client A connects
  console.log('1. Connecting Client A to room...');
  const docA = new Y.Doc();
  const provA = new WebsocketProvider(SERVER_URL, docKey, docA, { WebSocketPolyfill: WebSocket as any });
  const textA = docA.getText('monaco');
  provA.awareness.setLocalStateField('user', { id: 'usr_A', name: 'Alice', color: '#6366f1' });
  provA.awareness.setLocalStateField('activeFile', filePath);

  await waitFor(() => provA.synced, 3000, 'Client A synced');
  console.log('   ✓ Client A connected & synced.');

  // Step 2: Client A seeds initial content and types
  console.log('2. Client A types distinctive text...');
  textA.insert(0, '// Alice initial work\nfunction computeScore() {\n');
  assert.strictEqual(textA.toString(), '// Alice initial work\nfunction computeScore() {\n');
  console.log('   ✓ Client A text buffer set.');

  // Step 3: Client B joins (Late joiner test)
  console.log('3. Client B joins as late collaborator...');
  const docB = new Y.Doc();
  const provB = new WebsocketProvider(SERVER_URL, docKey, docB, { WebSocketPolyfill: WebSocket as any });
  const textB = docB.getText('monaco');
  provB.awareness.setLocalStateField('user', { id: 'usr_B', name: 'Bob', color: '#10b981' });
  provB.awareness.setLocalStateField('activeFile', filePath);

  await waitFor(() => provB.synced && textB.toString() === textA.toString(), 4000, 'Client B caught up with A');
  console.log('   ✓ Client B received complete document state upon connection.');

  // Step 4: Bidirectional real-time editing
  console.log('4. Client B types a reply; Client A verifies real-time receipt...');
  const replyStr = '  return 42;\n}\n';
  textB.insert(textB.length, replyStr);

  await waitFor(() => textA.toString().includes('return 42;'), 2000, 'Client A received B edit');
  assert.strictEqual(textA.toString(), textB.toString());
  console.log('   ✓ Client A received Client B update in real-time.');

  // Step 5: Concurrent editing at different locations
  console.log('5. Simultaneous concurrent typing from Alice & Bob...');
  textA.insert(0, '// Top Header by Alice\n');
  textB.insert(textB.length, '// Bottom Footer by Bob\n');

  await waitFor(() => textA.toString() === textB.toString(), 3000, 'Concurrent convergence');
  assert(textA.toString().includes('Top Header by Alice'));
  assert(textA.toString().includes('Bottom Footer by Bob'));
  console.log('   ✓ Both clients converged to identical CRDT state.');

  // Step 6: Temporary Disconnection & Offline Editing Recovery
  console.log('6. Testing disconnection and offline edit reconciliation...');
  provB.disconnect();
  assert.strictEqual(provB.wsconnected, false);

  // Bob edits while disconnected
  textB.insert(textB.length, '// Bob offline line\n');

  // Alice edits while Bob is offline
  textA.insert(textA.length, '// Alice online line\n');

  // Bob reconnects
  provB.connect();
  await waitFor(() => provB.synced && provA.synced, 4000, 'Both synced after reconnect');
  await waitFor(() => textA.toString() === textB.toString(), 4000, 'Reconnection convergence');

  assert(textA.toString().includes('Bob offline line'));
  assert(textA.toString().includes('Alice online line'));
  console.log('   ✓ Reconnection safely merged offline and online edits without data loss.');

  // Step 7: Natural simultaneous concurrent editing across peers outside locks
  console.log('7. Testing natural simultaneous concurrent editing across peers outside locks...');
  textA.insert(0, '// Concurrent Header from Alice\n');
  textB.insert(textB.length, '\n// Concurrent Footer from Bob\n');

  await waitFor(() => textA.toString() === textB.toString(), 4000, 'Simultaneous edits convergence');
  assert(textA.toString().startsWith('// Concurrent Header from Alice\n'));
  assert(textA.toString().endsWith('\n// Concurrent Footer from Bob\n'));
  console.log('   ✓ Natural simultaneous edits converged seamlessly across both peers.');

  // Step 8: Code reservation synchronization and ownership
  console.log('8. Testing code reservation creation, ownership, and synchronization...');
  const resMapA = docA.getMap('edit_reservations');
  const resMapB = docB.getMap('edit_reservations');

  resMapA.set('res_alice_1', {
    id: 'res_alice_1',
    roomId: 'e2e-room',
    filePath: 'main.js',
    ownerId: 'usr_alice',
    ownerName: 'Alice',
    ownerColor: '#35B8A6',
    startLine: 2,
    endLine: 4,
    createdAt: Date.now(),
    expiresAt: Date.now() + 60000,
  });

  await waitFor(() => resMapB.has('res_alice_1'), 2000, 'Bob received Alice reservation');
  const bobReceivedRes = resMapB.get('res_alice_1') as any;
  assert.strictEqual(bobReceivedRes.ownerId, 'usr_alice');
  assert.strictEqual(bobReceivedRes.startLine, 2);
  assert.strictEqual(bobReceivedRes.endLine, 4);
  console.log('   ✓ Reservation synchronized with accurate boundaries and ownership.');

  // Release reservation
  resMapA.delete('res_alice_1');
  await waitFor(() => !resMapB.has('res_alice_1'), 2000, 'Bob observed reservation release');
  console.log('   ✓ Reservation release synchronized cleanly to peer.');

  // Step 8: Clean teardown
  provA.destroy();
  provB.destroy();

  console.log('\n======================================================');
  console.log('  ALL E2E ACCEPTANCE STEPS PASSED SUCCESSFULLY! ✓');
  console.log('======================================================\n');
}

runEndToEndAcceptanceTest().catch((err) => {
  console.error('E2E TEST FAILED:', err);
  process.exit(1);
});
