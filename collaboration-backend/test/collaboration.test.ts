import { WebSocket } from 'ws';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { startServer, stopServer, server } from '../server.ts';

const TEST_PORT = 12346;
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
      disableBc: true, // Disable BroadcastChannel so test verifies true WebSocket transmission
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

type TestFunction = () => Promise<void>;

interface TestCase {
  name: string;
  fn: TestFunction;
}

const tests: TestCase[] = [
  {
    name: '1. Two clients connect to the same room and synchronize',
    fn: async () => {
      const client1 = await createClient('room-modular-1', 'client1');
      const client2 = await createClient('room-modular-1', 'client2');

      assert(client1.provider.synced, 'Client 1 must be synced');
      assert(client2.provider.synced, 'Client 2 must be synced');
      assert(client1.provider.wsconnected, 'Client 1 WebSocket must be connected');
      assert(client2.provider.wsconnected, 'Client 2 WebSocket must be connected');
    },
  },
  {
    name: '2. Client A edits and Client B receives the update',
    fn: async () => {
      const clientA = await createClient('room-modular-2', 'clientA');
      const clientB = await createClient('room-modular-2', 'clientB');

      clientA.text.insert(0, 'Modular Collab: Client A edits');

      await waitFor(
        () => clientB.text.toString() === 'Modular Collab: Client A edits',
        5000,
        'Client B to receive Client A update'
      );

      assert(
        clientB.text.toString() === 'Modular Collab: Client A edits',
        `Client B expected text mismatch: got "${clientB.text.toString()}"`
      );
    },
  },
  {
    name: '3. Client B edits and Client A receives the update',
    fn: async () => {
      const clientA = await createClient('room-modular-3', 'clientA');
      const clientB = await createClient('room-modular-3', 'clientB');

      clientA.text.insert(0, 'Prefix: ');
      await waitFor(() => clientB.text.toString() === 'Prefix: ', 5000, 'Client B sync initial text');

      clientB.text.insert(clientB.text.length, 'Appended by Client B');

      await waitFor(
        () => clientA.text.toString() === 'Prefix: Appended by Client B',
        5000,
        'Client A to receive Client B appended text'
      );

      assert(
        clientA.text.toString() === 'Prefix: Appended by Client B',
        `Client A text mismatch: got "${clientA.text.toString()}"`
      );
    },
  },
  {
    name: '4. Concurrent edits converge to identical CRDT state',
    fn: async () => {
      const clientA = await createClient('room-modular-4', 'clientA');
      const clientB = await createClient('room-modular-4', 'clientB');

      // Simultaneous edits without waiting
      clientA.text.insert(0, 'LeftText-');
      clientB.text.insert(0, 'RightText-');

      await waitFor(
        () => {
          const strA = clientA.text.toString();
          const strB = clientB.text.toString();
          return strA === strB && strA.includes('LeftText-') && strA.includes('RightText-');
        },
        5000,
        'Concurrent edits to converge to identical content'
      );

      assert(
        clientA.text.toString() === clientB.text.toString(),
        `Convergence failed: Client A="${clientA.text.toString()}", Client B="${clientB.text.toString()}"`
      );
    },
  },
  {
    name: '5. Late joiner receives pre-existing document state',
    fn: async () => {
      const clientA = await createClient('room-modular-5', 'clientA');
      clientA.text.insert(0, 'Historical server-side content before Client Late joins.');

      await waitFor(
        () => clientA.text.toString() === 'Historical server-side content before Client Late joins.',
        2000,
        'Client A setup'
      );

      // Now connect late joiner
      const clientLate = await createClient('room-modular-5', 'clientLate');

      await waitFor(
        () => clientLate.text.toString() === 'Historical server-side content before Client Late joins.',
        5000,
        'Late joiner to receive server state'
      );

      assert(
        clientLate.text.toString() === 'Historical server-side content before Client Late joins.',
        `Late joiner text mismatch: got "${clientLate.text.toString()}"`
      );
    },
  },
  {
    name: '6. Different rooms remain strictly isolated',
    fn: async () => {
      const clientRoom1 = await createClient('isolation-room-1', 'clientR1');
      const clientRoom2 = await createClient('isolation-room-2', 'clientR2');

      clientRoom1.text.insert(0, 'Room 1 Private Secrets');
      await new Promise((r) => setTimeout(r, 200));

      assert(
        clientRoom2.text.toString() === '',
        `Room 2 leaked Room 1 content! Got: "${clientRoom2.text.toString()}"`
      );

      clientRoom2.text.insert(0, 'Room 2 Independent Data');
      await new Promise((r) => setTimeout(r, 200));

      assert(
        clientRoom1.text.toString() === 'Room 1 Private Secrets',
        `Room 1 corrupted by Room 2! Got: "${clientRoom1.text.toString()}"`
      );
      assert(
        clientRoom2.text.toString() === 'Room 2 Independent Data',
        `Room 2 data missing! Got: "${clientRoom2.text.toString()}"`
      );
    },
  },
  {
    name: '7. Awareness updates propagate within the same room',
    fn: async () => {
      const clientA = await createClient('awareness-room-test', 'clientA');
      const clientB = await createClient('awareness-room-test', 'clientB');

      clientA.provider.awareness.setLocalStateField('user', {
        id: 'usr-collab-1',
        username: 'Alan Turing',
        color: '#4ECDC4',
      });

      await waitFor(
        () => {
          const states = Array.from(clientB.provider.awareness.getStates().values());
          return states.some((s: any) => s?.user?.username === 'Alan Turing');
        },
        5000,
        'Client B to observe Alan Turing awareness'
      );

      const states = Array.from(clientB.provider.awareness.getStates().values());
      assert(
        states.some((s: any) => s?.user?.username === 'Alan Turing'),
        'Client B must observe Alan Turing'
      );
    },
  },
  {
    name: '8. Awareness does NOT leak across different rooms',
    fn: async () => {
      const clientA = await createClient('awareness-room-leak-1', 'clientA');
      const clientOther = await createClient('awareness-room-leak-2', 'clientOther');

      clientA.provider.awareness.setLocalStateField('user', {
        id: 'usr-collab-secret',
        username: 'TopSecretUser',
        color: '#DDA0DD',
      });

      await new Promise((r) => setTimeout(r, 300));

      const otherStates = Array.from(clientOther.provider.awareness.getStates().values());
      const leaked = otherStates.some((s: any) => s?.user?.username === 'TopSecretUser');
      assert(!leaked, 'Client in another room must NOT observe awareness from room 1');
    },
  },
  {
    name: '9. Disconnect cleanup removes appropriate awareness state',
    fn: async () => {
      const clientA = await createClient('disconnect-room-test', 'clientA');
      const clientB = await createClient('disconnect-room-test', 'clientB');

      clientA.provider.awareness.setLocalStateField('user', {
        id: 'usr-disconnect-me',
        username: 'DisconnectUser',
        color: '#FF6B6B',
      });

      await waitFor(
        () => {
          const states = Array.from(clientB.provider.awareness.getStates().values());
          return states.some((s: any) => s?.user?.username === 'DisconnectUser');
        },
        5000,
        'Client B to observe DisconnectUser before disconnect'
      );

      // Disconnect Client A
      clientA.cleanup();

      // Client B must observe removal
      await waitFor(
        () => {
          const states = Array.from(clientB.provider.awareness.getStates().values());
          return !states.some((s: any) => s?.user?.username === 'DisconnectUser');
        },
        5000,
        'Client B to observe removal of DisconnectUser after disconnect'
      );

      const remainingStates = Array.from(clientB.provider.awareness.getStates().values());
      assert(
        !remainingStates.some((s: any) => s?.user?.username === 'DisconnectUser'),
        'DisconnectUser must be purged from awareness'
      );
      assert(clientB.provider.wsconnected, 'Client B must remain connected');
    },
  },
  {
    name: '10. Server handles malformed input without terminating unexpectedly',
    fn: async () => {
      // Connect a raw socket to send garbage binary data
      const rawWs = new WebSocket(`${SERVER_URL}/malformed-test-room`);
      await new Promise((resolve) => rawWs.on('open', resolve));

      // Send arbitrary corrupt binary payload
      rawWs.send(Buffer.from([0xff, 0xfe, 0xfd, 0x00, 0x12, 0x34]));
      await new Promise((r) => setTimeout(r, 150));
      rawWs.close();

      // Now verify that a normal Yjs client can still connect and collaborate without issue
      const normalClient = await createClient('malformed-test-room', 'clientAfterMalformed');
      normalClient.text.insert(0, 'Server is resilient and healthy');

      await waitFor(
        () => normalClient.text.toString() === 'Server is resilient and healthy',
        3000,
        'Normal client works after malformed input'
      );

      assert(
        normalClient.text.toString() === 'Server is resilient and healthy',
        'Server must continue operating normally after malformed input'
      );
    },
  },
];

async function runTestSuite() {
  console.log('=================================================================');
  console.log('  COLLABORATION BACKEND MODULAR TEST SUITE (ALL 10 SCENARIOS)');
  console.log('=================================================================\n');

  await startServer(TEST_PORT);

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
      for (const client of activeClients) {
        try { client.cleanup(); } catch {}
      }
      activeClients = [];
    }
  }

  await stopServer();

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
    console.log('ALL 10 COLLABORATION TESTS PASSED SUCCESSFULLY! ✓\n');
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
