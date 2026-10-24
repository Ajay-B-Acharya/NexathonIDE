import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';
import assert from 'assert';
import { startServer, stopServer } from '../server.ts';

const TEST_PORT = 12348;
const SERVER_URL = `ws://127.0.0.1:${TEST_PORT}`;

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
  await startServer(TEST_PORT);

  const nonce = Date.now();
  const roomId = `e2e-room-${nonce}`;
  const filePath = 'main.js';
  const docKey = `${roomId}:${filePath}`;

  console.log(`\n======================================================`);
  console.log(`  E2E NATURAL COLLABORATION ACCEPTANCE (${docKey})`);
  console.log(`======================================================\n`);

  try {
    // Step 1: Client A connects
    console.log('1. Connecting Client A to room...');
    const docA = new Y.Doc();
    const provA = new WebsocketProvider(SERVER_URL, docKey, docA, {
      WebSocketPolyfill: WebSocket as any,
      disableBc: true,
    });
    const textA = docA.getText('monaco');
    provA.awareness.setLocalStateField('user', { id: 'usr_A', name: 'Alice', color: '#6366f1' });
    provA.awareness.setLocalStateField('activeFile', filePath);

    await waitFor(() => provA.synced, 3000, 'Client A synced');
    console.log('   ✓ Client A connected & synced.');

    // Step 2: Client A seeds initial content and types
    console.log('2. Client A types distinctive text without reservation...');
    textA.insert(0, '// Alice initial work\nfunction computeScore() {\n');
    assert.strictEqual(textA.toString(), '// Alice initial work\nfunction computeScore() {\n');
    console.log('   ✓ Client A text buffer set.');

    // Step 3: Client B joins (Late joiner test)
    console.log('3. Client B joins as late collaborator...');
    const docB = new Y.Doc();
    const provB = new WebsocketProvider(SERVER_URL, docKey, docB, {
      WebSocketPolyfill: WebSocket as any,
      disableBc: true,
    });
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

    // Step 5: Concurrent simultaneous editing across different lines without locks
    console.log('5. Simultaneous concurrent typing from Alice & Bob without any line locks...');
    textA.insert(0, '// Top Header by Alice\n');
    textB.insert(textB.length, '// Bottom Footer by Bob\n');

    await waitFor(() => textA.toString() === textB.toString(), 3000, 'Concurrent convergence');
    assert(textA.toString().includes('Top Header by Alice'));
    assert(textA.toString().includes('Bottom Footer by Bob'));
    console.log('   ✓ Both clients converged to identical CRDT state seamlessly.');

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

    // Step 7: Granular interleaved simultaneous editing on the same line
    console.log('7. Testing natural simultaneous editing in the same block without reservation barriers...');
    textA.insert(23, '/* async */ ');
    textB.insert(textB.toString().indexOf('return 42;'), 'const base = 10;\n  ');

    await waitFor(() => textA.toString() === textB.toString(), 4000, 'Fine-grained simultaneous edit convergence');
    assert(textA.toString().includes('/* async */'));
    assert(textA.toString().includes('const base = 10;'));
    console.log('   ✓ Granular edits within the same function converged with zero friction.');

    // Clean teardown
    provA.destroy();
    provB.destroy();
    docA.destroy();
    docB.destroy();

    console.log('\n======================================================');
    console.log('  ALL E2E ACCEPTANCE STEPS PASSED SUCCESSFULLY! ✓');
    console.log('======================================================\n');
  } finally {
    await stopServer();
  }
}

runEndToEndAcceptanceTest().catch((err) => {
  console.error('E2E TEST FAILED:', err);
  process.exit(1);
});
