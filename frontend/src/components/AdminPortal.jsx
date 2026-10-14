import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Filter, 
  Sparkles, 
  UserCheck, 
  Send, 
  Edit3, 
  RefreshCw, 
  StickyNote,
  AlertCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers
} from 'lucide-react';
import { apiRequest } from '../services/api';

const CATEGORIES = [
  'All',
  'Royalty & Payments',
  'ISBN & Metadata Issues',
  'Printing & Quality',
  'Distribution & Availability',
  'Book Status & Production Updates',
  'General Inquiry'
];

const PRIORITIES = ['All', 'Urgent / Critical', 'Critical', 'High', 'Medium', 'Low'];
const STATUSES = ['All', 'Open', 'In Progress', 'Resolved', 'Closed'];

export default function AdminPortal({ reloadSignal }) {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ticketsError, setTicketsError] = useState(null);

  // Asynchronous Dashboard Statistics
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [sortBy, setSortBy] = useState('urgent_first');

  // Draft editing state
  const [activeDraft, setActiveDraft] = useState('');
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [isRegeneratingDraft, setIsRegeneratingDraft] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);
  const [loadingTicketDetails, setLoadingTicketDetails] = useState(false);

  // Refs to avoid stale closures in SSE effect
  const selectedTicketIdRef = useRef(null);
  const isEditingDraftRef = useRef(false);

  useEffect(() => {
    selectedTicketIdRef.current = selectedTicket?.id;
    isEditingDraftRef.current = isEditingDraft;
  }, [selectedTicket?.id, isEditingDraft]);

  // Internal Notes State
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Non-blocking Toast Notification
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      setStatsError(null);
      const data = await apiRequest('/admin/stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to load admin stats:', err);
      setStatsError(err.message || 'Unable to load statistics');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      setTicketsError(null);
      const queryParams = new URLSearchParams();
      if (categoryFilter !== 'All') queryParams.append('category', categoryFilter);
      if (priorityFilter !== 'All') queryParams.append('priority', priorityFilter);
      if (statusFilter !== 'All') queryParams.append('status', statusFilter);
      if (dateFilter) queryParams.append('date_from', dateFilter);
      queryParams.append('sort', sortBy);

      const data = await apiRequest(`/admin/tickets?${queryParams.toString()}`);
      setTickets(data);

      setSelectedTicket(prev => {
        if (!prev) return null;
        const refreshed = data.find(t => t.id === prev.id);
        if (!refreshed) return prev;
        if (!isEditingDraftRef.current) {
          setActiveDraft(refreshed.ai_draft_response || '');
        }
        return {
          ...refreshed,
          messages: (prev.messages && prev.messages.length > 0) ? prev.messages : (refreshed.messages || []),
          internal_notes: (prev.internal_notes && prev.internal_notes.length > 0) ? prev.internal_notes : (refreshed.internal_notes || [])
        };
      });
    } catch (err) {
      console.error('Failed to load tickets queue:', err);
      setTicketsError(err.message || 'Failed to load tickets queue.');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, priorityFilter, statusFilter, dateFilter, sortBy]);

  // Synchronize on reloadSignal: reload queue & stats asynchronously
  useEffect(() => {
    loadTickets();
    loadStats();
    const currentId = selectedTicketIdRef.current;
    if (currentId) {
      apiRequest(`/tickets/${currentId}`)
        .then(fresh => {
          setSelectedTicket(prev => {
            if (!prev || prev.id !== fresh.id) return prev;
            return {
              ...fresh,
              ai_draft_response: isEditingDraftRef.current ? prev.ai_draft_response : fresh.ai_draft_response
            };
          });
        })
        .catch(() => {});
    }
  }, [loadTickets, loadStats, reloadSignal]);

  const handleSelectTicket = async (ticket) => {
    setSelectedTicket(ticket);
    setActiveDraft(ticket.ai_draft_response || '');
    setIsEditingDraft(false);

    // Load full messages and internal notes if not present
    if (!ticket.messages || ticket.messages.length === 0) {
      try {
        setLoadingTicketDetails(true);
        const full = await apiRequest(`/tickets/${ticket.id}`);
        setSelectedTicket(full);
        if (!isEditingDraftRef.current) {
          setActiveDraft(full.ai_draft_response || '');
        }
      } catch (err) {
        console.error('Failed to load conversation details:', err);
      } finally {
        setLoadingTicketDetails(false);
      }
    }
  };

  const handleOverride = async (field, value) => {
    if (!selectedTicket) return;
    try {
      const payload = { [field]: value };
      const updated = await apiRequest(`/admin/tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setSelectedTicket(updated);
      setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
      showToast(`Updated ${field} to ${value}!`);
    } catch (err) {
      showToast(`Failed to update ${field}: ${err.message}`, 'error');
    }
  };

  const handleAssignSelf = async () => {
    if (!selectedTicket) return;
    try {
      const updated = await apiRequest(`/admin/tickets/${selectedTicket.id}/assign-self`, {
        method: 'POST'
      });
      setSelectedTicket(updated);
      setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
      showToast('Ticket assigned to you!');
    } catch (err) {
      showToast(`Assignment failed: ${err.message}`, 'error');
    }
  };

  const handleRegenerateDraft = async () => {
    if (!selectedTicket) return;
    setIsRegeneratingDraft(true);
    try {
      const res = await apiRequest(`/admin/tickets/${selectedTicket.id}/regenerate-draft`, {
        method: 'POST',
        body: JSON.stringify({ instructions: customInstructions })
      });
      setActiveDraft(res.draft_response);
      setSelectedTicket(prev => ({ ...prev, ai_draft_response: res.draft_response }));
      setCustomInstructions('');
      showToast('AI draft regenerated successfully!');
    } catch (err) {
      showToast(`Draft generation failed: ${err.message}`, 'error');
    } finally {
      setIsRegeneratingDraft(false);
    }
  };

  const handleSendDraftResponse = async () => {
    if (!selectedTicket || !activeDraft.trim()) return;
    setSendingResponse(true);
    try {
      // 1. Post response as an official admin reply
      await apiRequest(`/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: activeDraft.trim() })
      });

      // 2. Set ticket status to Resolved
      await apiRequest(`/admin/tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Resolved' })
      });

      // 3. Refresh ticket details
      const refreshed = await apiRequest(`/tickets/${selectedTicket.id}`);
      setSelectedTicket(refreshed);
      setTickets(prev => prev.map(t => t.id === refreshed.id ? refreshed : t));
      showToast('Official response sent and ticket marked as Resolved!');
    } catch (err) {
      showToast(`Failed to send response: ${err.message}`, 'error');
    } finally {
      setSendingResponse(false);
    }
  };

  const handleAddInternalNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || !selectedTicket) return;
    setAddingNote(true);
    try {
      const noteRes = await apiRequest(`/admin/tickets/${selectedTicket.id}/internal-notes`, {
        method: 'POST',
        body: JSON.stringify({ note: newNote.trim() })
      });
      setSelectedTicket(prev => ({
        ...prev,
        internal_notes: [...(prev.internal_notes || []), noteRes]
      }));
      setNewNote('');
      showToast('Internal note saved successfully!');
    } catch (err) {
      showToast(`Failed to save internal note: ${err.message}`, 'error');
    } finally {
      setAddingNote(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase().replace(/\s+/g, '-');
    return <span className={`badge badge-${s}`}>{status}</span>;
  };

  const getPriorityBadge = (priority) => {
    const p = (priority || '').toLowerCase();
    return <span className={`badge badge-${p}`}>{priority}</span>;
  };

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
      {/* Asynchronous Operations Statistics Ribbon */}
      {statsError && (
        <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', padding: '0.6rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Failed to refresh metrics: {statsError}</span>
          <button onClick={loadStats} style={{ border: 'none', background: 'none', color: '#b45309', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
        </div>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {/* Card 1: Total Tickets */}
        <div
          onClick={() => {
            setStatusFilter('All');
            setPriorityFilter('All');
            setCategoryFilter('All');
            setDateFilter('');
          }}
          title="Click to view all tickets"
          style={{
            backgroundColor: (statusFilter === 'All' && priorityFilter === 'All') ? '#f0f9ff' : '#ffffff',
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            border: (statusFilter === 'All' && priorityFilter === 'All') ? '2px solid #0284c7' : '1px solid #e2e8f0',
            boxShadow: (statusFilter === 'All' && priorityFilter === 'All') ? '0 4px 6px -1px rgba(2, 132, 199, 0.15)' : 'var(--shadow-sm)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>
            <span>Total Tickets</span>
            <Layers size={16} color="#1e3a8a" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '0.35rem' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>
              {statsLoading ? (
                <div style={{ height: '1.5rem', width: '3rem', backgroundColor: '#e2e8f0', borderRadius: '4px' }} />
              ) : (
                stats?.total_tickets ?? '—'
              )}
            </div>
            {(statusFilter === 'All' && priorityFilter === 'All') && (
              <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#0284c7', backgroundColor: '#e0f2fe', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>ACTIVE</span>
            )}
          </div>
        </div>

        {/* Card 2: Open Queue */}
        <div
          onClick={() => {
            setStatusFilter('Open');
            setPriorityFilter('All');
          }}
          title="Click to filter by Open queue"
          style={{
            backgroundColor: (statusFilter === 'Open' && priorityFilter === 'All') ? '#fffbeb' : '#ffffff',
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            border: (statusFilter === 'Open' && priorityFilter === 'All') ? '2px solid #d97706' : '1px solid #e2e8f0',
            boxShadow: (statusFilter === 'Open' && priorityFilter === 'All') ? '0 4px 6px -1px rgba(217, 119, 6, 0.15)' : 'var(--shadow-sm)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>
            <span>Open Queue</span>
            <Clock size={16} color="#d97706" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '0.35rem' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#d97706' }}>
              {statsLoading ? (
                <div style={{ height: '1.5rem', width: '3rem', backgroundColor: '#e2e8f0', borderRadius: '4px' }} />
              ) : (
                stats?.open_tickets ?? '—'
              )}
            </div>
            {(statusFilter === 'Open' && priorityFilter === 'All') && (
              <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#d97706', backgroundColor: '#fef3c7', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>ACTIVE</span>
            )}
          </div>
        </div>

        {/* Card 3: Urgent / Critical */}
        <div
          onClick={() => {
            setPriorityFilter('Urgent / Critical');
            setStatusFilter('All');
          }}
          title="Click to filter by Urgent & Critical tickets"
          style={{
            backgroundColor: (priorityFilter === 'Urgent / Critical' || (priorityFilter === 'Critical' && statusFilter === 'All')) ? '#fef2f2' : '#ffffff',
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            border: (priorityFilter === 'Urgent / Critical' || (priorityFilter === 'Critical' && statusFilter === 'All')) ? '2px solid #dc2626' : '1px solid #fee2e2',
            boxShadow: (priorityFilter === 'Urgent / Critical' || (priorityFilter === 'Critical' && statusFilter === 'All')) ? '0 4px 6px -1px rgba(220, 38, 38, 0.2)' : 'var(--shadow-sm)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#dc2626', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>
            <span>Urgent / Critical</span>
            <AlertTriangle size={16} color="#dc2626" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '0.35rem' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#dc2626' }}>
              {statsLoading ? (
                <div style={{ height: '1.5rem', width: '3rem', backgroundColor: '#e2e8f0', borderRadius: '4px' }} />
              ) : (
                stats?.urgent_tickets ?? '—'
              )}
            </div>
            {(priorityFilter === 'Urgent / Critical' || (priorityFilter === 'Critical' && statusFilter === 'All')) && (
              <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#dc2626', backgroundColor: '#fee2e2', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>ACTIVE</span>
            )}
          </div>
        </div>

        {/* Card 4: In Progress */}
        <div
          onClick={() => {
            setStatusFilter('In Progress');
            setPriorityFilter('All');
          }}
          title="Click to filter by In Progress tickets"
          style={{
            backgroundColor: (statusFilter === 'In Progress' && priorityFilter === 'All') ? '#eff6ff' : '#ffffff',
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            border: (statusFilter === 'In Progress' && priorityFilter === 'All') ? '2px solid #2563eb' : '1px solid #e2e8f0',
            boxShadow: (statusFilter === 'In Progress' && priorityFilter === 'All') ? '0 4px 6px -1px rgba(37, 99, 235, 0.15)' : 'var(--shadow-sm)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>
            <span>In Progress</span>
            <RefreshCw size={16} color="#2563eb" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '0.35rem' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#2563eb' }}>
              {statsLoading ? (
                <div style={{ height: '1.5rem', width: '3rem', backgroundColor: '#e2e8f0', borderRadius: '4px' }} />
              ) : (
                stats?.in_progress ?? '—'
              )}
            </div>
            {(statusFilter === 'In Progress' && priorityFilter === 'All') && (
              <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#2563eb', backgroundColor: '#dbeafe', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>ACTIVE</span>
            )}
          </div>
        </div>

        {/* Card 5: Resolved */}
        <div
          onClick={() => {
            setStatusFilter('Resolved');
            setPriorityFilter('All');
          }}
          title="Click to filter by Resolved tickets"
          style={{
            backgroundColor: (statusFilter === 'Resolved' && priorityFilter === 'All') ? '#ecfdf5' : '#ffffff',
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            border: (statusFilter === 'Resolved' && priorityFilter === 'All') ? '2px solid #059669' : '1px solid #e2e8f0',
            boxShadow: (statusFilter === 'Resolved' && priorityFilter === 'All') ? '0 4px 6px -1px rgba(5, 150, 105, 0.15)' : 'var(--shadow-sm)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>
            <span>Resolved</span>
            <CheckCircle2 size={16} color="#059669" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '0.35rem' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#059669' }}>
              {statsLoading ? (
                <div style={{ height: '1.5rem', width: '3rem', backgroundColor: '#e2e8f0', borderRadius: '4px' }} />
              ) : (
                stats?.resolved_tickets ?? '—'
              )}
            </div>
            {(statusFilter === 'Resolved' && priorityFilter === 'All') && (
              <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#059669', backgroundColor: '#d1fae5', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>ACTIVE</span>
            )}
          </div>
        </div>
      </div>

      {/* Top Filter Bar */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '1.25rem',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        marginBottom: '1.5rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Filter size={18} color="#1e3a8a" />
          <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>
            BookLeaf Support Operations Queue
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: 'auto' }}>
            {tickets.length} ticket(s) found
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '0.25rem' }}>
              STATUS
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            >
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '0.25rem' }}>
              PRIORITY
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            >
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '0.25rem' }}>
              CATEGORY
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '0.25rem' }}>
              CREATED FROM DATE
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '0.25rem' }}>
              SORT ORDER
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            >
              <option value="urgent_first">Urgent / Critical First</option>
              <option value="oldest">Oldest Tickets First</option>
              <option value="newest">Newest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Queue & Workspace Split View */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedTicket ? '1fr 1.35fr' : '1fr',
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        {/* Ticket Queue Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {ticketsError ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem 1.5rem',
              color: '#b91c1c',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #fecaca',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <AlertCircle size={32} color="#dc2626" style={{ margin: '0 auto 0.75rem', display: 'block' }} />
              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: '#991b1b', marginBottom: '0.35rem' }}>
                Failed to Load Operations Queue
              </h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>{ticketsError}</p>
              <button
                onClick={loadTickets}
                style={{
                  padding: '0.5rem 1.25rem',
                  backgroundColor: '#1e3a8a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <RefreshCw size={14} /> Retry Loading
              </button>
            </div>
          ) : loading && tickets.length === 0 ? (
            /* Loading Skeleton Placeholders */
            [1, 2, 3, 4].map(idx => (
              <div
                key={`skeleton-${idx}`}
                style={{
                  backgroundColor: '#ffffff',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ width: '80px', height: '18px', backgroundColor: '#e2e8f0', borderRadius: '4px' }} />
                  <div style={{ width: '60px', height: '14px', backgroundColor: '#e2e8f0', borderRadius: '4px' }} />
                </div>
                <div style={{ width: '70%', height: '18px', backgroundColor: '#e2e8f0', borderRadius: '4px', marginBottom: '0.75rem' }} />
                <div style={{ width: '45%', height: '14px', backgroundColor: '#f1f5f9', borderRadius: '4px', marginBottom: '0.75rem' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #f8fafc' }}>
                  <div style={{ width: '90px', height: '14px', backgroundColor: '#f1f5f9', borderRadius: '4px' }} />
                  <div style={{ width: '100px', height: '14px', backgroundColor: '#f1f5f9', borderRadius: '4px' }} />
                </div>
              </div>
            ))
          ) : tickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: '0.9rem', fontWeight: '500' }}>No tickets match the selected filters.</p>
            </div>
          ) : null}

          {tickets.map((t) => {
            const isSelected = selectedTicket?.id === t.id;
            const isUrgent = t.priority === 'Critical' || t.priority === 'High';
            return (
              <div
                key={t.id}
                onClick={() => handleSelectTicket(t)}
                style={{
                  backgroundColor: '#ffffff',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: isSelected ? '2px solid #1e3a8a' : (isUrgent ? '1px solid #fecaca' : '1px solid #e2e8f0'),
                  borderLeft: isUrgent ? '5px solid #dc2626' : undefined,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#1e3a8a' }}>{t.ticket_number}</span>
                    {getPriorityBadge(t.priority)}
                    {getStatusBadge(t.status)}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {new Date(t.created_at).toLocaleDateString()}
                  </span>
                </div>

                <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.25rem' }}>
                  {t.subject}
                </h4>

                <p style={{
                  fontSize: '0.825rem',
                  color: '#475569',
                  marginBottom: '0.5rem',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  lineHeight: '1.4'
                }}>
                  {t.description || 'No description provided.'}
                </p>

                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>
                  By: <strong>{t.creator_name}</strong> ({t.creator_email})
                  {t.book_title && <span> • <em>{t.book_title}</em></span>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', paddingTop: '0.5rem', borderTop: '1px solid #f8fafc' }}>
                  <span style={{
                    backgroundColor: '#f1f5f9',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    fontWeight: '600'
                  }}>
                    {t.category}
                  </span>
                  <span>{t.assigned_to_name ? `Assigned: ${t.assigned_to_name}` : 'Unassigned'}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Ticket Action Desk */}
        {selectedTicket && (
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden'
          }}>
            {/* Header & Overrides */}
            <div style={{ padding: '1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#1e3a8a' }}>{selectedTicket.ticket_number}</span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Created by {selectedTicket.creator_name}</span>
                  </div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}>
                    {selectedTicket.subject}
                  </h2>
                </div>

                {/* Action Buttons: Assign & Close */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {!selectedTicket.assigned_to_id ? (
                    <button
                      onClick={handleAssignSelf}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.5rem 0.85rem',
                        borderRadius: '8px',
                        backgroundColor: '#1e3a8a',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      <UserCheck size={16} /> Assign to Me
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: '700', backgroundColor: '#ecfdf5', padding: '0.35rem 0.6rem', borderRadius: '6px' }}>
                      Assigned: {selectedTicket.assigned_to_name}
                    </span>
                  )}

                  <button
                    onClick={() => setSelectedTicket(null)}
                    title="Close ticket details"
                    style={{
                      padding: '0.45rem 0.75rem',
                      borderRadius: '8px',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    ✕ Close
                  </button>
                </div>
              </div>

              {/* Original Author Issue Description */}
              <div style={{
                marginTop: '1.25rem',
                backgroundColor: '#ffffff',
                padding: '1rem 1.25rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                    Author Query & Issue Description
                  </span>
                  {selectedTicket.book_title && (
                    <span style={{ fontSize: '0.75rem', color: '#1e3a8a', fontWeight: '600' }}>
                      Book: {selectedTicket.book_title} {selectedTicket.book_isbn ? `(ISBN: ${selectedTicket.book_isbn})` : ''}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#1e293b', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {selectedTicket.description || 'No description provided.'}
                </div>
                {selectedTicket.attachment_name && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#2563eb', fontWeight: '600' }}>
                    📎 Attached file: {selectedTicket.attachment_name}
                  </div>
                )}
              </div>

              {/* Overrides Bar: Category, Priority, Status */}
              <div style={{
                marginTop: '1rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '0.75rem',
                backgroundColor: '#ffffff',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b' }}>STATUS</span>
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => handleOverride('status', e.target.value)}
                    style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: '600' }}
                  >
                    {STATUSES.filter(s => s !== 'All').map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b' }}>PRIORITY (AI: {selectedTicket.ai_predicted_priority})</span>
                  <select
                    value={selectedTicket.priority}
                    onChange={(e) => handleOverride('priority', e.target.value)}
                    style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: '600' }}
                  >
                    {PRIORITIES.filter(p => p !== 'All').map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b' }}>CATEGORY (AI Override)</span>
                  <select
                    value={selectedTicket.category}
                    onChange={(e) => handleOverride('category', e.target.value)}
                    style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: '600' }}
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {selectedTicket.priority_reasoning && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sparkles size={14} color="#0284c7" />
                  <span><strong>AI Rationale:</strong> {selectedTicket.priority_reasoning}</span>
                </div>
              )}
            </div>

            {/* AI Draft Response Section */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#fcfdfe' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sparkles size={18} color="#2563eb" />
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#1e3a8a' }}>
                    BookLeaf AI-Drafted Response (KB Grounded)
                  </h3>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setIsEditingDraft(!isEditingDraft)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    <Edit3 size={14} /> {isEditingDraft ? 'Done Editing' : 'Edit Draft'}
                  </button>
                  <button
                    onClick={handleRegenerateDraft}
                    disabled={isRegeneratingDraft}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid #bfdbfe',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: isRegeneratingDraft ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <RefreshCw size={14} className={isRegeneratingDraft ? 'animate-spin' : ''} />
                    <span>{isRegeneratingDraft ? 'Regenerating...' : 'Re-Draft AI'}</span>
                  </button>
                </div>
              </div>

              {/* Draft Content Box */}
              {isEditingDraft ? (
                <textarea
                  rows={8}
                  value={activeDraft}
                  onChange={(e) => setActiveDraft(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #3b82f6',
                    fontSize: '0.875rem',
                    lineHeight: 1.5,
                    fontFamily: 'inherit'
                  }}
                />
              ) : (
                <div style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  color: '#1e293b',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '260px',
                  overflowY: 'auto'
                }}>
                  {activeDraft || 'No draft generated yet. Click Re-Draft AI.'}
                </div>
              )}

              {/* Special instructions prompt box for re-drafting */}
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Optional custom instructions (e.g. emphasize 48-hr turnaround or bank KYC)..."
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.8rem'
                  }}
                />
                <button
                  onClick={handleSendDraftResponse}
                  disabled={sendingResponse || !activeDraft.trim()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '8px',
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    cursor: sendingResponse ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)'
                  }}
                >
                  <Send size={16} />
                  <span>{sendingResponse ? 'Sending...' : 'Approve & Send to Author'}</span>
                </button>
              </div>
            </div>

            {/* Conversation History Timeline */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Thread Messages ({selectedTicket.messages?.length || 0})</span>
                {loadingTicketDetails && <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '500' }}>Loading details...</span>}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto' }}>
                {selectedTicket.messages?.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      backgroundColor: m.is_admin_reply ? '#eff6ff' : '#f8fafc',
                      border: m.is_admin_reply ? '1px solid #bfdbfe' : '1px solid #e2e8f0'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.75rem' }}>
                      <span style={{ fontWeight: '700', color: m.is_admin_reply ? '#1e40af' : '#059669' }}>
                        {m.sender_name} ({m.sender_role === 'admin' ? 'Support Lead' : 'Author'})
                      </span>
                      <span style={{ color: '#94a3b8' }}>
                        {new Date(m.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                      {m.message}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Internal Notes Section (Ops Only - Strictly hidden from author) */}
            <div style={{ padding: '1.5rem', backgroundColor: '#fffbeb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                <StickyNote size={18} color="#b45309" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#92400e' }}>
                  Internal Notes (Visible Only to BookLeaf Ops Staff)
                </h3>
              </div>

              {selectedTicket.internal_notes?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {selectedTicket.internal_notes.map((n) => (
                    <div key={n.id} style={{
                      backgroundColor: '#ffffff',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '6px',
                      border: '1px solid #fef08a',
                      fontSize: '0.8rem',
                      color: '#78350f'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', marginBottom: '0.2rem', fontSize: '0.7rem' }}>
                        <span>{n.admin_name}</span>
                        <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div>{n.note}</div>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddInternalNote} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Add an internal note or escalation task for ops..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #fde68a',
                    fontSize: '0.8rem',
                    backgroundColor: '#ffffff'
                  }}
                />
                <button
                  type="submit"
                  disabled={addingNote || !newNote.trim()}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    backgroundColor: '#b45309',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '600',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  {addingNote ? 'Saving...' : 'Add Note'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
