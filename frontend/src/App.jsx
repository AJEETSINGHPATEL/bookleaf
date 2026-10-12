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
      // Connect to FastAPI SSE stream
      eventSource = new EventSource('/api/tickets/stream');

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

  const handleSwitchUser = async (email, password) => {
    try {
      const { apiRequest } = await import('./services/api');
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      setAuthToken(data.access_token);
      setCurrentUser(data.user);
      setUser(data.user);
      setReloadSignal(prev => prev + 1);
    } catch (e) {
      console.error('Switch user failed:', e);
    }
  };

  if (!user) {
    return <Login onLoginSuccess={setUser} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
      <Navbar user={user} onLogout={handleLogout} onSwitchUser={handleSwitchUser} sseConnected={sseConnected} />
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
