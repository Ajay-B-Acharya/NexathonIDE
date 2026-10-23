import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';
import assert from 'assert';

const SERVER_URL = 'ws://localhost:1234';

function waitFor(condition: () => boolean, timeoutMs = 4000, desc = 'condition'): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (condition()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('Timeout waiting for: ' + desc));
      setTimeout(check, 25);
    };
    check();
  });
}

async function run() {
  const nonce = Date.now();
  console.log('--- STARTING 6 TEST SCENARIOS (Nonce: ' + nonce + ') ---');

  // Test 1: Basic Bidirectional Sync
  console.log('Test 1: Basic Bidirectional Sync...');
  const docA = new Y.Doc();
  const docB = new Y.Doc();
  const provA = new WebsocketProvider(SERVER_URL, `test-sync-1-${nonce}`, docA, { WebSocketPolyfill: WebSocket as any });
  const provB = new WebsocketProvider(SERVER_URL, `test-sync-1-${nonce}`, docB, { WebSocketPolyfill: WebSocket as any });
  const textA = docA.getText('monaco');
  const textB = docB.getText('monaco');

  await waitFor(() => provA.synced && provB.synced, 3000, 'A and B synced');
  textA.insert(0, 'Hello from A! ');
  await waitFor(() => textB.toString() === 'Hello from A! ', 3000, 'B received A');
  textB.insert(textB.length, 'Reply from B!');
  await waitFor(() => textA.toString() === 'Hello from A! Reply from B!', 3000, 'A received B');
  console.log('Test 1 PASSED: ' + textA.toString());
  provA.destroy(); provB.destroy();

  // Test 2: Concurrent Edits Convergence
  console.log('Test 2: Concurrent Edits Convergence...');
  const docC1 = new Y.Doc();
  const docC2 = new Y.Doc();
  const provC1 = new WebsocketProvider(SERVER_URL, `test-concurrent-${nonce}`, docC1, { WebSocketPolyfill: WebSocket as any });
  const provC2 = new WebsocketProvider(SERVER_URL, `test-concurrent-${nonce}`, docC2, { WebSocketPolyfill: WebSocket as any });
  const tC1 = docC1.getText('monaco');
  const tC2 = docC2.getText('monaco');
  await waitFor(() => provC1.synced && provC2.synced, 3000, 'C1 and C2 synced');
  
  tC1.insert(0, 'Alpha-123 ');
  tC2.insert(0, 'Beta-456 ');
  await waitFor(() => tC1.toString() === tC2.toString() && tC1.toString().includes('Alpha-123') && tC1.toString().includes('Beta-456'), 4000, 'convergence');
  console.log('Test 2 PASSED: converged to: ' + tC1.toString());
  provC1.destroy(); provC2.destroy();

  // Test 3: Late-joining Client
  console.log('Test 3: Late-joining Client...');
  const docLate1 = new Y.Doc();
  const provLate1 = new WebsocketProvider(SERVER_URL, `test-late-${nonce}`, docLate1, { WebSocketPolyfill: WebSocket as any });
  const tLate1 = docLate1.getText('monaco');
  await waitFor(() => provLate1.synced, 3000, 'Late1 synced');
  tLate1.insert(0, 'Accumulated prior state before late client joins.');
  await new Promise(r => setTimeout(r, 200));

  const docLate2 = new Y.Doc();
  const provLate2 = new WebsocketProvider(SERVER_URL, `test-late-${nonce}`, docLate2, { WebSocketPolyfill: WebSocket as any });
  const tLate2 = docLate2.getText('monaco');
  await waitFor(() => provLate2.synced && tLate2.toString() === 'Accumulated prior state before late client joins.', 4000, 'Late2 received state');
  console.log('Test 3 PASSED: late client received: ' + tLate2.toString());
  provLate1.destroy(); provLate2.destroy();

  // Test 4: Room Isolation
  console.log('Test 4: Room Isolation...');
  const docR1 = new Y.Doc();
  const docR2 = new Y.Doc();
  const provR1 = new WebsocketProvider(SERVER_URL, `test-iso-A-${nonce}`, docR1, { WebSocketPolyfill: WebSocket as any });
  const provR2 = new WebsocketProvider(SERVER_URL, `test-iso-B-${nonce}`, docR2, { WebSocketPolyfill: WebSocket as any });
  const tR1 = docR1.getText('monaco');
  const tR2 = docR2.getText('monaco');
  await waitFor(() => provR1.synced && provR2.synced, 3000, 'R1 and R2 synced');
  tR1.insert(0, 'Secret Room A');
  await new Promise(r => setTimeout(r, 300));
  assert.strictEqual(tR2.toString(), '');
  console.log('Test 4 PASSED: Room B was not affected by Room A');
  provR1.destroy(); provR2.destroy();

  // Test 5: Awareness Propagation
  console.log('Test 5: Awareness...');
  const docAw1 = new Y.Doc();
  const docAw2 = new Y.Doc();
  const provAw1 = new WebsocketProvider(SERVER_URL, `test-aw-${nonce}`, docAw1, { WebSocketPolyfill: WebSocket as any });
  const provAw2 = new WebsocketProvider(SERVER_URL, `test-aw-${nonce}`, docAw2, { WebSocketPolyfill: WebSocket as any });
  await waitFor(() => provAw1.synced && provAw2.synced, 3000, 'Aw synced');
  provAw1.awareness.setLocalStateField('user', { name: 'Alice', color: '#ff0000' });
  await waitFor(() => {
    const states = Array.from(provAw2.awareness.getStates().values()) as any[];
    return states.some(s => s?.user?.name === 'Alice');
  }, 3000, 'Aw2 received Alice');
  console.log('Test 5 PASSED: Awareness observed');
  provAw1.destroy(); provAw2.destroy();

  // Test 6: Disconnect and Reconnect
  console.log('Test 6: Disconnect and Reconnect...');
  const docDc1 = new Y.Doc();
  const provDc1 = new WebsocketProvider(SERVER_URL, `test-reconnect-${nonce}`, docDc1, { WebSocketPolyfill: WebSocket as any });
  const tDc1 = docDc1.getText('monaco');
  await waitFor(() => provDc1.synced, 3000, 'Dc1 synced');
  tDc1.insert(0, 'Initial');

  const docDc2 = new Y.Doc();
  const provDc2 = new WebsocketProvider(SERVER_URL, `test-reconnect-${nonce}`, docDc2, { WebSocketPolyfill: WebSocket as any });
  const tDc2 = docDc2.getText('monaco');
  await waitFor(() => provDc2.synced && tDc2.toString() === 'Initial', 3000, 'Dc2 synced Initial');
  
  // Disconnect client 2
  provDc2.disconnect();
  // Client 1 makes edits while Client 2 is disconnected
  tDc1.insert(tDc1.length, ' + Updates While Disconnected');
  await new Promise(r => setTimeout(r, 200));

  // Reconnect client 2
  provDc2.connect();
  await waitFor(() => tDc2.toString() === 'Initial + Updates While Disconnected', 4000, 'Dc2 caught up after reconnect');
  console.log('Test 6 PASSED: Reconnected client caught up: ' + tDc2.toString());
  provDc1.destroy(); provDc2.destroy();

  console.log('--- ALL 6 CORE TESTS PASSED SUCCESSFULLY! ---');
  process.exit(0);
}
run().catch(err => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
