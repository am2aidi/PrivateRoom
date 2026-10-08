import React from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';

export function RoomClosed({ onGoHome, reason }) {
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
      <div className="card-box" style={{ maxWidth: '400px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid var(--card-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px'
        }}>
          <ShieldCheck size={30} color="#ffffff" />
        </div>

        <h2 style={{ fontSize: '22px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
          Room closed.
        </h2>

        <p style={{ color: '#ffffff', fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>
          Nothing was saved.
        </p>

        <p style={{ color: '#8e8e98', fontSize: '13px', marginBottom: '28px', lineHeight: '1.5' }}>
          {reason || 'The session has ended and all encryption keys and memory states have been completely wiped.'}
        </p>

        {/* One button to go back Home */}
        <button
          onClick={onGoHome}
          className="btn-primary"
          style={{ width: '100%' }}
        >
          <RefreshCw size={18} />
          Go to Home Screen
        </button>

      </div>
    </div>
  );
}
