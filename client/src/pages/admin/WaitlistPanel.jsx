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
      <div className="admin-table-wrap">
        {loading ? (
          'Caricamento...'
        ) : entries.length === 0 ? (
          'Nessuna email in waitlist.'
        ) : (
          <>
            <table className="admin-table">
              <thead>
                <tr>
                  {['Email', 'Data iscrizione', 'Stato', 'Azioni'].map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <WaitlistRow
                    key={entry.id}
                    entry={entry}
                    onInvited={(id, code) => {
                      setEntries((prev) =>
                        prev.map((e) =>
                          e.id === id ? { ...e, invited: true, inviteCode: code } : e
                        )
                      );
                    }}
                  />
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="admin-pagination">
                {offset > 0 && (
                  <button className="btn-sm" onClick={() => handlePageChange(offset - PAGE_SIZE)}>
                    {'\u2190'} Precedente
                  </button>
                )}
                <span>
                  Pagina {currentPage} di {totalPages} ({total} email)
                </span>
                {offset + PAGE_SIZE < total && (
                  <button className="btn-sm" onClick={() => handlePageChange(offset + PAGE_SIZE)}>
                    Successiva {'\u2192'}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function WaitlistRow({ entry, onInvited }) {
  const [inviting, setInviting] = useState(false);

  const handleInvite = async () => {
    setInviting(true);
    try {
      const res = await api.adminInviteWaitlist(entry.id);
      onInvited(entry.id, res.code);
    } catch (err) {
      alert('Errore: ' + err.message);
      setInviting(false);
    }
  };

  return (
    <tr>
      <td>{entry.email}</td>
      <td>{new Date(entry.created_at).toLocaleString('it-IT')}</td>
      <td>
        <span className={`admin-badge ${entry.invited ? 'active' : 'waitlist'}`}>
          {entry.invited ? 'Invitato' : 'In attesa'}
        </span>
      </td>
      <td>
        {!entry.invited ? (
          <button
            className="btn-sm btn-primary"
            disabled={inviting}
            onClick={handleInvite}
          >
            {inviting ? '...' : 'Invia invito'}
          </button>
        ) : entry.inviteCode ? (
          <code style={{ fontSize: '0.85em' }}>{entry.inviteCode}</code>
        ) : (
          '\u2014'
        )}
      </td>
    </tr>
  );
}
