import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../api';

export default function ErrorLog() {
  const [level, setLevel] = useState('');
  const [search, setSearch] = useState('');
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const searchTimerRef = useRef(null);

  const loadErrors = useCallback(async (levelFilter, searchFilter) => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (levelFilter) params.level = levelFilter;
      if (searchFilter) params.search = searchFilter;
      const res = await api.adminErrors(params);
      setErrors(res.errors);
    } catch {
      setErrors([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadErrors('', '');
  }, [loadErrors]);

  const handleLevelChange = (e) => {
    const val = e.target.value;
    setLevel(val);
    loadErrors(val, search.trim());
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      loadErrors(level, val.trim());
    }, 400);
  };

  return (
    <>
      <div className="admin-controls">
        <select className="admin-filter-select" value={level} onChange={handleLevelChange}>
          {['', 'error', 'warn', 'fatal'].map((l) => (
            <option key={l} value={l}>
              {l || 'Tutti i livelli'}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Cerca nel messaggio..."
          className="admin-search"
          value={search}
          onChange={handleSearchChange}
        />
      </div>
      {loading ? (
        <div className="user-cards-loading">Caricamento...</div>
      ) : errors.length === 0 ? (
        <div className="user-cards-loading">Nessun errore. Bene cosi'.</div>
      ) : (
        <div className="user-cards">
          {errors.map((err, i) => (
            <ErrorCard key={i} error={err} />
          ))}
        </div>
      )}
    </>
  );
}

function ErrorCard({ error: err }) {
  const [expanded, setExpanded] = useState(false);

  const date = new Date(err.created_at).toLocaleString('it-IT', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`error-card level-${err.level}`}
      onClick={() => err.stack && setExpanded(!expanded)}
      style={{ cursor: err.stack ? 'pointer' : 'default' }}
    >
      <div className="error-card-top">
        <span className={`level-badge level-${err.level}`}>{err.level}</span>
        {err.status_code && <span className="error-card-status">{err.status_code}</span>}
        <span className="error-card-date">{date}</span>
      </div>
      {err.endpoint && <div className="error-card-endpoint">{err.endpoint}</div>}
      <div className="error-card-message">{(err.message || '').substring(0, 200)}</div>
      {err.user_email && <div className="error-card-user">{err.user_email}</div>}
      {expanded && err.stack && (
        <pre className="stack-trace">{err.stack}</pre>
      )}
    </div>
  );
}
