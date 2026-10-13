import React from 'react';
import { BookOpen, Shield, User, LogOut } from 'lucide-react';

export default function Navbar({ user, onLogout, sseConnected }) {
  const isAdmin = user?.role === 'admin';

  return (
    <header style={{
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '68px'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            backgroundColor: '#1e3a8a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff'
          }}>
            <BookOpen size={22} color="#93c5fd" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: '800', fontSize: '1.15rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
                BookLeaf
              </span>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: '700',
                padding: '0.15rem 0.5rem',
                borderRadius: '6px',
                backgroundColor: isAdmin ? '#fef3c7' : '#eff6ff',
                color: isAdmin ? '#b45309' : '#1d4ed8'
              }}>
                {isAdmin ? 'OPS ADMIN' : 'AUTHOR PORTAL'}
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Communication & Support Desk
            </span>
          </div>
        </div>

        {/* User Info & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* SSE Live Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.65rem',
            backgroundColor: sseConnected ? '#ecfdf5' : '#f1f5f9',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: '600',
            color: sseConnected ? '#065f46' : '#64748b'
          }}>
            <span className={sseConnected ? 'live-indicator' : ''} style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: sseConnected ? '#10b981' : '#94a3b8'
            }} />
            <span>{sseConnected ? 'Real-Time Sync Active' : 'Connecting...'}</span>
          </div>

          {/* User profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#475569'
            }}>
              {isAdmin ? <Shield size={18} color="#1e3a8a" /> : <User size={18} color="#059669" />}
            </div>
            <div style={{ display: 'none', flexDirection: 'column', minWidth: '120px' }} className="user-desktop-badge">
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1e293b', lineHeight: 1.2 }}>
                {user?.name}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {user?.email}
              </span>
            </div>
          </div>



          {/* Logout */}
          <button
            onClick={onLogout}
            title="Sign out"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '0.825rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <LogOut size={16} />
            <span style={{ display: 'none' }} className="user-desktop-badge">Logout</span>
          </button>
        </div>
      </div>
      <style>{`
        @media (min-width: 640px) {
          .user-desktop-badge { display: flex !important; }
        }
      `}</style>
    </header>
  );
}
