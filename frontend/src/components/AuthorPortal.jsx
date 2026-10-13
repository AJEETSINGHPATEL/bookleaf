import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  PlusCircle, 
  MessageSquare, 
  Send,
  Paperclip
} from 'lucide-react';
import { apiRequest } from '../services/api';

export default function AuthorPortal({ user, reloadSignal }) {
  const [activeTab, setActiveTab] = useState('books'); // 'books' | 'tickets'
  const [dashboardData, setDashboardData] = useState(null);
  const [books, setBooks] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  // Ref to track active ticket ID across real-time events without stale closures
  const selectedTicketIdRef = useRef(null);

  useEffect(() => {
    selectedTicketIdRef.current = selectedTicket?.id;
  }, [selectedTicket?.id]);

  // New Ticket Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newTicket, setNewTicket] = useState({
    book_id: '',
    subject: '',
    description: '',
    attachment_name: ''
  });

  // Reply message in ticket
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Non-blocking Toast Notification
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [dash, bks, tix] = await Promise.all([
        apiRequest('/author/dashboard'),
        apiRequest('/author/books'),
        apiRequest('/tickets/my-tickets')
      ]);
      setDashboardData(dash);
      setBooks(bks);
      setTickets(tix);
      
      // Update selected ticket if currently viewing one
      setSelectedTicket(prev => {
        if (!prev) return null;
        return tix.find(t => t.id === prev.id) || prev;
      });
    } catch (err) {
      console.error('Failed to load author data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // When reloadSignal changes, re-fetch data AND if selectedTicket is active, fetch its full fresh messages!
  useEffect(() => {
    loadData();
    const currentId = selectedTicketIdRef.current;
    if (currentId) {
      apiRequest(`/tickets/${currentId}`)
        .then(fresh => setSelectedTicket(fresh))
        .catch(() => {});
    }
  }, [loadData, reloadSignal]);

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newTicket.subject.trim() || !newTicket.description.trim()) return;

    setSubmitting(true);
    try {
      const payload = {
        subject: newTicket.subject,
        description: newTicket.description,
        book_id: newTicket.book_id ? parseInt(newTicket.book_id) : null,
        attachment_name: newTicket.attachment_name || null
      };

      const created = await apiRequest('/tickets', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setShowCreateModal(false);
      setNewTicket({ book_id: '', subject: '', description: '', attachment_name: '' });
      await loadData();
      setActiveTab('tickets');
      setSelectedTicket(created);
      showToast('Support ticket created successfully!');
    } catch (err) {
      showToast(`Error submitting ticket: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    setSendingReply(true);
    try {
      await apiRequest(`/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: replyText })
      });
      setReplyText('');
      // Reload ticket details
      const updated = await apiRequest(`/tickets/${selectedTicket.id}`);
      setSelectedTicket(updated);
      // Also update tickets in list
      setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
      showToast('Message sent to support team!');
    } catch (err) {
      showToast(`Failed to send reply: ${err.message}`, 'error');
    } finally {
      setSendingReply(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase().replace(/\s+/g, '-');
    return <span className={`badge badge-${s}`}>{status}</span>;
  };

  if (loading && !dashboardData) {
    return (
      <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center', color: '#64748b' }}>
        <p style={{ fontSize: '1rem', fontWeight: '500' }}>Loading author profile and books...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 1rem 4rem', position: 'relative' }}>
      {/* Toast Notification Banner */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '24px',
          zIndex: 9999,
          padding: '0.85rem 1.25rem',
          borderRadius: '10px',
          backgroundColor: toast.type === 'error' ? '#ef4444' : '#10b981',
          color: '#ffffff',
          fontWeight: '600',
          fontSize: '0.9rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          <span>{toast.message}</span>
        </div>
      )}
      {/* Top Banner / Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          padding: '1.25rem',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>Author Details</span>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569' }}>
              {dashboardData?.author?.author_id_code}
            </span>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', marginTop: '0.5rem' }}>
            {user?.name}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
            {dashboardData?.author?.city || 'India'} • Joined {dashboardData?.author?.joined_date || 'N/A'}
          </div>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          padding: '1.25rem',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>Published Books & Copies</span>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', marginTop: '0.5rem' }}>
            {dashboardData?.metrics?.total_books || 0} Titles
          </div>
          <div style={{ fontSize: '0.8rem', color: '#0284c7', marginTop: '0.2rem', fontWeight: '600' }}>
            {dashboardData?.metrics?.total_copies_sold || 0} Total Copies Sold
          </div>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          padding: '1.25rem',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>Royalties Earned & Paid</span>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#059669', marginTop: '0.5rem' }}>
            ₹{Number(dashboardData?.metrics?.total_royalty_earned || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
            Paid out: ₹{Number(dashboardData?.metrics?.total_royalty_paid || 0).toLocaleString()}
          </div>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          padding: '1.25rem',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>Pending Royalty</span>
            {dashboardData?.metrics?.meets_payout_threshold && (
              <span style={{ fontSize: '0.7rem', fontWeight: '700', padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#047857' }}>
                Eligible for Payout
              </span>
            )}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#d97706', marginTop: '0.5rem' }}>
            ₹{Number(dashboardData?.metrics?.total_royalty_pending || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            Threshold: ₹1,000 (Quarterly cycle)
          </div>
        </div>
      </div>

      {/* Tabs & Action Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        borderBottom: '2px solid #e2e8f0',
        paddingBottom: '0.75rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => { setActiveTab('books'); setSelectedTicket(null); }}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '600',
              fontSize: '0.9rem',
              cursor: 'pointer',
              backgroundColor: activeTab === 'books' ? '#1e3a8a' : 'transparent',
              color: activeTab === 'books' ? '#ffffff' : '#64748b',
              transition: 'all 0.2s'
            }}
          >
            My Books ({books.length})
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '600',
              fontSize: '0.9rem',
              cursor: 'pointer',
              backgroundColor: activeTab === 'tickets' ? '#1e3a8a' : 'transparent',
              color: activeTab === 'tickets' ? '#ffffff' : '#64748b',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <span>My Support Tickets</span>
            <span style={{
              fontSize: '0.75rem',
              backgroundColor: activeTab === 'tickets' ? '#3b82f6' : '#e2e8f0',
              color: activeTab === 'tickets' ? '#ffffff' : '#475569',
              padding: '0.1rem 0.45rem',
              borderRadius: '9999px'
            }}>
              {tickets.length}
            </span>
          </button>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.2rem',
            backgroundColor: '#059669',
            color: '#ffffff',
            borderRadius: '8px',
            border: 'none',
            fontWeight: '600',
            fontSize: '0.875rem',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)'
          }}
        >
          <PlusCircle size={18} />
          <span>Submit Support Query</span>
        </button>
      </div>

      {/* Tab 1: My Books */}
      {activeTab === 'books' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {books.map((b) => (
            <div key={b.id} style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#0f172a', lineHeight: 1.3 }}>
                    {b.title}
                  </h3>
                  {getStatusBadge(b.status)}
                </div>

                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', color: '#475569' }}>
                  <div><strong>ISBN:</strong> <code style={{ backgroundColor: '#f1f5f9', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>{b.isbn}</code></div>
                  <div><strong>Genre:</strong> {b.genre}</div>
                  <div><strong>Published:</strong> {b.publication_date || 'In Production'}</div>
                  {b.print_partner && <div><strong>Print Partner:</strong> {b.print_partner}</div>}
                </div>

                {/* Edge-case handling: books in production vs published */}
                {b.status.includes('In Production') ? (
                  <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fef08a',
                    fontSize: '0.825rem',
                    color: '#854d0e'
                  }}>
                    ⏳ <strong>Production Stage:</strong> Manuscript undergoing formatting and review. Royalties activate once title goes live.
                  </div>
                ) : (
                  <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                      <div>
                        <span style={{ color: '#64748b' }}>MRP / Royalty:</span>
                        <div style={{ fontWeight: '700', color: '#1e293b' }}>₹{b.mrp} (₹{b.author_royalty_per_copy}/copy)</div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Copies Sold:</span>
                        <div style={{ fontWeight: '700', color: '#1e293b' }}>{b.total_copies_sold}</div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Total Earned:</span>
                        <div style={{ fontWeight: '700', color: '#059669' }}>₹{b.total_royalty_earned.toLocaleString()}</div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Pending:</span>
                        <div style={{ fontWeight: '700', color: '#d97706' }}>₹{b.royalty_pending.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {b.available_on && b.available_on.length > 0 && (
                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Available On:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
                    {b.available_on.map((plat) => (
                      <span key={plat} style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: '4px' }}>
                        {plat}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: My Tickets */}
      {activeTab === 'tickets' && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedTicket ? '1fr 1.3fr' : '1fr', gap: '1.5rem' }}>
          {/* Tickets List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {tickets.length === 0 ? (
              <div style={{
                backgroundColor: '#ffffff',
                padding: '3rem',
                borderRadius: '12px',
                textAlign: 'center',
                border: '1px solid #e2e8f0',
                color: '#64748b'
              }}>
                <MessageSquare size={36} color="#94a3b8" style={{ margin: '0 auto 0.75rem' }} />
                <h3>No support tickets yet</h3>
                <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  Have questions about royalties, ISBN, distribution, or print quality? Submit a query above!
                </p>
              </div>
            ) : (
              tickets.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '1.25rem',
                    borderRadius: '12px',
                    border: selectedTicket?.id === t.id ? '2px solid #1e3a8a' : '1px solid #e2e8f0',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1e3a8a' }}>{t.ticket_number}</span>
                      {getStatusBadge(t.status)}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h4 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.35rem' }}>
                    {t.subject}
                  </h4>

                  <p style={{ fontSize: '0.85rem', color: '#64748b', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {t.description}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.75rem', color: '#475569' }}>
                    <span>Category: <strong>{t.category}</strong></span>
                    <span>{t.messages?.length || 1} message(s)</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Ticket Detail & Live Chat Timeline */}
          {selectedTicket && (
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-md)',
              maxHeight: '750px',
              overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1e3a8a' }}>{selectedTicket.ticket_number}</span>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#0f172a', marginTop: '0.2rem' }}>
                      {selectedTicket.subject}
                    </h3>
                  </div>
                  {getStatusBadge(selectedTicket.status)}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                  <span>Category: <strong>{selectedTicket.category}</strong></span>
                  {selectedTicket.book_title && <span>Book: <strong>{selectedTicket.book_title}</strong></span>}
                  {selectedTicket.attachment_name && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#0284c7' }}>
                      <Paperclip size={14} /> {selectedTicket.attachment_name}
                    </span>
                  )}
                </div>
              </div>

              {/* Message Timeline */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                {selectedTicket.messages?.map((m) => {
                  const isAuthor = !m.is_admin_reply;
                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: isAuthor ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        backgroundColor: isAuthor ? '#eff6ff' : '#f8fafc',
                        border: isAuthor ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '1rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: isAuthor ? '#1e40af' : '#059669' }}>
                          {isAuthor ? 'You (Author)' : `${m.sender_name} (BookLeaf Ops Team)`}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {m.message}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Input */}
              <form onSubmit={handleSendReply} style={{
                padding: '1rem',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                display: 'flex',
                gap: '0.5rem'
              }}>
                <input
                  type="text"
                  placeholder="Type your response to BookLeaf support..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  disabled={selectedTicket.status === 'Closed'}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  disabled={sendingReply || !replyText.trim() || selectedTicket.status === 'Closed'}
                  style={{
                    padding: '0.75rem 1.25rem',
                    backgroundColor: '#1e3a8a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Send size={16} />
                  <span>Send</span>
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Modal: Submit Query */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#1e3a8a', color: '#ffffff' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Submit Author Support Query</h2>
              <p style={{ fontSize: '0.8rem', color: '#bfdbfe', marginTop: '0.2rem' }}>
                Our AI will auto-categorize and route your ticket to BookLeaf operations.
              </p>
            </div>

            <form onSubmit={handleCreateTicket} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '0.35rem' }}>
                  Related Book (or General)
                </label>
                <select
                  value={newTicket.book_id}
                  onChange={(e) => setNewTicket({ ...newTicket, book_id: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    outline: 'none',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <option value="">General / Account Level Query</option>
                  {books.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.title} ({b.isbn})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '0.35rem' }}>
                  Subject Line *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Question regarding Q4 royalty payout date"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '0.35rem' }}>
                  Detailed Description *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide comprehensive details about your inquiry or concern..."
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '0.35rem' }}>
                  File Attachment (Optional UI support)
                </label>
                <input
                  type="text"
                  placeholder="e.g. proof_of_damage.jpg or bank_passbook.pdf"
                  value={newTicket.attachment_name}
                  onChange={(e) => setNewTicket({ ...newTicket, attachment_name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '8px',
                    border: '1px dashed #94a3b8',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '0.65rem 1.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#1e3a8a',
                    color: '#ffffff',
                    fontWeight: '600',
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submitting ? 'Analyzing & Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
