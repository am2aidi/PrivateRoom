import React, { useState, useRef, useEffect } from 'react';
import { Shield, Image as ImageIcon, Phone, Send, LogOut, Users, AlertTriangle } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { encryptText, encryptBuffer } from '../crypto/webcrypto';
import { stripExifData } from '../utils/screenshotGuard';

export function ChatRoom({
  roomId,
  secretKey,
  safetyCode,
  messages,
  roomMembers,
  peerIsTyping,
  userAvatar,
  userNickname,
  onSendMessage,
  onSendImage,
  onTypingStatus,
  onStartCall,
  onLeaveRoom,
  onOpenedImage,
  onScreenshotAlert,
  onMessageExpired
}) {
  const [inputText, setInputText] = useState('');
  const [deleteTimerSeconds, setDeleteTimerSeconds] = useState(10);
  const [showMembersList, setShowMembersList] = useState(false);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, peerIsTyping]);

  // Handle typing indicator
  const handleInputChange = (e) => {
    setInputText(e.target.value);

    onTypingStatus(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTypingStatus(false);
    }, 1500);
  };

  // Handle KeyDown Enter submit
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  // Handle Text Send
  const handleSend = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!inputText.trim()) return;

    const textToSend = inputText.trim();
    setInputText('');
    onTypingStatus(false);

    try {
      const encrypted = await encryptText(textToSend, secretKey);
      onSendMessage(textToSend, encrypted, deleteTimerSeconds);
    } catch (err) {
      console.error('Failed to encrypt message:', err);
    }
  };

  // Handle View-Once Image Select
  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const cleanArrayBuffer = await stripExifData(file);
      const encrypted = await encryptBuffer(cleanArrayBuffer, secretKey);
      onSendImage(encrypted);
    } catch (err) {
      console.error('Failed to process image:', err);
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#08080a',
      color: '#ffffff'
    }}>
      
      {/* Top Header Bar */}
      <header style={{
        padding: '12px 16px',
        backgroundColor: '#101014',
        borderBottom: '1px solid var(--card-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10
      }}>
        
        {/* Safety Code Mnemonic & Member Count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            padding: '6px 10px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--card-border)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Shield size={14} color="#8e8e98" />
            <span style={{ fontSize: '12px', fontWeight: '500', color: '#ffffff' }}>
              {safetyCode}
            </span>
          </div>

          {/* Members Toggle Button */}
          <button
            type="button"
            onClick={() => setShowMembersList(!showMembersList)}
            style={{
              padding: '6px 10px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--card-border)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#ffffff',
              fontSize: '12px'
            }}
          >
            <Users size={14} />
            <span>{roomMembers.length}/10</span>
          </button>
        </div>

        {/* Live Indicator & Leave Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="badge-blue">
            <span className="live-dot" />
            <span>Live</span>
          </div>

          <button
            onClick={onLeaveRoom}
            className="btn-danger"
            style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <LogOut size={14} />
            Leave
          </button>
        </div>

      </header>

      {/* Members Drawer Overlay (Up to 10 users) */}
      {showMembersList && (
        <div style={{
          backgroundColor: '#14141a',
          borderBottom: '1px solid var(--card-border)',
          padding: '12px 16px',
          display: 'flex',
          gap: '12px',
          overflowX: 'auto'
        }}>
          {roomMembers.map((m) => (
            <div key={m.clientId} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              borderRadius: '16px',
              fontSize: '13px',
              whiteSpace: 'nowrap'
            }}>
              <span style={{ fontSize: '16px' }}>{m.avatar}</span>
              <span style={{ fontWeight: '500' }}>{m.nickname}</span>
              <span className="live-dot" style={{ width: '6px', height: '6px', marginLeft: '2px' }} />
            </div>
          ))}
        </div>
      )}

      {/* Middle Message Feed */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/* Encrypted Session Banner */}
        <div style={{
          textAlign: 'center',
          margin: '8px 0 20px 0',
          padding: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--card-border)',
          borderRadius: '12px'
        }}>
          <p style={{ fontSize: '12px', color: '#8e8e98' }}>
            🔒 End-to-end encrypted session • Max 10 users • Verify 4-word code above.
          </p>
        </div>

        {/* Messages List & System Notifications */}
        {messages.map((msg) => {
          if (msg.type === 'system') {
            return (
              <div key={msg.id} style={{
                textAlign: 'center',
                margin: '8px 0',
                padding: '6px 12px',
                borderRadius: '12px',
                backgroundColor: msg.isWarning ? 'rgba(255, 82, 82, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                border: msg.isWarning ? '1px solid rgba(255, 82, 82, 0.3)' : '1px solid var(--card-border)',
                color: msg.isWarning ? 'var(--color-red-warning)' : '#8e8e98',
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                alignSelf: 'center'
              }}>
                {msg.isWarning && <AlertTriangle size={14} />}
                <span>{msg.text}</span>
              </div>
            );
          }

          return (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isOwn={msg.isOwn}
              secretKey={secretKey}
              roomId={roomId}
              onOpenedImage={onOpenedImage}
              onScreenshotAlert={onScreenshotAlert}
              onMessageExpired={onMessageExpired}
            />
          );
        })}

        <div ref={messagesEndRef} />
      </main>

      {/* Typing Indicator */}
      {peerIsTyping && (
        <div style={{ padding: '0 20px 8px 20px' }}>
          <div className="badge-green-typing">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span style={{ marginLeft: '4px' }}>someone is writing...</span>
          </div>
        </div>
      )}

      {/* Footer Input Bar */}
      <footer style={{
        padding: '12px 16px',
        backgroundColor: '#101014',
        borderTop: '1px solid var(--card-border)'
      }}>
        
        {/* Timer Selector */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', color: '#8e8e98' }}>Auto-delete timer:</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[10, 20, 30].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setDeleteTimerSeconds(sec)}
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: deleteTimerSeconds === sec ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                  color: deleteTimerSeconds === sec ? '#ffffff' : '#8e8e98',
                  border: deleteTimerSeconds === sec ? '1px solid rgba(255,255,255,0.3)' : 'none'
                }}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>

        {/* Input & Action Form */}
        <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            style={{ display: 'none' }}
          />

          {/* View-Once Image Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              color: '#ffffff',
              border: '1px solid var(--card-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Send View-Once Image"
          >
            <ImageIcon size={20} />
          </button>

          {/* Voice Call Button */}
          <button
            type="button"
            onClick={onStartCall}
            style={{
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              color: '#ffffff',
              border: '1px solid var(--card-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Start Encrypted Voice Call"
          >
            <Phone size={20} />
          </button>

          {/* Text Input Box */}
          <input
            type="text"
            className="input-typing"
            placeholder="Type encrypted message (press Enter)..."
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            style={{ flex: 1 }}
          />

          {/* Prominent Send Button */}
          <button
            type="submit"
            style={{
              padding: '12px 18px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              color: '#000000',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: inputText.trim() ? 1 : 0.4,
              cursor: inputText.trim() ? 'pointer' : 'default'
            }}
            disabled={!inputText.trim()}
          >
            <Send size={18} />
          </button>

        </form>
      </footer>

    </div>
  );
}
