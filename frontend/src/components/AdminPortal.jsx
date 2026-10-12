import React, { useState, useEffect } from 'react';
import { 
  Filter, 
  Sparkles, 
  Clock, 
  UserCheck, 
  Send, 
  Edit3, 
  CheckCircle, 
  AlertTriangle,
  RefreshCw,
  FileText,
  StickyNote,
  Paperclip
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

const PRIORITIES = ['All', 'Critical', 'High', 'Medium', 'Low'];
const STATUSES = ['All', 'Open', 'In Progress', 'Resolved', 'Closed'];

export default function AdminPortal({ user, reloadSignal }) {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('urgent_first');

  // Draft editing state
  const [activeDraft, setActiveDraft] = useState('');
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [isRegeneratingDraft, setIsRegeneratingDraft] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);

  // Internal Notes State
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    loadTickets();
  }, [categoryFilter, priorityFilter, statusFilter, sortBy, reloadSignal]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (categoryFilter !== 'All') queryParams.append('category', categoryFilter);
      if (priorityFilter !== 'All') queryParams.append('priority', priorityFilter);
      if (statusFilter !== 'All') queryParams.append('status', statusFilter);
      queryParams.append('sort', sortBy);

      const data = await apiRequest(`/admin/tickets?${queryParams.toString()}`);
      setTickets(data);

      if (selectedTicket) {
        const refreshed = data.find(t => t.id === selectedTicket.id);
        if (refreshed) {
          setSelectedTicket(refreshed);
          if (!isEditingDraft) {
            setActiveDraft(refreshed.ai_draft_response || '');
          }
        }
      }
    } catch (err) {
      console.error('Failed to load tickets queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTicket = (ticket) => {
    setSelectedTicket(ticket);
    setActiveDraft(ticket.ai_draft_response || '');
    setIsEditingDraft(false);
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
    } catch (err) {
      alert(`Failed to update ${field}: ${err.message}`);
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
    } catch (err) {
      alert(`Assignment failed: ${err.message}`);
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
    } catch (err) {
      alert(`Draft generation failed: ${err.message}`);
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

      // 2. Set ticket status to Resolved (or In Progress)
      await handleOverride('status', 'Resolved');

      // Refresh ticket details
      const refreshed = await apiRequest(`/tickets/${selectedTicket.id}`);
      setSelectedTicket(refreshed);
      setTickets(prev => prev.map(t => t.id === refreshed.id ? refreshed : t));
      alert('Official response sent to author!');
    } catch (err) {
      alert(`Failed to send response: ${err.message}`);
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
    } catch (err) {
      alert(`Failed to save internal note: ${err.message}`);
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
    <div className="container" style={{ padding: '2rem 1rem 4rem' }}>
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

                {/* Self Assign Button */}
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
                  <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: '700', backgroundColor: '#ecfdf5', padding: '0.25rem 0.6rem', borderRadius: '6px' }}>
                    Assigned: {selectedTicket.assigned_to_name}
                  </span>
                )}
              </div>

              {/* Overrides Bar: Category, Priority, Status */}
              <div style={{
                marginTop: '1.25rem',
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
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.75rem' }}>
                Thread Messages ({selectedTicket.messages?.length || 0})
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
