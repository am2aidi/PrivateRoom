import React, { useEffect, useState } from 'react';
import { Check, CheckCheck, Eye } from 'lucide-react';
import { ViewOnceImage } from './ViewOnceImage';

export function MessageBubble({
  msg,
  isOwn,
  secretKey,
  roomId,
  onOpenedImage,
  onMessageExpired
}) {
  const [timeLeft, setTimeLeft] = useState(msg.deleteTimer || 10);
  const [progressPercent, setProgressPercent] = useState(100);

  // Auto-delete timer starts when message is Seen or for received message
  useEffect(() => {
    if (msg.type === 'image') return; // Images handled by view-once
    if (!msg.seen) return; // Wait until seen status

    const totalSeconds = msg.deleteTimer || 10;
    const startTime = Date.now();
    const endTime = startTime + totalSeconds * 1000;

    const interval = setInterval(() => {
      const now = Date.now();
      const remainingMs = Math.max(0, endTime - now);
      const remainingSec = Math.ceil(remainingMs / 1000);
      
      setTimeLeft(remainingSec);
      setProgressPercent((remainingMs / (totalSeconds * 1000)) * 100);

      if (remainingMs <= 0) {
        clearInterval(interval);
        if (onMessageExpired) {
          onMessageExpired(msg.id);
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [msg.seen, msg.id, msg.deleteTimer, msg.type, onMessageExpired]);

  return (
    <div className={`msg-container ${isOwn ? 'msg-sent' : 'msg-received'}`}>
      
      {/* View-Once Image or Encrypted Text */}
      {msg.type === 'image' ? (
        <ViewOnceImage
          imagePayload={msg}
          secretKey={secretKey}
          roomId={roomId}
          onOpenedSignal={onOpenedImage}
        />
      ) : (
        <div className="msg-bubble">
          <p>{msg.text}</p>

          {/* Delete Timer Progress Bar (if Seen) */}
          {msg.seen && (
            <div style={{ marginTop: '6px' }}>
              <div
                className="delete-timer-bar"
                style={{ width: `${progressPercent}%` }}
              />
              <span style={{ fontSize: '10px', color: '#8e8e98', display: 'block', marginTop: '2px', textAlign: 'right' }}>
                {timeLeft}s left
              </span>
            </div>
          )}
        </div>
      )}

      {/* Message Status Bar (Sent, Delivered, Seen in Blue) for Own Messages */}
      {isOwn && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '4px',
          marginTop: '4px',
          fontSize: '11px'
        }}>
          {msg.status === 'seen' || msg.seen ? (
            <span style={{ color: 'var(--color-blue-status)', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: '500' }}>
              <CheckCheck size={14} /> Seen
            </span>
          ) : msg.status === 'delivered' ? (
            <span style={{ color: '#8e8e98', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <CheckCheck size={14} /> Delivered
            </span>
          ) : (
            <span style={{ color: '#8e8e98', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <Check size={14} /> Sent
            </span>
          )}
        </div>
      )}

    </div>
  );
}
