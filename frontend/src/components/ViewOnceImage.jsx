import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { decryptBuffer } from '../crypto/webcrypto';

export function ViewOnceImage({
  imagePayload,
  secretKey,
  roomId,
  onOpenedSignal,
  onScreenshotAlert
}) {
  const [isOpened, setIsOpened] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [decryptedBuffer, setDecryptedBuffer] = useState(null);
  const [viewTimeRemaining, setViewTimeRemaining] = useState(30);
  const [isBlownOut, setIsBlownOut] = useState(false); // Screen blank flag on screenshot attempt

  const canvasRef = useRef(null);
  const timerRef = useRef(null);
  const watermarkAnimRef = useRef(null);

  // Decrypt image buffer on mount
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
    return () => { isMounted = false; };
  }, [imagePayload, secretKey]);

  // Handle 30-Second Active View Timer while holding
  useEffect(() => {
    if (isPressing && !isOpened && !isBlownOut) {
      setViewTimeRemaining(30);
      const startTime = Date.now();

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, 30 - elapsed);
        setViewTimeRemaining(remaining);

        if (remaining <= 0) {
          handleForceClose('Timer expired');
        }
      }, 500);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [isPressing, isOpened, isBlownOut]);

  // Canvas Drawing & Watermark
  useEffect(() => {
    if (!isPressing || !decryptedBuffer || isOpened || isBlownOut) {
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
        if (!isPressing || !document.hasFocus() || isBlownOut) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          return;
        }

        // Draw image
        ctx.drawImage(img, 0, 0);

        // Overlay Moving Watermark
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.font = 'bold 18px sans-serif';

        offset = (offset + 0.5) % 100;
        const timestamp = new Date().toLocaleTimeString();
        const watermarkText = `CONFIDENTIAL • ROOM: ${roomId.substring(0, 6)} • ${timestamp}`;

        for (let y = 40; y < canvas.height; y += 90) {
          for (let x = (y + offset * 4) % 200 - 100; x < canvas.width; x += 340) {
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
  }, [isPressing, decryptedBuffer, isOpened, isBlownOut, roomId]);

  // Screenshot Detection while holding view-once image
  useEffect(() => {
    if (!isPressing || isOpened) return;

    const handleKeyDown = (e) => {
      if (
        e.key === 'PrintScreen' ||
        (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5')) ||
        (e.ctrlKey && e.key === 'p')
      ) {
        triggerScreenshotProtection('PrintScreen key');
      }
    };

    const handleBlur = () => {
      triggerScreenshotProtection('Window focus lost / screen capture');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleBlur);
    };
  }, [isPressing, isOpened]);

  // Blank out image and alert room on screenshot attempt
  const triggerScreenshotProtection = (reason) => {
    setIsBlownOut(true);
    setIsPressing(false);
    setIsOpened(true);
    setDecryptedBuffer(null); // PURGE RAM IMMEDIATELY

    if (onScreenshotAlert) {
      onScreenshotAlert(imagePayload.id, reason);
    }
    if (onOpenedSignal) {
      onOpenedSignal(imagePayload.id);
    }
  };

  const handleForceClose = (reason) => {
    setIsPressing(false);
    setIsOpened(true);
    setDecryptedBuffer(null);

    if (onOpenedSignal) {
      onOpenedSignal(imagePayload.id);
    }
  };

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
      onMouseUp={() => handleForceClose('Released')}
      onMouseLeave={() => handleForceClose('Mouse left')}
      onTouchStart={() => setIsPressing(true)}
      onTouchEnd={() => handleForceClose('Touch ended')}
      onTouchCancel={() => handleForceClose('Touch cancelled')}
      style={{
        border: isPressing ? '1px solid var(--color-blue-status)' : '1px solid var(--card-border)'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: isPressing && !isBlownOut ? 'block' : 'none',
          pointerEvents: 'none'
        }}
      />

      {isPressing && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          color: '#ffffff',
          padding: '2px 8px',
          borderRadius: '10px',
          fontSize: '11px',
          fontWeight: '600',
          zIndex: 5
        }}>
          {viewTimeRemaining}s left
        </div>
      )}

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
            Press & hold to view (max 30s)
          </span>
          <span style={{ color: '#8e8e98', fontSize: '11px' }}>
            View once • Screenshot protected
          </span>
        </>
      )}
    </div>
  );
}
