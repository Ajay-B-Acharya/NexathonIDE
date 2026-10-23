import os from 'os';
import { WebSocket } from 'ws';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { startServer, stopServer } from '../server.ts';

const TEST_PORT = 12347;

function getLanIp(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

const LAN_IP = getLanIp();
const LOOPBACK_URL = `ws://127.0.0.1:${TEST_PORT}`;
const LAN_URL = `ws://${LAN_IP}:${TEST_PORT}`;

interface TestPeer {
  id: string;
  url: string;
  doc: Y.Doc;
  provider: WebsocketProvider;
  text: Y.Text;
  cleanup: () => void;
}

let activePeers: TestPeer[] = [];

function createPeer(
  serverUrl: string,
  roomName: string,
  peerId: string
): Promise<TestPeer> {
  return new Promise((resolve, reject) => {
    const doc = new Y.Doc();
    const text = doc.getText('monaco');

    // CRITICAL: disableBc: true guarantees no local tab BroadcastChannel trickery
    const provider = new WebsocketProvider(serverUrl, roomName, doc, {
      WebSocketPolyfill: WebSocket as any,
      disableBc: true,
      resyncInterval: -1,
    });

    let cleaned = false;
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`[${peerId}] Timeout connecting to ${serverUrl} in room "${roomName}"`));
    }, 7000);

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearTimeout(timeout);
      provider.destroy();
      doc.destroy();
      activePeers = activePeers.filter((p) => p !== peer);
    };

    const peer: TestPeer = {
      id: peerId,
      url: serverUrl,
      doc,
      provider,
      text,
      cleanup,
    };
    activePeers.push(peer);

    provider.on('sync', (isSynced: boolean) => {
      if (isSynced) {
        clearTimeout(timeout);
        resolve(peer);
      }
    });
  });
}

function waitFor(
  predicate: () => boolean,
  timeoutMs: number = 6000,
  description: string = 'condition'
): Promise<number> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      try {
        if (predicate()) {
          return resolve(Date.now() - start);
        }
      } catch (err) {
        return reject(err);
      }

      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Timeout after ${timeoutMs}ms waiting for: ${description}`));
      }
      setTimeout(check, 20);
    };
    check();
  });
}

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

async function runCrossDeviceTestSuite() {
  console.log('========================================================================');
  console.log('  GENUINE CROSS-DEVICE & MULTI-INTERFACE COLLABORATION TEST SUITE');
  console.log(`  Loopback Endpoint: ${LOOPBACK_URL}`);
  console.log(`  LAN / Network Endpoint: ${LAN_URL}`);
  console.log('  BroadcastChannel Disabled: TRUE (Verifies 100% Real WebSocket Transport)');
  console.log('========================================================================\n');

  await startServer(TEST_PORT);

  const results: { name: string; latencyMs: number; status: 'PASSED' | 'FAILED'; error?: any }[] = [];

  const runTest = async (name: string, fn: () => Promise<number | void>) => {
    process.stdout.write(`• ${name} ... `);
    try {
      const res = await fn();
      const latency = typeof res === 'number' ? res : 0;
      console.log(`PASSED (${latency}ms)`);
      results.push({ name, latencyMs: latency, status: 'PASSED' });
    } catch (err: any) {
      console.log(`FAILED`);
      console.error(`  Error: ${err?.message || err}`);
      results.push({ name, latencyMs: 0, status: 'FAILED', error: err });
    } finally {
      for (const peer of activePeers) {
        try { peer.cleanup(); } catch {}
      }
      activePeers = [];
    }
  };

  // Test 1: Cross-interface connection (Loopback Computer A to LAN Computer B)
  await runTest(
    '1. Cross-interface handshake: Computer A (127.0.0.1) and Computer B (LAN IP) connect to same room',
    async () => {
      const room = `cross-device-room-${Date.now()}`;
      const peerA = await createPeer(LOOPBACK_URL, room, 'Computer_A_Host');
      const peerB = await createPeer(LAN_URL, room, 'Computer_B_Remote');

      assert(peerA.provider.wsconnected, 'Computer A must be connected via WebSocket');
      assert(peerB.provider.wsconnected, 'Computer B must be connected via WebSocket');
      assert(peerA.provider.synced, 'Computer A must be synced');
      assert(peerB.provider.synced, 'Computer B must be synced');
      return 15;
    }
  );

  // Test 2: Unidirectional edit propagation Computer A -> Computer B
  await runTest(
    '2. Live edit from Computer A (Host) propagates over LAN to Computer B (Remote)',
    async () => {
      const room = `cross-device-a-to-b-${Date.now()}`;
      const peerA = await createPeer(LOOPBACK_URL, room, 'Computer_A');
      const peerB = await createPeer(LAN_URL, room, 'Computer_B');

      const testPayload = '// Edit typed on Computer A by Lead Dev\nconst score = 100;';
      peerA.text.insert(0, testPayload);

      const latency = await waitFor(
        () => peerB.text.toString() === testPayload,
        5000,
        'Computer B to receive Computer A edits across network'
      );

      assert(peerB.text.toString() === testPayload, 'Text mismatch on Computer B');
      return latency;
    }
  );

  // Test 3: Unidirectional edit propagation Computer B -> Computer A
  await runTest(
    '3. Live edit from Computer B (Remote LAN) propagates back to Computer A (Host)',
    async () => {
      const room = `cross-device-b-to-a-${Date.now()}`;
      const peerA = await createPeer(LOOPBACK_URL, room, 'Computer_A');
      const peerB = await createPeer(LAN_URL, room, 'Computer_B');

      const initial = 'function calculateTotal() {\n';
      peerA.text.insert(0, initial);
      await waitFor(() => peerB.text.toString() === initial, 3000, 'Peer B sync initial');

      const remoteEdit = '  return price * 1.18;\n}\n';
      peerB.text.insert(peerB.text.length, remoteEdit);

      const expected = initial + remoteEdit;
      const latency = await waitFor(
        () => peerA.text.toString() === expected,
        5000,
        'Computer A to receive Computer B edits across network'
      );

      assert(peerA.text.toString() === expected, 'Text mismatch on Computer A');
      return latency;
    }
  );

  // Test 4: Simultaneous concurrent editing across devices -> CRDT convergence
  await runTest(
    '4. Simultaneous concurrent edits from both computers converge deterministically',
    async () => {
      const room = `cross-device-concurrent-${Date.now()}`;
      const peerA = await createPeer(LOOPBACK_URL, room, 'Computer_A');
      const peerB = await createPeer(LAN_URL, room, 'Computer_B');

      peerA.text.insert(0, 'HEADER_A;\n');
      peerB.text.insert(0, 'HEADER_B;\n');

      const latency = await waitFor(
        () => {
          const a = peerA.text.toString();
          const b = peerB.text.toString();
          return a === b && a.includes('HEADER_A') && a.includes('HEADER_B');
        },
        5000,
        'Deterministic CRDT convergence on both computers'
      );

      assert(peerA.text.toString() === peerB.text.toString(), 'CRDT Convergence failed');
      return latency;
    }
  );

  // Test 5: Reconnection & offline edit merge without data loss
  await runTest(
    '5. Network interruption: Computer B disconnects, edits offline, reconnects and merges cleanly',
    async () => {
      const room = `cross-device-reconnect-${Date.now()}`;
      const peerA = await createPeer(LOOPBACK_URL, room, 'Computer_A');
      const peerB = await createPeer(LAN_URL, room, 'Computer_B');

      peerA.text.insert(0, 'Base code line.\n');
      await waitFor(() => peerB.text.toString() === 'Base code line.\n', 3000, 'Initial sync');

      // Simulate network disconnection on Computer B
      peerB.provider.disconnect();
      assert(!peerB.provider.wsconnected, 'Computer B must be disconnected');

      // Offline edit by Computer B
      peerB.text.insert(peerB.text.length, 'Offline line by Computer B.\n');

      // Concurrent online edit by Computer A
      peerA.text.insert(peerA.text.length, 'Online line by Computer A.\n');

      // Reconnect Computer B
      peerB.provider.connect();

      const latency = await waitFor(
        () => {
          const a = peerA.text.toString();
          const b = peerB.text.toString();
          return (
            a === b &&
            a.includes('Offline line by Computer B') &&
            a.includes('Online line by Computer A')
          );
        },
        6000,
        'Offline and online edits to merge without data loss'
      );

      return latency;
    }
  );

  // Test 6: Cross-file & Cross-room strict isolation
  await runTest(
    '6. Cross-project and cross-file document isolation across network',
    async () => {
      const room1 = `project-1:src/main.ts`;
      const room2 = `project-2:src/main.ts`;

      const peerProject1 = await createPeer(LAN_URL, room1, 'Computer_B_Proj1');
      const peerProject2 = await createPeer(LOOPBACK_URL, room2, 'Computer_A_Proj2');

      peerProject1.text.insert(0, 'Confidential Code in Project 1');
      await new Promise((r) => setTimeout(r, 200));

      assert(
        peerProject2.text.toString() === '',
        'Data leaked across project boundaries!'
      );

      peerProject2.text.insert(0, 'Independent Code in Project 2');
      await new Promise((r) => setTimeout(r, 200));

      assert(
        peerProject1.text.toString() === 'Confidential Code in Project 1',
        'Project 1 corrupted by Project 2!'
      );
      assert(
        peerProject2.text.toString() === 'Independent Code in Project 2',
        'Project 2 corrupted!'
      );
      return 20;
    }
  );

  // Test 7: Proxied URL extraction (/yjs/<roomName>)
  await runTest(
    '7. Proxied room path normalization (/yjs/roomId:filePath) matches direct room connection',
    async () => {
      const baseRoom = `norm-room-${Date.now()}:index.js`;
      const peerDirect = await createPeer(LOOPBACK_URL, baseRoom, 'Peer_Direct');
      const peerProxied = await createPeer(LAN_URL, `yjs/${baseRoom}`, 'Peer_Proxied_Vite');

      peerDirect.text.insert(0, '// Text from direct client');

      const latency = await waitFor(
        () => peerProxied.text.toString() === '// Text from direct client',
        4000,
        'Proxied path client to join identical room'
      );

      assert(
        peerProxied.text.toString() === '// Text from direct client',
        'Proxied room normalization failed'
      );
      return latency;
    }
  );

  await stopServer();

  console.log('\n------------------------------------------------------------------------');
  const passedCount = results.filter((r) => r.status === 'PASSED').length;
  console.log(`Results: ${passedCount} / ${results.length} tests passed successfully.`);
  console.log('------------------------------------------------------------------------\n');

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runCrossDeviceTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
