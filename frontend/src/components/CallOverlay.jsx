import React, { useState, useEffect } from 'react';
import { Mic, MicOff, PhoneOff, Sliders, Layers } from 'lucide-react';

export function CallOverlay({
  onHangUp,
  onToggleMute,
  isMuted,
  voiceChanger,
  isIncomingCall,
  onAcceptCall
}) {
  const [activeEffect, setActiveEffect] = useState('normal');
  const [stackedEffect, setStackedEffect] = useState('none');
  const [callDuration, setCallDuration] = useState(0);

  // Call timer
  useEffect(() => {
    if (isIncomingCall) return;
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isIncomingCall]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const handleSelectEffect = (preset) => {
    if (activeEffect === preset) {
      setActiveEffect('normal');
      if (voiceChanger) voiceChanger.setEffect('normal', stackedEffect);
    } else {
      setActiveEffect(preset);
      if (voiceChanger) voiceChanger.setEffect(preset, stackedEffect);
    }
  };

  const handleSelectStacked = (preset) => {
    if (stackedEffect === preset) {
      setStackedEffect('none');
      if (voiceChanger) voiceChanger.setEffect(activeEffect, 'none');
    } else {
      setStackedEffect(preset);
      if (voiceChanger) voiceChanger.setEffect(activeEffect, preset);
    }
  };

  // Incoming Call State
  if (isIncomingCall) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#08080a',
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: 'rgba(41, 182, 246, 0.15)',
          border: '1px solid var(--color-blue-status)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
          animation: 'pulse-live 1.5s infinite'
        }}>
          <Mic size={36} color="var(--color-blue-status)" />
        </div>

        <h2 style={{ fontSize: '22px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
          Incoming Encrypted Voice Call
        </h2>
        <p style={{ color: '#8e8e98', fontSize: '14px', marginBottom: '36px' }}>
          Voice modifier will process your mic audio before sending.
        </p>

        <div style={{ display: 'flex', gap: '20px' }}>
          <button
            onClick={onHangUp}
            className="btn-danger"
            style={{ padding: '14px 28px', fontSize: '16px' }}
          >
            Decline
          </button>
          <button
            onClick={onAcceptCall}
            className="btn-primary"
            style={{ padding: '14px 28px', fontSize: '16px' }}
          >
            Accept Call
          </button>
        </div>
      </div>
    );
  }

  // Active Call State
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#08080a',
      zIndex: 999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '40px 24px',
      textAlign: 'center'
    }}>
      
      {/* Header Status */}
      <div>
        <div className="badge-blue" style={{ marginBottom: '12px' }}>
          <span className="live-dot" />
          <span>In call</span>
          <span style={{ opacity: 0.7, marginLeft: '6px' }}>{formatTimer(callDuration)}</span>
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: '500', color: '#ffffff' }}>
          End-to-End Voice Connection
        </h2>
      </div>

      {/* Voice Effects Chooser */}
      <div className="card-box" style={{ width: '100%', maxWidth: '380px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8e8e98', fontSize: '13px', marginBottom: '16px' }}>
          <Sliders size={16} />
          <span>Primary Voice Effect</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
          {['deep', 'high', 'robot', 'whisper'].map((preset) => {
            const isSelected = activeEffect === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => handleSelectEffect(preset)}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '500',
                  textTransform: 'capitalize',
                  border: isSelected ? '1px solid #ffffff' : '1px solid var(--card-border)',
                  backgroundColor: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.04)',
                  color: isSelected ? '#000000' : '#ffffff',
                  transition: 'all 0.2s ease'
                }}
              >
                {preset}
              </button>
            );
          })}
        </div>

        {/* Optional Secondary Effect Stacking */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8e8e98', fontSize: '13px', marginBottom: '12px' }}>
          <Layers size={16} />
          <span>Stack Secondary Effect (Double Layer)</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {['deep', 'high', 'robot', 'whisper'].map((preset) => {
            const isSelected = stackedEffect === preset;
            const isDisabled = activeEffect === preset;
            return (
              <button
                key={`stacked-${preset}`}
                type="button"
                disabled={isDisabled}
                onClick={() => handleSelectStacked(preset)}
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '500',
                  textTransform: 'capitalize',
                  border: isSelected ? '1px solid #ffffff' : '1px solid var(--card-border)',
                  backgroundColor: isSelected ? '#ffffff' : 'transparent',
                  color: isSelected ? '#000000' : isDisabled ? '#444' : '#8e8e98',
                  opacity: isDisabled ? 0.4 : 1
                }}
              >
                + {preset}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Call Action Buttons: Mute & Hangup */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        
        {/* Big White Mute Button */}
        <button
          onClick={onToggleMute}
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: isMuted ? 'rgba(255, 82, 82, 0.2)' : '#ffffff',
            color: isMuted ? 'var(--color-red-warning)' : '#000000',
            border: isMuted ? '1px solid var(--color-red-warning)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
          }}
        >
          {isMuted ? <MicOff size={26} /> : <Mic size={26} />}
        </button>

        {/* Big Red Hang-Up Button */}
        <button
          onClick={onHangUp}
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-red-warning)',
            color: '#ffffff',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(255, 82, 82, 0.4)'
          }}
        >
          <PhoneOff size={26} />
        </button>

      </div>

    </div>
  );
}
