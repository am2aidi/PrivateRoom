import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldAlert, ArrowRight } from 'lucide-react';

export function JoinRoom({ onJoin, errorMsg }) {
  const [roomName, setRoomName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!roomName.trim()) {
      setLocalError('Please enter a room name.');
      return;
    }
    if (!password.trim()) {
      setLocalError('Please enter a password.');
      return;
    }
    if (password.length < 4) {
      setLocalError('Password must be at least 4 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onJoin(roomName.trim(), password.trim());
    } catch (err) {
      setLocalError(err.message || 'Failed to generate encryption key.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPasswordWeak = password.length > 0 && password.length < 6;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      backgroundColor: '#08080a'
    }}>
      <div style={{ maxWidth: '420px', width: '100%' }}>
        
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <Lock size={26} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#ffffff', letterSpacing: '-0.5px' }}>
            Private Room
          </h1>
          <p style={{ color: '#8e8e98', fontSize: '14px', marginTop: '6px' }}>
            Zero records. End-to-end encrypted chat.
          </p>
        </div>

        {/* Join Form Card */}
        <div className="card-box">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            
            {/* Room Name Input */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8e8e98', marginBottom: '8px' }}>
                Room Name
              </label>
              <input
                type="text"
                placeholder="e.g. secret-meeting-42"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                style={{ width: '100%' }}
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
            </div>

            {/* Password Input with Eye Toggle */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8e8e98', marginBottom: '8px' }}>
                Room Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter secret room password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', paddingRight: '48px' }}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#8e8e98',
                    padding: '4px'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              
              {/* Weak Password Hint */}
              {isPasswordWeak && (
                <p style={{ color: '#ffb74d', fontSize: '12px', marginTop: '6px' }}>
                  Tip: Use longer passwords for stronger end-to-end key security.
                </p>
              )}
            </div>

            {/* Error Banners */}
            {(localError || errorMsg) && (
              <div className="badge-red-warning" style={{ width: '100%', justifyContent: 'center', textAlign: 'center' }}>
                <ShieldAlert size={16} />
                <span>{localError || errorMsg}</span>
              </div>
            )}

            {/* Join Action Button */}
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
              style={{ marginTop: '8px', opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting ? 'Deriving Encryption Keys...' : 'Join Room'}
              {!isSubmitting && <ArrowRight size={18} />}
            </button>
          </form>
        </div>

        {/* Security Assurance Disclaimer */}
        <p style={{
          textAlign: 'center',
          color: '#8e8e98',
          fontSize: '13px',
          marginTop: '24px',
          lineHeight: '1.5'
        }}>
          Nothing is saved. Everything disappears when you leave.
        </p>

      </div>
    </div>
  );
}
