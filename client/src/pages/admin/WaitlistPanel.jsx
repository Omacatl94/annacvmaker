import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../api';

const PAGE_SIZE = 25;

export default function WaitlistPanel() {
  const [search, setSearch] = useState('');
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const searchTimerRef = useRef(null);

  const loadWaitlist = useCallback(async (searchVal, off) => {
    setLoading(true);
    try {
      const params = { limit: PAGE_SIZE, offset: off };
      if (searchVal) params.search = searchVal;
      const res = await api.adminWaitlist(params);
      setEntries(res.waitlist);
      setTotal(res.total);
    } catch {
      setEntries([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadWaitlist('', 0);
  }, [loadWaitlist]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setOffset(0);
      loadWaitlist(val.trim(), 0);
    }, 400);
  };

  const handlePageChange = (newOffset) => {
    setOffset(newOffset);
    loadWaitlist(search.trim(), newOffset);
  };

  const handleRemoveEntry = (id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setTotal((t) => t - 1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <>
      <div className="admin-controls">
        <input
          type="text"
          placeholder="Cerca per email..."
          className="admin-search"
          value={search}
          onChange={handleSearchChange}
        />
      </div>
      {loading ? (
        <div className="user-cards-loading">Caricamento...</div>
      ) : entries.length === 0 ? (
        <div className="user-cards-loading">Nessuna email in waitlist.</div>
      ) : (
        <>
          <div className="waitlist-list card">
            {entries.map((entry) => (
              <WaitlistCard
                key={entry.id}
                entry={entry}
                onActivated={handleRemoveEntry}
              />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="admin-pagination">
              {offset > 0 && (
                <button className="btn-sm" onClick={() => handlePageChange(offset - PAGE_SIZE)}>
                  {'\u2190'} Prec
                </button>
              )}
              <span>
                {currentPage}/{totalPages} ({total})
              </span>
              {offset + PAGE_SIZE < total && (
                <button className="btn-sm" onClick={() => handlePageChange(offset + PAGE_SIZE)}>
                  Succ {'\u2192'}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}

function WaitlistCard({ entry, onActivated }) {
  const [activating, setActivating] = useState(false);

  const date = new Date(entry.created_at).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const source = entry.google_id ? 'Google' : entry.linkedin_id ? 'LinkedIn' : 'Form';

  const handleActivate = async () => {
    if (!window.confirm(`Attivare ${entry.email}? Verra' creato l'account con crediti di benvenuto.`)) return;
    setActivating(true);
    try {
      await api.adminActivateWaitlist(entry.id);
      onActivated(entry.id);
    } catch (err) {
      alert('Errore: ' + err.message);
      setActivating(false);
    }
  };

  return (
    <div className="waitlist-row">
      <div className="waitlist-row-info">
        <div className="waitlist-row-top">
          <span className="waitlist-row-name">{entry.name || entry.email.split('@')[0]}</span>
          {source !== 'Form' && (
            <span className="admin-badge active" style={{ fontSize: 10, padding: '1px 5px' }}>
              {source}
            </span>
          )}
        </div>
        <div className="waitlist-row-meta">
          <span>{entry.email}</span>
          <span className="waitlist-row-dot">&middot;</span>
          <span>{date}</span>
        </div>
      </div>
      <button
        className="btn-sm btn-primary"
        disabled={activating}
        onClick={handleActivate}
      >
        {activating ? '...' : 'Attiva'}
      </button>
    </div>
  );
}
