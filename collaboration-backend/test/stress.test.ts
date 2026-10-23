import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';

const SERVER_URL = 'ws://localhost:1234';

async function testRapidConcurrentEdits() {
  const nonce = Date.now();
  const roomName = `stress-test-${nonce}`;
  console.log(`[TEST] Starting rapid concurrent edits test on room: ${roomName}`);

  const docA = new Y.Doc();
  const docB = new Y.Doc();

  const provA = new WebsocketProvider(SERVER_URL, roomName, docA, { WebSocketPolyfill: WebSocket as any });
  const provB = new WebsocketProvider(SERVER_URL, roomName, docB, { WebSocketPolyfill: WebSocket as any });

  const textA = docA.getText('monaco');
  const textB = docB.getText('monaco');

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout syncing initial providers')), 5000);
    const check = () => {
      if (provA.synced && provB.synced) {
        clearTimeout(timeout);
        resolve();
      } else {
        setTimeout(check, 20);
      }
    };
    check();
  });

  console.log('[TEST] Initial providers synced.');

  // Measure latency of 50 individual edits from A -> B
  const latencies: number[] = [];
  for (let i = 0; i < 50; i++) {
    const editStr = `[A${i}]`;
    const t0 = performance.now();
    textA.insert(textA.length, editStr);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timeout waiting for B to receive edit ${i}`)), 3000);
      const check = () => {
        if (textB.toString().includes(editStr)) {
          clearTimeout(timeout);
          latencies.push(performance.now() - t0);
          resolve();
        } else {
          setTimeout(check, 2);
        }
      };
      check();
    });
  }

  latencies.sort((a, b) => a - b);
  const median = latencies[Math.floor(latencies.length / 2)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  console.log(`[TEST] 50 consecutive edits A->B: median = ${median.toFixed(2)}ms, p95 = ${p95.toFixed(2)}ms, max = ${latencies[latencies.length - 1].toFixed(2)}ms`);

  // Now test SIMULTANEOUS rapid typing:
  console.log('[TEST] Testing simultaneous rapid typing from both A and B...');
  const promises: Promise<void>[] = [];
  const startSim = performance.now();

  for (let i = 0; i < 30; i++) {
    textA.insert(textA.length, `a${i} `);
    textB.insert(textB.length, `b${i} `);
  }

  // Wait for convergence
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for convergence! DocA=' + textA.toString() + ' DocB=' + textB.toString())), 5000);
    const check = () => {
      if (textA.toString() === textB.toString() && textA.length > 0) {
        clearTimeout(timeout);
        resolve();
      } else {
        setTimeout(check, 20);
      }
    };
    check();
  });

  console.log(`[TEST] Simultaneous editing converged in ${(performance.now() - startSim).toFixed(2)}ms!`);
  console.log(`[TEST] Final text length: ${textA.length}`);

  provA.destroy();
  provB.destroy();
}

testRapidConcurrentEdits().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
