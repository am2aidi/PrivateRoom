import React, { useState, useRef, useEffect } from 'react';
import { Shield, Image as ImageIcon, Phone, Send, LogOut } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { encryptText, encryptBuffer } from '../crypto/webcrypto';
import { stripExifData } from '../utils/screenshotGuard';

export function ChatRoom({
  roomId,
  secretKey,
  safetyCode,
  messages,
  peerIsTyping,
  onSendMessage,
  onSendImage,
  onTypingStatus,
  onStartCall,
  onLeaveRoom,
  onOpenedImage,
  onMessageExpired,
  connectionState
}) {
  const [inputText, setInputText] = useState('');
  const [deleteTimerSeconds, setDeleteTimerSeconds] = useState(10);
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

  // Handle Text Send
  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const textToSend = inputText.trim();
    setInputText('');
    onTypingStatus(false);

    try {
      const encrypted = await encryptText(textToSend, secretKey);
      onSendMessage(textToSend, encrypted, deleteTimerSeconds);
    } catch (err) {
      console.error('Failed to encrypt text message:', err);
    }
  };

  // Handle View-Once Image Select & Strip EXIF
  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // 1. Strip EXIF using canvas
      const cleanArrayBuffer = await stripExifData(file);

      // 2. Encrypt with secret key
      const encrypted = await encryptBuffer(cleanArrayBuffer, secretKey);

      // 3. Dispatch view-once payload
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
        
        {/* Safety Code Mnemonic Fingerprint */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            <span style={{ fontSize: '12px', fontWeight: '500', color: '#ffffff', letterSpacing: '0.5px' }}>
              {safetyCode}
            </span>
          </div>
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
          margin: '12px 0 24px 0',
          padding: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--card-border)',
          borderRadius: '12px'
        }}>
          <p style={{ fontSize: '12px', color: '#8e8e98' }}>
            🔒 End-to-end encrypted session. Verify 4-word safety code above with your partner.
          </p>
        </div>

        {/* Messages List */}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isOwn={msg.isOwn}
            secretKey={secretKey}
            roomId={roomId}
            onOpenedImage={onOpenedImage}
            onMessageExpired={onMessageExpired}
          />
        ))}

        <div ref={messagesEndRef} />
      </main>

      {/* Above Input: Typing Indicator (STRICT GREEN RULE) */}
      {peerIsTyping && (
        <div style={{ padding: '0 20px 8px 20px' }}>
          <div className="badge-green-typing">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span style={{ marginLeft: '4px' }}>typing...</span>
          </div>
        </div>
      )}

      {/* Bottom Input Control Bar */}
      <footer style={{
        padding: '12px 16px',
        backgroundColor: '#101014',
        borderTop: '1px solid var(--card-border)'
      }}>
        
        {/* Timer selection row */}
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

        <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          
          {/* Hidden File Input for View-Once Images */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            style={{ display: 'none' }}
          />

          {/* Image Upload Button */}
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

          {/* Main Text Box (Green Glow on Typing) */}
          <input
            type="text"
            className="input-typing"
            placeholder="Type encrypted message..."
            value={inputText}
            onChange={handleInputChange}
            style={{ flex: 1 }}
          />

          {/* Send Button */}
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
              opacity: inputText.trim() ? 1 : 0.5
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
