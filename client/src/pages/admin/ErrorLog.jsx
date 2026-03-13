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
      <div className="admin-table-wrap">
        {loading ? (
          'Caricamento...'
        ) : errors.length === 0 ? (
          "Nessun errore. Bene cosi'."
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                {['Data', 'Level', 'Endpoint', 'Messaggio', 'Utente', 'Status'].map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {errors.map((err, i) => (
                <ErrorRow key={i} error={err} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function ErrorRow({ error: err }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className={`error-row level-${err.level}`}
        style={{ cursor: err.stack ? 'pointer' : 'default' }}
        onClick={() => err.stack && setExpanded(!expanded)}
      >
        <td>{new Date(err.created_at).toLocaleString('it-IT')}</td>
        <td>
          <span className={`level-badge level-${err.level}`}>{err.level}</span>
        </td>
        <td>{err.endpoint || '-'}</td>
        <td>{(err.message || '').substring(0, 100)}</td>
        <td>{err.user_email || '-'}</td>
        <td>{err.status_code || '-'}</td>
      </tr>
      {expanded && err.stack && (
        <tr className="stack-row">
          <td colSpan={6}>
            <pre className="stack-trace">{err.stack}</pre>
          </td>
        </tr>
      )}
    </>
  );
}
