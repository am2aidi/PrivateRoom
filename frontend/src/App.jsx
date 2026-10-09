import React, { useState, useEffect, useRef } from 'react';
import './styles/global.css';

import { deriveRoomCredentials, decryptText } from './crypto/webcrypto';
import { setupScreenshotProtection } from './utils/screenshotGuard';
import { WebRTCManager } from './utils/webrtc';
import { VoiceChanger } from './audio/voiceChanger';

import { JoinRoom } from './components/JoinRoom';
import { WaitingRoom } from './components/WaitingRoom';
import { ChatRoom } from './components/ChatRoom';
import { CallOverlay } from './components/CallOverlay';
import { RoomClosed } from './components/RoomClosed';

export function App() {
  const [view, setView] = useState('JOIN'); // JOIN, WAITING, CHAT, CLOSED
  const [errorMsg, setErrorMsg] = useState('');
  const [closedReason, setClosedReason] = useState('');

  // E2EE Credentials & Profile State
  const [roomId, setRoomId] = useState('');
  const [secretKey, setSecretKey] = useState(null);
  const [safetyCode, setSafetyCode] = useState('');
  const [clientId] = useState(() => Math.random().toString(36).substring(2, 10));
  const [userNickname, setUserNickname] = useState('Anonymous');
  const [userAvatar, setUserAvatar] = useState('🥷');

  // Room State
  const [roomMembers, setRoomMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [peerIsTyping, setPeerIsTyping] = useState(false);
  const [connectionState, setConnectionState] = useState('disconnected');

  // Call & WebRTC State
  const [isCallActive, setIsCallActive] = useState(false);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [incomingCallerName, setIncomingCallerName] = useState('Peer');
  const [isMuted, setIsMuted] = useState(false);

  const wsRef = useRef(null);
  const webRTCRef = useRef(null);
  const voiceChangerRef = useRef(null);

  const getWsUrl = () => {
    if (import.meta.env.VITE_WS_URL) {
      return import.meta.env.VITE_WS_URL;
    }
    const host = window.location.hostname || 'localhost';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${host}:8080`;
  };

  // Screenshot guard on global focus
  useEffect(() => {
    if (view === 'CHAT') {
      const cleanup = setupScreenshotProtection(
        () => {},
        () => {
          handleScreenshotAlert('global', 'PrintScreen key pressed');
        }
      );
      return cleanup;
    }
  }, [view]);

  // Visibility change handling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wsRef.current && secretKey) {
        messages.forEach((msg) => {
          if (!msg.isOwn && !msg.seen && msg.type !== 'system') {
            sendWsMessage({
              type: 'message-status',
              msgId: msg.id,
              status: 'seen'
            });
            setMessages((prev) =>
              prev.map((m) => (m.id === msg.id ? { ...m, seen: true, status: 'seen' } : m))
            );
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [messages, secretKey]);

  const sendWsMessage = (payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  // 1. Join Room Action
  const handleJoin = async (roomName, password, nickname, avatar) => {
    setErrorMsg('');
    setUserNickname(nickname);
    setUserAvatar(avatar);

    try {
      const creds = await deriveRoomCredentials(roomName, password);
      setRoomId(creds.roomId);
      setSecretKey(creds.secretKey);
      setSafetyCode(creds.safetyCode);

      const wsUrl = getWsUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState('connected');
        ws.send(JSON.stringify({
          type: 'join-room',
          roomId: creds.roomId,
          clientId,
          nickname,
          avatar
        }));
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          handleServerMessage(data, creds.secretKey);
        } catch (err) {
          console.error('Error handling server message:', err);
        }
      };

      ws.onerror = () => {
        setErrorMsg('Failed to connect to signal server.');
        setView('JOIN');
      };

      ws.onclose = () => {
        setConnectionState('disconnected');
        if (view !== 'CLOSED' && view !== 'JOIN') {
          handleRoomClosed('Server connection closed.');
        }
      };

    } catch (err) {
      setErrorMsg(err.message || 'Key derivation failed.');
    }
  };

  // 2. Process incoming server messages
  const handleServerMessage = async (data, currentKey) => {
    switch (data.type) {
      case 'joined':
        if (data.peerCount === 1) {
          setView('WAITING');
        } else {
          setView('CHAT');
        }
        break;

      case 'peer-joined':
        setView('CHAT');
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            type: 'system',
            text: `${data.avatar || '👤'} ${data.nickname || 'A user'} joined the room.`,
            isWarning: false
          }
        ]);
        break;

      case 'peer-left':
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            type: 'system',
            text: `${data.avatar || '👤'} ${data.nickname || 'A user'} left the room.`,
            isWarning: false
          }
        ]);
        break;

      case 'room-members-update':
        setRoomMembers(data.members || []);
        if (data.peerCount > 1 && view === 'WAITING') {
          setView('CHAT');
        }
        break;

      case 'error':
        if (data.code === 'ROOM_FULL') {
          setErrorMsg('Room is full (maximum 10 people allowed).');
          cleanUpSession();
          setView('JOIN');
        } else {
          setErrorMsg(data.message);
        }
        break;

      case 'room-closed':
        handleRoomClosed(data.message);
        break;

      case 'chat-message':
        try {
          const decryptedText = await decryptText(data.encrypted, currentKey);
          const isVisible = document.visibilityState === 'visible';

          const newMsg = {
            id: data.msgId,
            text: decryptedText,
            type: 'text',
            isOwn: false,
            senderId: data.senderId,
            senderName: data.senderName,
            senderAvatar: data.senderAvatar,
            status: isVisible ? 'seen' : 'delivered',
            seen: isVisible,
            deleteTimer: data.deleteTimer || 10,
            timestamp: Date.now()
          };

          setMessages((prev) => [...prev, newMsg]);

          sendWsMessage({
            type: 'message-status',
            msgId: data.msgId,
            status: isVisible ? 'seen' : 'delivered'
          });
        } catch (e) {
          console.error('Failed to decrypt message:', e);
        }
        break;

      case 'image-message':
        setMessages((prev) => [
          ...prev,
          {
            id: data.imageId,
            type: 'image',
            isOwn: false,
            senderId: data.senderId,
            senderName: data.senderName,
            senderAvatar: data.senderAvatar,
            encryptedData: data.encrypted,
            status: 'unread',
            timestamp: Date.now()
          }
        ]);
        sendWsMessage({
          type: 'message-status',
          msgId: data.imageId,
          status: 'delivered'
        });
        break;

      case 'screenshot-alert-broadcast':
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            type: 'system',
            text: `⚠️ Warning: ${data.senderAvatar || '👤'} ${data.senderName || 'Someone'} attempted a screenshot!`,
            isWarning: true
          }
        ]);
        break;

      case 'message-status':
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === data.msgId) {
              const newStatus = data.status;
              const isSeen = newStatus === 'seen' || m.seen;
              return { ...m, status: newStatus, seen: isSeen };
            }
            return m;
          })
        );
        break;

      case 'typing-indicator':
        setPeerIsTyping(data.isTyping);
        break;

      case 'image-opened-signal':
        setMessages((prev) =>
          prev.map((m) => (m.id === data.imageId ? { ...m, status: 'opened' } : m))
        );
        break;

      case 'webrtc-signal':
        if (data.signalType === 'offer') {
          setIsIncomingCall(true);
          setIncomingOffer(data.sdp);
          setIncomingCallerName(data.senderName || 'Peer');
        } else if (webRTCRef.current) {
          webRTCRef.current.handleSignal(data);
        }
        break;
    }
  };

  // 3. User sends a text message
  const handleSendMessage = (plainText, encryptedObj, deleteTimer) => {
    const msgId = Math.random().toString(36).substring(2, 12);

    const newMsg = {
      id: msgId,
      text: plainText,
      type: 'text',
      isOwn: true,
      senderAvatar: userAvatar,
      senderName: userNickname,
      status: 'sent',
      seen: false,
      deleteTimer,
      timestamp: Date.now()
    };

    setMessages((prev) => [...prev, newMsg]);

    sendWsMessage({
      type: 'chat-message',
      msgId,
      encrypted: encryptedObj,
      deleteTimer
    });
  };

  // 4. User sends a View-Once Image
  const handleSendImage = (encryptedBufferObj) => {
    const imageId = Math.random().toString(36).substring(2, 12);

    const newMsg = {
      id: imageId,
      type: 'image',
      isOwn: true,
      senderAvatar: userAvatar,
      senderName: userNickname,
      encryptedData: encryptedBufferObj,
      status: 'sent',
      timestamp: Date.now()
    };

    setMessages((prev) => [...prev, newMsg]);

    sendWsMessage({
      type: 'image-message',
      imageId,
      encrypted: encryptedBufferObj
    });
  };

  // 5. Handle Screenshot Alert Broadcast
  const handleScreenshotAlert = (imageId, reason) => {
    sendWsMessage({
      type: 'screenshot-alert-broadcast',
      imageId,
      reason
    });

    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        type: 'system',
        text: `⚠️ Warning: You attempted a screenshot!`,
        isWarning: true
      }
    ]);
  };

  // 6. Handle Typing Status
  const handleTypingStatus = (isTyping) => {
    sendWsMessage({
      type: 'typing-indicator',
      isTyping
    });
  };

  // 7. Handle Image Opened Signal
  const handleOpenedImage = (imageId) => {
    sendWsMessage({
      type: 'image-opened-signal',
      imageId
    });
    setMessages((prev) =>
      prev.map((m) => (m.id === imageId ? { ...m, status: 'opened' } : m))
    );
  };

  const handleMessageExpired = (msgId) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  };

  // 8. Voice Call Handlers
  const handleStartCall = async () => {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const voiceChanger = new VoiceChanger();
      voiceChangerRef.current = voiceChanger;

      const processedStream = await voiceChanger.init(micStream);

      const manager = new WebRTCManager(sendWsMessage, {
        onCallEnded: () => endCallSession()
      });
      webRTCRef.current = manager;

      await manager.startCall(processedStream);
      setIsCallActive(true);
    } catch (err) {
      alert('Microphone access is required for voice calls.');
    }
  };

  const handleAcceptCall = async () => {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const voiceChanger = new VoiceChanger();
      voiceChangerRef.current = voiceChanger;

      const processedStream = await voiceChanger.init(micStream);

      const manager = new WebRTCManager(sendWsMessage, {
        onCallEnded: () => endCallSession()
      });
      webRTCRef.current = manager;

      await manager.acceptCall(processedStream, incomingOffer);
      setIsIncomingCall(false);
      setIsCallActive(true);
    } catch (err) {
      alert('Microphone access is required to accept call.');
    }
  };

  const handleToggleMute = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    if (voiceChangerRef.current) {
      voiceChangerRef.current.toggleMute(nextState);
    }
  };

  const endCallSession = () => {
    if (webRTCRef.current) {
      webRTCRef.current.endCall();
      webRTCRef.current = null;
    }
    if (voiceChangerRef.current) {
      voiceChangerRef.current.destroy();
      voiceChangerRef.current = null;
    }
    setIsCallActive(false);
    setIsIncomingCall(false);
    setIncomingOffer(null);
  };

  const handleLeaveRoom = () => {
    sendWsMessage({ type: 'leave-room' });
    handleRoomClosed('You left the room.');
  };

  const handleRoomClosed = (reason) => {
    endCallSession();
    cleanUpSession();
    setClosedReason(reason || 'The room has been closed.');
    setView('CLOSED');
  };

  const cleanUpSession = () => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setRoomId('');
    setSecretKey(null);
    setSafetyCode('');
    setMessages([]);
    setRoomMembers([]);
  };

  const handleGoHome = () => {
    setView('JOIN');
    setClosedReason('');
    setErrorMsg('');
  };

  return (
    <div className="app-viewport">
      {view === 'JOIN' && (
        <JoinRoom onJoin={handleJoin} errorMsg={errorMsg} />
      )}

      {view === 'WAITING' && (
        <WaitingRoom onCancel={handleLeaveRoom} />
      )}

      {view === 'CHAT' && (
        <ChatRoom
          roomId={roomId}
          secretKey={secretKey}
          safetyCode={safetyCode}
          messages={messages}
          roomMembers={roomMembers}
          peerIsTyping={peerIsTyping}
          userAvatar={userAvatar}
          userNickname={userNickname}
          onSendMessage={handleSendMessage}
          onSendImage={handleSendImage}
          onTypingStatus={handleTypingStatus}
          onStartCall={handleStartCall}
          onLeaveRoom={handleLeaveRoom}
          onOpenedImage={handleOpenedImage}
          onScreenshotAlert={handleScreenshotAlert}
          onMessageExpired={handleMessageExpired}
          connectionState={connectionState}
        />
      )}

      {(isCallActive || isIncomingCall) && (
        <CallOverlay
          onHangUp={endCallSession}
          onToggleMute={handleToggleMute}
          isMuted={isMuted}
          voiceChanger={voiceChangerRef.current}
          isIncomingCall={isIncomingCall}
          onAcceptCall={handleAcceptCall}
        />
      )}

      {view === 'CLOSED' && (
        <RoomClosed onGoHome={handleGoHome} reason={closedReason} />
      )}
    </div>
  );

}

export default App;
