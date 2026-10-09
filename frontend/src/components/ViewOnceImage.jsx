import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, X, ShieldAlert, Clock } from 'lucide-react';
import { decryptBuffer } from '../crypto/webcrypto';

export function ViewOnceImage({
  imagePayload,
  secretKey,
  roomId,
  onOpenedSignal,
  onScreenshotAlert
}) {
  const [isOpened, setIsOpened] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [decryptedBuffer, setDecryptedBuffer] = useState(null);
  const [viewTimeRemaining, setViewTimeRemaining] = useState(30);
  const [isBlownOut, setIsBlownOut] = useState(false);

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

  // 30-Second Active View Timer when user taps to open
  useEffect(() => {
    if (isViewing && !isOpened && !isBlownOut) {
      setViewTimeRemaining(30);
      const startTime = Date.now();

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, 30 - elapsed);
        setViewTimeRemaining(remaining);

        if (remaining <= 0) {
          finishAndErase('30s Timer expired');
        }
      }, 300);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [isViewing, isOpened, isBlownOut]);

  // Canvas Rendering & Moving Watermark
  useEffect(() => {
    if (!isViewing || !decryptedBuffer || isOpened || isBlownOut) {
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
        if (!isViewing || isBlownOut) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          return;
        }

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
  }, [isViewing, decryptedBuffer, isOpened, isBlownOut, roomId]);

  // Screenshot shortcut detection
  useEffect(() => {
    if (!isViewing || isOpened) return;

    const handleKeyDown = (e) => {
      if (
        e.key === 'PrintScreen' ||
        (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5')) ||
        (e.ctrlKey && e.key === 'p')
      ) {
        triggerScreenshotAlert('PrintScreen key');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isViewing, isOpened]);

  const triggerScreenshotAlert = (reason) => {
    setIsBlownOut(true);
    setIsViewing(false);
    setIsOpened(true);
    setDecryptedBuffer(null);

    if (onScreenshotAlert) {
      onScreenshotAlert(imagePayload.id, reason);
    }
    if (onOpenedSignal) {
      onOpenedSignal(imagePayload.id);
    }
  };

  const finishAndErase = (reason) => {
    setIsViewing(false);
    setIsOpened(true);
    setDecryptedBuffer(null); // PURGE RAM IMMEDIATELY

    if (onOpenedSignal) {
      onOpenedSignal(imagePayload.id);
    }
  };

  const handleStartView = () => {
    if (!isOpened && !isBlownOut && decryptedBuffer) {
      setIsViewing(true);
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

  // Active Viewing Mode with 30s Countdown
  if (isViewing) {
    return (
      <div
        className="view-once-box"
        style={{
          width: '260px',
          height: '240px',
          border: '1px solid var(--color-blue-status)',
          position: 'relative'
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: isBlownOut ? 'none' : 'block' }}
        />

        {/* Top Bar: 30s Countdown Badge & Close Button */}
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          right: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10
        }}>
          <div style={{
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#29b6f6',
            border: '1px solid rgba(41, 182, 246, 0.4)',
            padding: '3px 10px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <Clock size={13} />
            <span>{viewTimeRemaining}s left</span>
          </div>

          <button
            type="button"
            onClick={() => finishAndErase('User closed')}
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: '#ffffff',
              border: '1px solid var(--card-border)',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Close and erase image"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Initial Closed State: Click / Tap to Open
  return (
    <div
      className="view-once-box"
      onClick={handleStartView}
      style={{
        cursor: decryptedBuffer ? 'pointer' : 'wait'
      }}
    >
      <div style={{
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Eye size={22} color="#ffffff" />
      </div>
      <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: '600' }}>
        Tap to view image
      </span>
      <span style={{ color: '#8e8e98', fontSize: '11px' }}>
        Full 30s timer • Auto-erases
      </span>
    </div>
  );
}
