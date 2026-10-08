import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldAlert, ArrowRight, User } from 'lucide-react';

const AVATARS = ['🥷', '👤', '🦊', '🐺', '🦉', '🦅', '⚡', '🛡️'];

export function JoinRoom({ onJoin, errorMsg }) {
  const [roomName, setRoomName] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🥷');
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
      setLocalError('Password must be at least 4 characters.');
      return;
    }

    const finalNickname = nickname.trim() || `User-${Math.floor(100 + Math.random() * 900)}`;

    setIsSubmitting(true);
    try {
      await onJoin(roomName.trim(), password.trim(), finalNickname, selectedAvatar);
    } catch (err) {
      setLocalError(err.message || 'Failed to generate encryption key.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
      <div style={{ maxWidth: '440px', width: '100%' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px'
          }}>
            <Lock size={26} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#ffffff', letterSpacing: '-0.5px' }}>
            Private Room
          </h1>
          <p style={{ color: '#8e8e98', fontSize: '13px', marginTop: '4px' }}>
            Zero records • End-to-end encrypted • Up to 10 users
          </p>
        </div>

        {/* Join Card */}
        <div className="card-box">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Avatar Selection */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8e8e98', marginBottom: '8px' }}>
                Choose Profile Avatar
              </label>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                {AVATARS.map((avatar) => {
                  const isSelected = selectedAvatar === avatar;
                  return (
                    <button
                      key={avatar}
                      type="button"
                      onClick={() => setSelectedAvatar(avatar)}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        fontSize: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        border: isSelected ? '1px solid #ffffff' : '1px solid var(--card-border)',
                        transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {avatar}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Display Name Input */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8e8e98', marginBottom: '6px' }}>
                Display Nickname (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Alex"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                style={{ width: '100%' }}
                maxLength={16}
              />
            </div>

            {/* Room Name Input */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8e8e98', marginBottom: '6px' }}>
                Room Name
              </label>
              <input
                type="text"
                placeholder="e.g. secret-meeting-42"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                style={{ width: '100%' }}
                autoComplete="off"
              />
            </div>

            {/* Password Input */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8e8e98', marginBottom: '6px' }}>
                Room Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter secret room password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', paddingRight: '48px' }}
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
            </div>

            {/* Error Banners */}
            {(localError || errorMsg) && (
              <div className="badge-red-warning" style={{ width: '100%', justifyContent: 'center', textAlign: 'center' }}>
                <ShieldAlert size={16} />
                <span>{localError || errorMsg}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
              style={{ marginTop: '6px', opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting ? 'Deriving Encryption Keys...' : 'Join Room'}
              {!isSubmitting && <ArrowRight size={18} />}
            </button>
          </form>
        </div>

        <p style={{
          textAlign: 'center',
          color: '#8e8e98',
          fontSize: '13px',
          marginTop: '20px',
          lineHeight: '1.5'
        }}>
          Nothing is saved. Everything disappears when you leave.
        </p>

      </div>
    </div>
  );
}
