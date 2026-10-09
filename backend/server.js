/**
 * Private Room Backend Server
 * Zero-record, memory-only WebSocket relay server.
 * 
 * Room Lifecycle Rule:
 * - Room supports up to 10 members.
 * - While 2+ members are present, room stays OPEN when people join/leave.
 * - When member count drops to 1 (only 1 person remains), notify the last person
 *   that the room is closed and wipe all room memory completely from RAM!
 */

const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 8080;
const MAX_ROOM_CLIENTS = 10;

// Memory storage for active rooms (RAM only)
const activeRooms = new Map();

const server = http.createServer((req, res) => {
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

const clientState = new Map();

function broadcastRoomMembers(room) {
  const membersList = [];
  for (const [ws, info] of room.clients.entries()) {
    membersList.push({
      clientId: info.clientId,
      avatar: info.avatar,
      nickname: info.nickname
    });
  }

  const payload = JSON.stringify({
    type: 'room-members-update',
    members: membersList,
    peerCount: membersList.length
  });

  for (const [ws] of room.clients.entries()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function leaveCurrentRoom(ws, reason = 'left') {
  const state = clientState.get(ws);
  if (!state) return;

  const { roomId, clientId, nickname, avatar } = state;
  clientState.delete(ws);

  const room = activeRooms.get(roomId);
  if (!room) return;

  // Remove client from room
  room.clients.delete(ws);

  // If 2+ people remain: Keep room OPEN, send leave notice & update list
  if (room.clients.size > 1) {
    const leavePayload = JSON.stringify({
      type: 'peer-left',
      clientId,
      nickname,
      avatar,
      reason,
      message: `${nickname || 'A user'} left the room.`
    });

    for (const [peerWs] of room.clients.entries()) {
      if (peerWs.readyState === WebSocket.OPEN) {
        peerWs.send(leavePayload);
      }
    }
    broadcastRoomMembers(room);
  } 
  // If ONLY 1 person remains (or 0): Close room for the last remaining person & erase from RAM!
  else if (room.clients.size === 1) {
    const closePayload = JSON.stringify({
      type: 'room-closed',
      reason: 'only-one-remains',
      message: 'All other members have left the room. Room closed. Nothing was saved.'
    });

    for (const [lastWs] of room.clients.entries()) {
      if (lastWs.readyState === WebSocket.OPEN) {
        lastWs.send(closePayload);
      }
      clientState.delete(lastWs);
    }

    activeRooms.delete(roomId);
  } else {
    // 0 clients left -> Wipe from RAM
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

      if (rawMessage.length > 5 * 1024 * 1024) {
        ws.send(JSON.stringify({ type: 'error', message: 'Payload too large.' }));
        return;
      }

      if (type === 'join-room') {
        const { roomId, clientId, nickname, avatar } = data;
        if (!roomId || typeof roomId !== 'string' || roomId.length < 8) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid Room ID.' }));
          return;
        }

        if (clientState.has(ws)) {
          leaveCurrentRoom(ws, 'switched-room');
        }

        let room = activeRooms.get(roomId);

        if (!room) {
          room = {
            roomId,
            clients: new Map(),
            createdAt: Date.now(),
            lastActive: Date.now()
          };
          activeRooms.set(roomId, room);
        }

        if (room.clients.size >= MAX_ROOM_CLIENTS) {
          ws.send(JSON.stringify({
            type: 'error',
            code: 'ROOM_FULL',
            message: `Room is full (maximum ${MAX_ROOM_CLIENTS} people allowed).`
          }));
          return;
        }

        const clientInfo = {
          clientId: clientId || Math.random().toString(36).substring(2, 10),
          nickname: nickname || 'Anonymous',
          avatar: avatar || '🥷',
          joinTime: Date.now()
        };

        room.clients.set(ws, clientInfo);
        room.lastActive = Date.now();

        clientState.set(ws, {
          roomId,
          ...clientInfo
        });

        // Respond to joined user
        ws.send(JSON.stringify({
          type: 'joined',
          clientId: clientInfo.clientId,
          peerCount: room.clients.size,
          maxClients: MAX_ROOM_CLIENTS,
          message: `Joined room! (${room.clients.size}/${MAX_ROOM_CLIENTS} users)`
        }));

        // Notify existing members
        for (const [peerWs, info] of room.clients.entries()) {
          if (peerWs !== ws && peerWs.readyState === WebSocket.OPEN) {
            peerWs.send(JSON.stringify({
              type: 'peer-joined',
              clientId: clientInfo.clientId,
              nickname: clientInfo.nickname,
              avatar: clientInfo.avatar,
              message: `${clientInfo.nickname} joined the room.`
            }));
          }
        }

        broadcastRoomMembers(room);
        return;
      }

      if (type === 'leave-room') {
        leaveCurrentRoom(ws, 'user-left');
        ws.send(JSON.stringify({ type: 'left-success' }));
        return;
      }

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

      if (data.targetId) {
        for (const [peerWs, info] of room.clients.entries()) {
          if (info.clientId === data.targetId && peerWs.readyState === WebSocket.OPEN) {
            peerWs.send(JSON.stringify({
              ...data,
              senderId: state.clientId,
              senderName: state.nickname,
              senderAvatar: state.avatar,
              relayedAt: Date.now()
            }));
            break;
          }
        }
        return;
      }

      for (const [peerWs] of room.clients.entries()) {
        if (peerWs !== ws && peerWs.readyState === WebSocket.OPEN) {
          peerWs.send(JSON.stringify({
            ...data,
            senderId: state.clientId,
            senderName: state.nickname,
            senderAvatar: state.avatar,
            relayedAt: Date.now()
          }));
        }
      }

    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'Malformed request.' }));
    }
  });

  ws.on('close', () => {
    leaveCurrentRoom(ws, 'disconnected');
  });

  ws.on('error', () => {
    leaveCurrentRoom(ws, 'connection-error');
  });
});

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

const gcInterval = setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of activeRooms.entries()) {
    if (room.clients.size === 0 || (now - room.lastActive > 15 * 60 * 1000)) {
      for (const [ws] of room.clients.entries()) {
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
