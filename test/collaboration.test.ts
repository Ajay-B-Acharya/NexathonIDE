import { WebSocket } from 'ws';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import * as http from 'http';
import { WebSocketServer } from 'ws';
import {
  setupWSConnection,
  extractRoomName,
  heartbeatInterval,
  rooms,
} from '../src/server/yjs-server.ts';

const TEST_PORT = 12345;
const SERVER_URL = `ws://127.0.0.1:${TEST_PORT}`;

interface TestClient {
  id: string;
  doc: Y.Doc;
  provider: WebsocketProvider;
  text: Y.Text;
  cleanup: () => void;
}

let activeClients: TestClient[] = [];

function createClient(roomName: string, clientId: string = 'client'): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const doc = new Y.Doc();
    const text = doc.getText('codemirror');

    const provider = new WebsocketProvider(SERVER_URL, roomName, doc, {
      WebSocketPolyfill: WebSocket as any,
      disableBc: true, // Disable BroadcastChannel so tests strictly verify real WebSocket sync
    });

    let isCleanedUp = false;
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`[${clientId}] Timed out waiting for sync in room "${roomName}"`));
    }, 6000);

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      clearTimeout(timeout);
      provider.destroy();
      doc.destroy();
      activeClients = activeClients.filter((c) => c !== testClient);
    };

    const testClient: TestClient = {
      id: clientId,
      doc,
      provider,
      text,
      cleanup,
    };
    activeClients.push(testClient);

    provider.on('sync', (isSynced: boolean) => {
      if (isSynced) {
        clearTimeout(timeout);
        resolve(testClient);
      }
    });
  });
}

function waitFor(
  predicate: () => boolean,
  timeoutMs: number = 5000,
  description: string = 'condition'
): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      try {
        if (predicate()) {
          return resolve();
        }
      } catch (err) {
        return reject(err);
      }

      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Timeout after ${timeoutMs}ms waiting for: ${description}`));
      }
      setTimeout(check, 30);
    };
    check();
  });
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion Failure: ${message}`);
  }
}

// Global server instance for test run
let server: http.Server;
let wss: WebSocketServer;

async function startTestServer(): Promise<void> {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      res.writeHead(200);
      res.end('Test Server OK');
    });

    wss = new WebSocketServer({ server });

    wss.on('connection', (ws, req) => {
      const roomName = extractRoomName(req.url, req.headers.host);
      if (!roomName) {
        ws.close(4400, 'Invalid room name');
        return;
      }
      setupWSConnection(ws, req, { roomName, gc: true });
    });

    server.listen(TEST_PORT, () => {
      console.log(`[Test Server] Running on port ${TEST_PORT}`);
      resolve();
    });
  });
}

async function stopTestServer(): Promise<void> {
  clearInterval(heartbeatInterval);
  for (const client of activeClients) {
    try { client.cleanup(); } catch {}
  }
  activeClients = [];

  return new Promise((resolve) => {
    if (wss) {
      for (const client of wss.clients) {
        try { client.terminate(); } catch {}
      }
      wss.close(() => {
        if (server) {
          server.close(() => resolve());
        } else {
          resolve();
        }
      });
    } else if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

type TestFunction = () => Promise<void>;

interface TestCase {
  name: string;
  fn: TestFunction;
}

const tests: TestCase[] = [
  {
    name: 'Test A: Connection and initial synchronization',
    fn: async () => {
      const client1 = await createClient('room-test-a', 'clientA1');
      const client2 = await createClient('room-test-a', 'clientA2');

      assert(client1.provider.synced, 'Client 1 must be synced');
      assert(client2.provider.synced, 'Client 2 must be synced');
      assert(client1.provider.wsconnected, 'Client 1 WebSocket must be connected');
      assert(client2.provider.wsconnected, 'Client 2 WebSocket must be connected');
    },
  },
  {
    name: 'Test B: Client A to Client B synchronization',
    fn: async () => {
      const clientA = await createClient('room-test-b', 'clientB_A');
      const clientB = await createClient('room-test-b', 'clientB_B');

      clientA.text.insert(0, 'Hello from Client A');

      await waitFor(
        () => clientB.text.toString() === 'Hello from Client A',
        5000,
        'Client B to receive Client A text update'
      );

      assert(
        clientB.text.toString() === 'Hello from Client A',
        `Client B expected "Hello from Client A", got "${clientB.text.toString()}"`
      );
    },
  },
  {
    name: 'Test C: Client B to Client A synchronization',
    fn: async () => {
      const clientA = await createClient('room-test-c', 'clientC_A');
      const clientB = await createClient('room-test-c', 'clientC_B');

      clientA.text.insert(0, 'Initial base text: ');
      await waitFor(
        () => clientB.text.toString() === 'Initial base text: ',
        5000,
        'Client B to receive initial base text'
      );

      clientB.text.insert(clientB.text.length, 'Edited by Client B');

      await waitFor(
        () => clientA.text.toString() === 'Initial base text: Edited by Client B',
        5000,
        'Client A to receive Client B appended text'
      );

      assert(
        clientA.text.toString() === 'Initial base text: Edited by Client B',
        `Client A text mismatch: got "${clientA.text.toString()}"`
      );
    },
  },
  {
    name: 'Test D: Concurrent editing and CRDT convergence',
    fn: async () => {
      const clientA = await createClient('room-test-d', 'clientD_A');
      const clientB = await createClient('room-test-d', 'clientD_B');

      // Make concurrent edits
      clientA.text.insert(0, 'Alpha-');
      clientB.text.insert(0, 'Beta-');

      // Wait for convergence: both documents must reach the identical state
      await waitFor(
        () => {
          const strA = clientA.text.toString();
          const strB = clientB.text.toString();
          return strA === strB && strA.includes('Alpha-') && strA.includes('Beta-');
        },
        5000,
        'Concurrent edits to converge to identical state'
      );

      assert(
        clientA.text.toString() === clientB.text.toString(),
        `Convergence failed: Client A="${clientA.text.toString()}", Client B="${clientB.text.toString()}"`
      );
    },
  },
  {
    name: 'Test E: Late joiner receives pre-existing state',
    fn: async () => {
      const clientA = await createClient('room-test-e', 'clientE_A');
      clientA.text.insert(0, 'Pre-existing document content before Client Late joins.');

      // Allow the server-side document to settle
      await waitFor(
        () => clientA.text.toString() === 'Pre-existing document content before Client Late joins.',
        2000,
        'Client A text setup'
      );

      // Now connect a new client to the existing room
      const clientLate = await createClient('room-test-e', 'clientE_Late');

      await waitFor(
        () => clientLate.text.toString() === 'Pre-existing document content before Client Late joins.',
        5000,
        'Late joiner to receive pre-existing server state'
      );

      assert(
        clientLate.text.toString() === 'Pre-existing document content before Client Late joins.',
        `Late joiner did not receive existing state. Got: "${clientLate.text.toString()}"`
      );
    },
  },
  {
    name: 'Test F: Room isolation (no cross-room leakage)',
    fn: async () => {
      const clientRoom1 = await createClient('isolation-room-alpha', 'clientF_1');
      const clientRoom2 = await createClient('isolation-room-beta', 'clientF_2');

      clientRoom1.text.insert(0, 'Confidential Room 1 Content');

      // Wait a moment for any potential leakage to happen
      await new Promise((r) => setTimeout(r, 200));

      assert(
        clientRoom2.text.toString() === '',
        `Room 2 leaked Room 1 content! Got: "${clientRoom2.text.toString()}"`
      );

      clientRoom2.text.insert(0, 'Room 2 Independent Content');
      await new Promise((r) => setTimeout(r, 200));

      assert(
        clientRoom1.text.toString() === 'Confidential Room 1 Content',
        `Room 1 was corrupted by Room 2 content! Got: "${clientRoom1.text.toString()}"`
      );
      assert(
        clientRoom2.text.toString() === 'Room 2 Independent Content',
        `Room 2 state missing! Got: "${clientRoom2.text.toString()}"`
      );
    },
  },
  {
    name: 'Test G: Awareness propagation within room and isolation across rooms',
    fn: async () => {
      const clientA = await createClient('awareness-room-1', 'clientG_A');
      const clientB = await createClient('awareness-room-1', 'clientG_B');
      const clientOther = await createClient('awareness-room-2', 'clientG_Other');

      // Set user presence on Client A
      clientA.provider.awareness.setLocalStateField('user', {
        id: 'usr-42',
        username: 'Ada Lovelace',
        color: '#4ECDC4',
      });

      // Client B in the same room must observe Client A's presence
      await waitFor(
        () => {
          const states = Array.from(clientB.provider.awareness.getStates().values());
          return states.some((s: any) => s?.user?.username === 'Ada Lovelace');
        },
        5000,
        'Client B to receive Ada Lovelace awareness'
      );

      const bStates = Array.from(clientB.provider.awareness.getStates().values());
      const adaPresent = bStates.some((s: any) => s?.user?.username === 'Ada Lovelace');
      assert(adaPresent, 'Client B in same room must observe Ada Lovelace');

      // Client in other room must NOT receive awareness
      const otherStates = Array.from(clientOther.provider.awareness.getStates().values());
      const leaked = otherStates.some((s: any) => s?.user?.username === 'Ada Lovelace');
      assert(!leaked, 'Client in another room must NOT observe awareness from room 1');
    },
  },
  {
    name: 'Test H: Disconnect cleanup removes awareness safely',
    fn: async () => {
      const clientA = await createClient('disconnect-test-room', 'clientH_A');
      const clientB = await createClient('disconnect-test-room', 'clientH_B');

      clientA.provider.awareness.setLocalStateField('user', {
        id: 'usr-temporary',
        username: 'TemporaryUser',
        color: '#FF6B6B',
      });

      // Verify Client B sees TemporaryUser
      await waitFor(
        () => {
          const states = Array.from(clientB.provider.awareness.getStates().values());
          return states.some((s: any) => s?.user?.username === 'TemporaryUser');
        },
        5000,
        'Client B to observe TemporaryUser'
      );

      // Now disconnect Client A
      clientA.cleanup();

      // Client B should observe removal of TemporaryUser
      await waitFor(
        () => {
          const states = Array.from(clientB.provider.awareness.getStates().values());
          return !states.some((s: any) => s?.user?.username === 'TemporaryUser');
        },
        5000,
        'Client B to observe removal of TemporaryUser on disconnect'
      );

      const remainingStates = Array.from(clientB.provider.awareness.getStates().values());
      assert(
        !remainingStates.some((s: any) => s?.user?.username === 'TemporaryUser'),
        'TemporaryUser should no longer be present in awareness states'
      );
      assert(clientB.provider.wsconnected, 'Client B must remain connected');
    },
  },
];

async function runTestSuite() {
  console.log('=================================================================');
  console.log('  NEXATHONIDE COLLABORATION BACKEND TEST SUITE (PHASE 2)');
  console.log('=================================================================\n');

  await startTestServer();

  let passed = 0;
  let failed = 0;
  const failures: { name: string; error: any }[] = [];

  for (const t of tests) {
    process.stdout.write(`• Running: ${t.name} ... `);
    const start = Date.now();
    try {
      await t.fn();
      const elapsed = Date.now() - start;
      console.log(`PASSED (${elapsed}ms)`);
      passed++;
    } catch (err: any) {
      const elapsed = Date.now() - start;
      console.log(`FAILED (${elapsed}ms)`);
      console.error(`  Error: ${err?.message || err}`);
      failures.push({ name: t.name, error: err });
      failed++;
    } finally {
      // Clean up all clients after each test to keep tests isolated
      for (const client of activeClients) {
        try { client.cleanup(); } catch {}
      }
      activeClients = [];
    }
  }

  await stopTestServer();

  console.log('\n-----------------------------------------------------------------');
  console.log(`Summary: ${passed} passed, ${failed} failed, ${tests.length} total.`);
  console.log('-----------------------------------------------------------------\n');

  if (failed > 0) {
    console.error('FAILURES:');
    for (const f of failures) {
      console.error(`- ${f.name}: ${f.error?.message || f.error}`);
    }
    process.exit(1);
  } else {
    console.log('ALL COLLABORATION TESTS PASSED SUCCESSFULLY! ✓\n');
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
