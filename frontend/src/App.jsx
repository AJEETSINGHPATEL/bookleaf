import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Login from './components/Login';
import AuthorPortal from './components/AuthorPortal';
import AdminPortal from './components/AdminPortal';
import { getCurrentUser, setAuthToken, setCurrentUser } from './services/api';

function App() {
  const [user, setUser] = useState(getCurrentUser());
  const [sseConnected, setSseConnected] = useState(false);
  const [reloadSignal, setReloadSignal] = useState(0);

  // Setup Server-Sent Events (SSE) for Real-Time synchronization
  useEffect(() => {
    let eventSource = null;

    const connectSSE = () => {
      // Connect to FastAPI SSE stream with auth token
      const token = localStorage.getItem('bookleaf_token');
      const sseUrl = token ? `/api/tickets/stream?token=${encodeURIComponent(token)}` : '/api/tickets/stream';
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
      };
    };

    connectSSE();

    // Listen for auth-expired event
    const handleAuthExpired = () => {
      setUser(null);
    };
    window.addEventListener('auth-expired', handleAuthExpired);

    return () => {
      if (eventSource) eventSource.close();
      window.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, []);

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
