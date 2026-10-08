import React, { useEffect, useState } from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { ViewOnceImage } from './ViewOnceImage';

export function MessageBubble({
  msg,
  isOwn,
  secretKey,
  roomId,
  onOpenedImage,
  onScreenshotAlert,
  onMessageExpired
}) {
  const [timeLeft, setTimeLeft] = useState(msg.deleteTimer || 10);
  const [progressPercent, setProgressPercent] = useState(100);

  useEffect(() => {
    if (msg.type === 'image') return;
    if (!msg.seen) return;

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
      
      {/* Sender Avatar & Name Header (for Received Messages in Multi-User Chat) */}
      {!isOwn && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '4px',
          fontSize: '12px',
          color: '#8e8e98'
        }}>
          <span style={{ fontSize: '15px' }}>{msg.senderAvatar || '👤'}</span>
          <span style={{ fontWeight: '500', color: '#e0e0e0' }}>{msg.senderName || 'Peer'}</span>
        </div>
      )}

      {/* Message Content: Image or Text */}
      {msg.type === 'image' ? (
        <ViewOnceImage
          imagePayload={msg}
          secretKey={secretKey}
          roomId={roomId}
          onOpenedSignal={onOpenedImage}
          onScreenshotAlert={onScreenshotAlert}
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

      {/* Status marks for own messages */}
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
