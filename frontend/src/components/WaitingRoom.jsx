import React from 'react';
import { Loader2, X } from 'lucide-react';

export function WaitingRoom({ onCancel }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '24px',
      backgroundColor: '#08080a',
      textAlign: 'center'
    }}>
      <div className="card-box" style={{ maxWidth: '380px', width: '100%', alignItems: 'center', display: 'flex', flexDirection: 'column' }}>
        
        {/* Soft Pulsing Animation Ring */}
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
          animation: 'pulse-waiting 2.2s infinite ease-in-out'
        }}>
          <Loader2 size={32} color="#ffffff" style={{ animation: 'spin 3s linear infinite' }} />
        </div>

        <style>{`
          @keyframes pulse-waiting {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.2); }
            70% { transform: scale(1.05); box-shadow: 0 0 0 20px rgba(255, 255, 255, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
          }
          @keyframes spin {
            100% { transform: rotate(360deg); }
          }
        `}</style>

        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#ffffff', marginBottom: '10px' }}>
          Waiting for the other person...
        </h2>
        
        <p style={{ color: '#8e8e98', fontSize: '14px', marginBottom: '28px', lineHeight: '1.5' }}>
          Share the room name and password with your partner. Once both connect, end-to-end encryption activates automatically.
        </p>

        {/* Small White Cancel Button */}
        <button
          onClick={onCancel}
          className="btn-secondary"
          style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <X size={16} />
          Cancel & Leave
        </button>

      </div>
    </div>
  );
}
