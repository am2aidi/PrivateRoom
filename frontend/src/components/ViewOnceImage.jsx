import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, CheckCheck, Lock } from 'lucide-react';
import { decryptBuffer } from '../crypto/webcrypto';

export function ViewOnceImage({ imagePayload, secretKey, roomId, onOpenedSignal }) {
  const [isOpened, setIsOpened] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [decryptedBuffer, setDecryptedBuffer] = useState(null);
  const canvasRef = useRef(null);
  const watermarkAnimRef = useRef(null);

  // Decrypt image when payload arrives
  useEffect(() => {
    let isMounted = true;
    async function loadAndDecrypt() {
      try {
        if (imagePayload.status === 'opened') {
          setIsOpened(true);
          return;
        }
        const buffer = await decryptBuffer(imagePayload.encryptedData, secretKey);
        if (isMounted) {
          setDecryptedBuffer(buffer);
        }
      } catch (err) {
        console.error('Failed to decrypt view-once image:', err);
      }
    }
    loadAndDecrypt();
    return () => {
      isMounted = false;
    };
  }, [imagePayload, secretKey]);

  // Handle Canvas Drawing while Pressing
  useEffect(() => {
    if (!isPressing || !decryptedBuffer || isOpened) {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      if (watermarkAnimRef.current) {
        cancelAnimationFrame(watermarkAnimRef.current);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const blob = new Blob([decryptedBuffer], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    let offset = 0;

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      const renderFrame = () => {
        if (!isPressing || !document.hasFocus()) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          return;
        }

        // 1. Draw actual decrypted image
        ctx.drawImage(img, 0, 0);

        // 2. Draw Faint Moving Watermark (Room ID + Timestamp)
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.font = 'bold 16px sans-serif';
        
        offset = (offset + 0.5) % 100;
        const timestamp = new Date().toLocaleTimeString();
        const watermarkText = `CONFIDENTIAL • ROOM: ${roomId.substring(0, 8)} • ${timestamp}`;

        for (let y = 30; y < canvas.height; y += 80) {
          for (let x = (y + offset * 4) % 200 - 100; x < canvas.width; x += 320) {
            ctx.fillText(watermarkText, x, y);
          }
        }
        ctx.restore();

        watermarkAnimRef.current = requestAnimationFrame(renderFrame);
      };

      renderFrame();
    };

    img.src = url;

    return () => {
      URL.revokeObjectURL(url);
      if (watermarkAnimRef.current) {
        cancelAnimationFrame(watermarkAnimRef.current);
      }
    };
  }, [isPressing, decryptedBuffer, isOpened, roomId]);

  // Finish viewing image permanently
  const handleRelease = () => {
    if (isPressing && !isOpened) {
      setIsPressing(false);
      setIsOpened(true);
      setDecryptedBuffer(null); // PURGE FROM RAM IMMEDIATELY!

      if (onOpenedSignal) {
        onOpenedSignal(imagePayload.id);
      }
    }
  };

  // If already opened, display "Opened" status in blue
  if (isOpened || imagePayload.status === 'opened') {
    return (
      <div className="view-once-box" style={{ opacity: 0.7, cursor: 'default' }}>
        <EyeOff size={24} color="#29b6f6" />
        <span style={{ color: '#29b6f6', fontSize: '13px', fontWeight: '500' }}>
          Image opened
        </span>
      </div>
    );
  }

  return (
    <div
      className="view-once-box"
      onMouseDown={() => setIsPressing(true)}
      onMouseUp={handleRelease}
      onMouseLeave={handleRelease}
      onTouchStart={() => setIsPressing(true)}
      onTouchEnd={handleRelease}
      onTouchCancel={handleRelease}
      style={{
        border: isPressing ? '1px solid var(--color-blue-status)' : '1px solid var(--card-border)'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: isPressing ? 'block' : 'none',
          pointerEvents: 'none'
        }}
      />

      {!isPressing && (
        <>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Eye size={20} color="#ffffff" />
          </div>
          <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: '500' }}>
            Press and hold to view
          </span>
          <span style={{ color: '#8e8e98', fontSize: '11px' }}>
            View once • Auto-erases
          </span>
        </>
      )}
    </div>
  );
}
