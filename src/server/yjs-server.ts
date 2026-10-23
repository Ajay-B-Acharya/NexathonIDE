import { WebSocketServer, WebSocket } from 'ws';
import { Doc } from 'yjs';
import * as http from 'http';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';

const PORT = process.env.Y_WEBSOCKET_PORT ? parseInt(process.env.Y_WEBSOCKET_PORT) : 1234;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Yjs WebSocket Server Running');
});

const wss = new WebSocketServer({ server });

const docs = new Map<string, Doc>();

const messageSync = 0;
const messageAwareness = 1;
const messageQueryAwareness = 3;

function setupWSConnection(ws: WebSocket, req: any, { doc, gc = true }: { doc: Doc; gc?: boolean }) {
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

wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const roomName = url.searchParams.get('room') || 'default';
  
  let doc = docs.get(roomName);
  if (!doc) {
    doc = new Doc();
    docs.set(roomName, doc);
    console.log(`Created new document for room: ${roomName}`);
  }
  
  setupWSConnection(ws, req, { doc, gc: true });
  
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