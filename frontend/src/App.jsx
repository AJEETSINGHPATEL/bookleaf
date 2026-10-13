import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Login from './components/Login';
import AuthorPortal from './components/AuthorPortal';
import AdminPortal from './components/AdminPortal';
import { getCurrentUser, setAuthToken, setCurrentUser, API_BASE } from './services/api';

function App() {
  const [user, setUser] = useState(getCurrentUser());
  const [sseConnected, setSseConnected] = useState(false);
  const [reloadSignal, setReloadSignal] = useState(0);

  // Setup Server-Sent Events (SSE) for Real-Time synchronization
  useEffect(() => {
    if (!user) {
      setSseConnected(false);
      return;
    }

    let eventSource = null;
    let reconnectTimeout = null;

    const connectSSE = () => {
      const token = localStorage.getItem('bookleaf_token');
      if (!token) return;

      const sseUrl = `${API_BASE}/tickets/stream?token=${encodeURIComponent(token)}`;
      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        setSseConnected(true);
      };

      eventSource.addEventListener('ticket_created', () => {
        setReloadSignal(prev => prev + 1);
      });

      eventSource.addEventListener('ticket_updated', () => {
        setReloadSignal(prev => prev + 1);
      });

      eventSource.addEventListener('new_message', () => {
        setReloadSignal(prev => prev + 1);
      });

      eventSource.onerror = () => {
        setSseConnected(false);
        if (eventSource) {
          eventSource.close();
        }
        // Auto-reconnect after 3 seconds
        reconnectTimeout = setTimeout(() => {
          connectSSE();
        }, 3000);
      };
    };

    connectSSE();

    // Subtle 5-second polling safeguard to guarantee zero-refresh real-time updates
    const syncInterval = setInterval(() => {
      setReloadSignal(prev => prev + 1);
    }, 5000);

    // Listen for auth-expired event
    const handleAuthExpired = () => {
      setUser(null);
    };
    window.addEventListener('auth-expired', handleAuthExpired);

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(syncInterval);
      window.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, [user]);

  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    setUser(null);
  };

  if (!user) {
    return <Login onLoginSuccess={setUser} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
      <Navbar user={user} onLogout={handleLogout} sseConnected={sseConnected} />
      <main style={{ flex: 1 }}>
        {user.role === 'admin' ? (
          <AdminPortal user={user} reloadSignal={reloadSignal} />
        ) : (
          <AuthorPortal user={user} reloadSignal={reloadSignal} />
        )}
      </main>
    </div>
  );
}

export default App;
