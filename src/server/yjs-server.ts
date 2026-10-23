import 'dotenv/config';
import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import * as http from 'http';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import { supabaseAdmin } from './supabase.js';

const PORT = process.env.Y_WEBSOCKET_PORT ? parseInt(process.env.Y_WEBSOCKET_PORT) : 1234;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Yjs WebSocket Server Running');
});

const wss = new WebSocketServer({ server });

const docs = new Map<string, Y.Doc>();
const saveDebounceTimers = new Map<string, NodeJS.Timeout>();

const messageSync = 0;
const messageAwareness = 1;
const messageQueryAwareness = 3;

function scheduleDocSave(roomId: string, doc: Y.Doc) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId);
  if (!isUUID) return;

  const existingTimer = saveDebounceTimers.get(roomId);
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(async () => {
    try {
      const state = Y.encodeStateAsUpdate(doc);
      const buffer = Buffer.from(state);
      await supabaseAdmin
        .from('yjs_documents')
        .upsert({
          room_id: roomId,
          document_state: '\\x' + buffer.toString('hex'),
          updated_at: new Date().toISOString(),
        });
      console.log(`[Yjs] Saved state snapshot for room ${roomId}`);
    } catch (err) {
      console.error(`[Yjs] Error saving document state for room ${roomId}:`, err);
    }
  }, 2000);

  saveDebounceTimers.set(roomId, timer);
}

async function getOrLoadDoc(roomName: string): Promise<Y.Doc> {
  let doc = docs.get(roomName);
  if (!doc) {
    doc = new Y.Doc();
    docs.set(roomName, doc);
    console.log(`Created new document for room: ${roomName}`);

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomName);
    if (isUUID) {
      try {
        const { data } = await supabaseAdmin
          .from('yjs_documents')
          .select('document_state')
          .eq('room_id', roomName)
          .single();

        if (data?.document_state) {
          const raw = data.document_state;
          const hex = typeof raw === 'string' && raw.startsWith('\\x') ? raw.slice(2) : raw;
          const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(hex, 'hex');
          Y.applyUpdate(doc, new Uint8Array(buf));
          console.log(`[Yjs] Loaded persisted state for room: ${roomName}`);
        }
      } catch (err) {
        // No previous state or error loading
      }
    }

    doc.on('update', () => {
      scheduleDocSave(roomName, doc!);
    });
  }
  return doc;
}

function setupWSConnection(ws: WebSocket, req: any, { doc }: { doc: Y.Doc }) {
  const awareness = new awarenessProtocol.Awareness(doc);

  awareness.on('update', ({ added, updated, removed }: any) => {
    const changedClients = added.concat(updated).concat(removed);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients));
    ws.send(encoding.toUint8Array(encoder));
  });

  ws.on('message', (message: Buffer) => {
    const decoder = decoding.createDecoder(new Uint8Array(message));
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case messageSync: {
        syncProtocol.readSyncMessage(decoder, encoding.createEncoder(), doc, { awareness });
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeSyncStep2(encoder, doc);
        ws.send(encoding.toUint8Array(encoder));
        break;
      }
      case messageQueryAwareness: {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awareness.getStates().keys())));
        ws.send(encoding.toUint8Array(encoder));
        break;
      }
      case messageAwareness: {
        awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), null);
        break;
      }
    }
  });

  ws.on('close', () => {
    awareness.destroy();
  });

  // Send initial sync step 1
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  ws.send(encoding.toUint8Array(encoder));
}

wss.on('connection', async (ws: WebSocket, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const roomName = url.searchParams.get('room') || 'default';

  const doc = await getOrLoadDoc(roomName);
  setupWSConnection(ws, req, { doc });

  ws.on('close', () => {
    console.log(`Client disconnected from room: ${roomName}`);
  });
});

server.listen(PORT, () => {
  console.log(`Yjs WebSocket server running on port ${PORT}`);
});

process.on('SIGINT', () => {
  console.log('Shutting down Yjs server...');
  server.close(() => {
    process.exit(0);
  });
});
