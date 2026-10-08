/**
 * Private Room Backend Server
 * Zero-record, memory-only WebSocket relay server.
 * 
 * Rules:
 * 1. NO database. Everything is kept strictly in RAM.
 * 2. NO server logs of IP addresses, messages, or keys.
 * 3. Max 2 users per room ID. 3rd user is rejected.
 * 4. Room deleted immediately when participants leave or idle timeout triggers.
 */

const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 8080;

// Memory storage for active rooms (RAM only)
// Key: roomId (scrambled hash sent by client)
// Value: { clients: Set<WebSocket>, createdAt: number, lastActive: number }
const activeRooms = new Map();

// HTTP server for health checks & deployment keep-alive
const server = http.createServer((req, res) => {
  // Strict security and no-cache headers
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', server: 'PrivateRoom-Server', timestamp: Date.now() }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

const wss = new WebSocketServer({ server });

wss.on('error', (err) => {
  if (err.code !== 'EADDRINUSE') {
    console.error('WebSocket Server error:', err);
  }
});


// Track client room association
// WebSocket instance -> { roomId, clientId, joinTime, lastMsgTime }
const clientState = new Map();

/**
 * Remove client from their room and clean up RAM if room becomes empty
 */
function leaveCurrentRoom(ws, reason = 'left') {
  const state = clientState.get(ws);
  if (!state) return;

  const { roomId, clientId } = state;
  clientState.delete(ws);

  const room = activeRooms.get(roomId);
  if (!room) return;

  // Remove ws from room client set
  room.clients.delete(ws);

  // Notify remaining peer that room is closed and wiped
  for (const peerWs of room.clients) {
    if (peerWs.readyState === WebSocket.OPEN) {
      peerWs.send(JSON.stringify({
        type: 'room-closed',
        reason: reason,
        message: 'The other person left the room. All temporary session data has been erased.'
      }));
    }
  }

  // If room is now empty or destroyed, erase from RAM completely
  if (room.clients.size === 0) {
    activeRooms.delete(roomId);
  }
}

wss.on('connection', (ws) => {
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (rawMessage) => {
    try {
      const data = JSON.parse(rawMessage.toString());
      const { type } = data;

      // Rate limit / payload size sanity check (max 2MB for view-once fallback payloads)
      if (rawMessage.length > 2 * 1024 * 1024) {
        ws.send(JSON.stringify({ type: 'error', message: 'Payload too large.' }));
        return;
      }

      if (type === 'join-room') {
        const { roomId, clientId } = data;
        if (!roomId || typeof roomId !== 'string' || roomId.length < 8) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid Room ID.' }));
          return;
        }

        // Leave any existing room first
        if (clientState.has(ws)) {
          leaveCurrentRoom(ws, 'switched-room');
        }

        let room = activeRooms.get(roomId);

        if (!room) {
          // Create new room in RAM
          room = {
            roomId,
            clients: new Set(),
            createdAt: Date.now(),
            lastActive: Date.now()
          };
          activeRooms.set(roomId, room);
        }

        // Enforce MAX 2 users rule
        if (room.clients.size >= 2) {
          ws.send(JSON.stringify({
            type: 'error',
            code: 'ROOM_FULL',
            message: 'Room is full (maximum 2 people allowed).'
          }));
          return;
        }

        // Register client in room
        room.clients.add(ws);
        room.lastActive = Date.now();

        clientState.set(ws, {
          roomId,
          clientId: clientId || Math.random().toString(36).substring(2, 10),
          joinTime: Date.now()
        });

        // Respond to joined client
        if (room.clients.size === 1) {
          ws.send(JSON.stringify({
            type: 'joined',
            role: 'initiator',
            peerCount: 1,
            message: 'Waiting for the second person to join...'
          }));
        } else if (room.clients.size === 2) {
          // Notify BOTH clients that peer is ready
          const clientsArray = Array.from(room.clients);
          clientsArray[0].send(JSON.stringify({
            type: 'joined',
            role: 'initiator',
            peerCount: 2,
            message: 'Second person joined! E2E Encryption established.'
          }));
          clientsArray[1].send(JSON.stringify({
            type: 'joined',
            role: 'joiner',
            peerCount: 2,
            message: 'Joined room! E2E Encryption established.'
          }));

          // Send peer-connected signal to initiate WebRTC / Safety verification
          for (const clientWs of room.clients) {
            clientWs.send(JSON.stringify({ type: 'peer-connected' }));
          }
        }
        return;
      }

      // Handle leaving room explicitly
      if (type === 'leave-room') {
        leaveCurrentRoom(ws, 'user-left');
        ws.send(JSON.stringify({ type: 'left-success' }));
        return;
      }

      // For all relay messages (chat, status, signals, voice call), forward ONLY to room peer
      const state = clientState.get(ws);
      if (!state) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not connected to any room.' }));
        return;
      }

      const room = activeRooms.get(state.roomId);
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room no longer exists.' }));
        return;
      }

      room.lastActive = Date.now();

      // Forward message directly to peer socket in the same room
      let forwarded = 0;
      for (const peerWs of room.clients) {
        if (peerWs !== ws && peerWs.readyState === WebSocket.OPEN) {
          peerWs.send(JSON.stringify({
            ...data,
            senderId: state.clientId,
            relayedAt: Date.now()
          }));
          forwarded++;
        }
      }

      if (forwarded === 0 && type === 'chat-message') {
        // If peer is not online, notify sender that message could not be delivered
        ws.send(JSON.stringify({
          type: 'delivery-failed',
          msgId: data.msgId,
          message: 'Peer is offline. Messages are not saved on the server.'
        }));
      }

    } catch (err) {
      // Internal parse error - silent response, no error detail leakage
      ws.send(JSON.stringify({ type: 'error', message: 'Malformed message request.' }));
    }
  });

  ws.on('close', () => {
    leaveCurrentRoom(ws, 'disconnected');
  });

  ws.on('error', () => {
    leaveCurrentRoom(ws, 'connection-error');
  });
});

// Heartbeat ping interval to drop broken socket connections (every 25 seconds)
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      leaveCurrentRoom(ws, 'timeout');
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 25000);

// Idle room garbage collection interval (every 1 minute)
// Cleans up rooms with 0 clients or rooms idle for > 10 minutes
const gcInterval = setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of activeRooms.entries()) {
    if (room.clients.size === 0 || (now - room.lastActive > 10 * 60 * 1000)) {
      // Force close any lingering connections in idle room
      for (const ws of room.clients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'room-closed', reason: 'idle-timeout' }));
          ws.close();
        }
      }
      activeRooms.delete(roomId);
    }
  }
}, 60000);

wss.on('close', () => {
  clearInterval(pingInterval);
  clearInterval(gcInterval);
});

function startServer(port) {
  server.listen(port, () => {
    console.log(`Private Room server listening on port ${port}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE' && !process.env.PORT) {
      console.log(`Port ${port} in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(PORT);

