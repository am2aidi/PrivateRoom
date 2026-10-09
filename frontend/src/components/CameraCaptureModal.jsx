import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, RefreshCw, Check } from 'lucide-react';
import { stripExifData } from '../utils/screenshotGuard';

export function CameraCaptureModal({ onCapture, onClose }) {
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('user'); // 'user' (front) or 'environment' (back)
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Initialize camera stream
  useEffect(() => {
    let currentStream = null;

    async function startCamera() {
      setErrorMsg('');
      try {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });

        currentStream = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error('Camera access error:', err);
        setErrorMsg('Camera access failed or permission denied.');
      }
    }

    startCamera();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  // Flip between front & back camera
  const handleFlipCamera = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  // Snap photo frame from live video
  const handleSnap = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');

    // Flip horizontally if front camera for natural mirror effect
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedBlob(blob);
      }
    }, 'image/jpeg', 0.9);
  };

  // Confirm and send captured photo
  const handleConfirm = async () => {
    if (!capturedBlob) return;
    try {
      const file = new File([capturedBlob], 'camera-snap.jpg', { type: 'image/jpeg' });
      const cleanArrayBuffer = await stripExifData(file);
      onCapture(cleanArrayBuffer);
      handleCloseModal();
    } catch (err) {
      console.error('Failed to process camera capture:', err);
    }
  };

  const handleRetake = () => {
    setCapturedBlob(null);
  };

  const handleCloseModal = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.92)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '20px'
    }}>
      
      {/* Header */}
      <div style={{
        width: '100%',
        maxWidth: '480px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: '#ffffff'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Camera size={20} color="#29b6f6" />
          <span style={{ fontWeight: '600', fontSize: '16px' }}>Take View-Once Photo</span>
        </div>
        <button
          type="button"
          onClick={handleCloseModal}
          style={{
            color: '#8e8e98',
            padding: '6px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.08)'
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Video Preview / Captured Image */}
      <div style={{
        width: '100%',
        maxWidth: '480px',
        height: '360px',
        backgroundColor: '#101014',
        borderRadius: '20px',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--card-border)'
      }}>
        {errorMsg ? (
          <p style={{ color: 'var(--color-red-warning)', padding: '20px', textAlign: 'center', fontSize: '14px' }}>
            {errorMsg}
          </p>
        ) : capturedBlob ? (
          <img
            src={URL.createObjectURL(capturedBlob)}
            alt="Captured snap"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
            }}
          />
        )}
      </div>

      {/* Bottom Controls */}
      <div style={{ width: '100%', maxWidth: '480px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
        {capturedBlob ? (
          <>
            <button
              type="button"
              onClick={handleRetake}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <RefreshCw size={18} />
              Retake
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className="btn-primary"
              style={{ width: 'auto', padding: '12px 28px' }}
            >
              <Check size={18} />
              Send View-Once
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleFlipCamera}
              className="btn-secondary"
              style={{ padding: '12px 18px' }}
              title="Flip Camera"
            >
              <RefreshCw size={20} />
            </button>

            <button
              type="button"
              onClick={handleSnap}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                color: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(255, 255, 255, 0.4)'
              }}
              title="Snap Photo"
            >
              <Camera size={28} />
            </button>
          </>
        )}
      </div>

    </div>
  );
}
