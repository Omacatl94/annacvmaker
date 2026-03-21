import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';

export default function FeedbackPanel() {
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (type, status) => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (type) params.type = type;
      if (status) params.status = status;
      const res = await api.adminFeedback(params);
      setItems(res.feedback);
    } catch { setItems([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load('', ''); }, [load]);

  const handleTypeChange = (e) => {
    setTypeFilter(e.target.value);
    load(e.target.value, statusFilter);
  };
  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value);
    load(typeFilter, e.target.value);
  };

  const handleRewarded = (id) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: 'rewarded' } : i));
  };
  const handleReviewed = (id) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: 'reviewed' } : i));
  };

  return (
    <>
      <div className="admin-controls">
        <select className="admin-filter-select" value={typeFilter} onChange={handleTypeChange}>
          <option value="">Tutti i tipi</option>
          <option value="bug">Bug</option>
          <option value="suggestion">Suggerimenti</option>
        </select>
        <select className="admin-filter-select" value={statusFilter} onChange={handleStatusChange}>
          <option value="">Tutti gli stati</option>
          <option value="pending">In attesa</option>
          <option value="reviewed">Letti</option>
          <option value="rewarded">Ricompensati</option>
        </select>
      </div>
      {loading ? (
        <div className="user-cards-loading">Caricamento...</div>
      ) : items.length === 0 ? (
        <div className="user-cards-loading">Nessun feedback.</div>
      ) : (
        <div className="user-cards">
          {items.map((item) => (
            <AdminFeedbackCard
              key={item.id}
              item={item}
              onRewarded={handleRewarded}
              onReviewed={handleReviewed}
            />
          ))}
        </div>
      )}
    </>
  );
}

function AdminFeedbackCard({ item, onRewarded, onReviewed }) {
  const [showReward, setShowReward] = useState(false);
  const [credits, setCredits] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const date = new Date(item.created_at).toLocaleString('it-IT', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  const handleReward = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.adminRewardFeedback(item.id, { credits: parseInt(credits), note: note.trim() || null });
      onRewarded(item.id);
      setShowReward(false);
    } catch (err) { alert('Errore: ' + err.message); }
    setBusy(false);
  };

  const handleReview = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.adminReviewFeedback(item.id, { note: note.trim() || null });
      onReviewed(item.id);
      setShowReward(false);
    } catch (err) { alert('Errore: ' + err.message); }
    setBusy(false);
  };

  return (
    <div className="feedback-admin-card">
      <div className="feedback-admin-top">
        <span className={'feedback-item-type ' + item.type}>
          {item.type === 'bug' ? 'Bug' : 'Idea'}
        </span>
        <span className={'feedback-item-status ' + item.status}>
          {{ pending: 'In attesa', reviewed: 'Letto', rewarded: 'Ricompensato' }[item.status]}
        </span>
        <span className="feedback-item-date">{date}</span>
      </div>
      <div className="feedback-admin-user">{item.user_name || item.user_email}</div>
      {item.page_url && <div className="feedback-admin-page">{item.page_url}</div>}
      <div className="feedback-admin-msg">{item.message}</div>

      {item.status === 'pending' && !showReward && (
        <div className="feedback-admin-actions">
          <button className="btn-sm btn-primary" onClick={() => setShowReward(true)}>Rispondi</button>
        </div>
      )}

      {showReward && (
        <div className="feedback-reward-form">
          <textarea
            className="feedback-textarea"
            placeholder="Nota per l'utente (opzionale)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
          />
          <div className="feedback-reward-row">
            <label>
              Raccoin:
              <input
                type="number"
                min="0"
                max="50"
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                className="feedback-credit-input"
              />
            </label>
            <button className="btn-sm btn-primary" disabled={busy} onClick={handleReward}>
              {busy ? '...' : 'Ricompensa'}
            </button>
            <button className="btn-sm" disabled={busy} onClick={handleReview}>
              Solo letto
            </button>
          </div>
        </div>
      )}

      {item.credits_awarded > 0 && (
        <div className="feedback-item-reward">+{item.credits_awarded} Raccoin assegnati</div>
      )}
      {item.admin_note && (
        <div className="feedback-item-note">Nota: {item.admin_note}</div>
      )}
    </div>
  );
}
