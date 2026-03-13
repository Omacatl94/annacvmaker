import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../api';

const PAGE_SIZE = 25;

export default function Users() {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const searchTimerRef = useRef(null);

  const loadUsers = useCallback(async (searchVal, off) => {
    setLoading(true);
    try {
      const params = { limit: PAGE_SIZE, offset: off, sort: 'created_at', order: 'desc' };
      if (searchVal) params.search = searchVal;
      const res = await api.adminUsers(params);
      setUsers(res.users);
      setTotal(res.total);
    } catch {
      setUsers([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers('', 0);
  }, [loadUsers]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setOffset(0);
      loadUsers(val.trim(), 0);
    }, 400);
  };

  const handlePageChange = (newOffset) => {
    setOffset(newOffset);
    loadUsers(search.trim(), newOffset);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <>
      <div className="admin-controls">
        <input
          type="text"
          placeholder="Cerca per email o nome..."
          className="admin-search"
          value={search}
          onChange={handleSearchChange}
        />
      </div>
      <div className="admin-table-wrap">
        {loading ? (
          'Caricamento...'
        ) : (
          <>
            <table className="admin-table">
              <thead>
                <tr>
                  {['Email', 'Nome', 'Status', 'Crediti', 'CV generati', 'Spesa', 'Ultimo login', 'Registrato'].map(
                    (col) => (
                      <th key={col}>{col}</th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <UserRow key={u.id} user={u} />
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
                  Pagina {currentPage} di {totalPages} ({total} utenti)
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

function UserRow({ user: initialUser }) {
  const [user, setUser] = useState(initialUser);
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingCredits, setEditingCredits] = useState(false);
  const [creditVal, setCreditVal] = useState(user.credits);
  const [creditReason, setCreditReason] = useState('');
  const [activating, setActivating] = useState(false);

  const handleToggleDetail = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!detail) {
      setDetailLoading(true);
      try {
        const res = await api.adminUserDetail(user.id);
        setDetail(res);
      } catch (err) {
        setDetail({ error: err.message });
      }
      setDetailLoading(false);
    }
  };

  const handleActivate = async (e) => {
    e.stopPropagation();
    if (!window.confirm("Attivare questo utente? Ricevera' 2 crediti, 3 inviti e un'email di benvenuto.")) return;
    setActivating(true);
    try {
      await api.adminActivateUser(user.id);
      setUser((prev) => ({ ...prev, status: 'active' }));
    } catch (err) {
      alert('Errore: ' + err.message);
    }
    setActivating(false);
  };

  const handleSaveCredits = async () => {
    try {
      await api.adminUpdateCredits(user.id, { credits: +creditVal, reason: creditReason });
      setUser((prev) => ({ ...prev, credits: +creditVal }));
      setEditingCredits(false);
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  };

  return (
    <>
      <tr style={{ cursor: 'pointer' }} onClick={handleToggleDetail}>
        <td>{user.email}</td>
        <td>{user.name || '-'}</td>
        <td>
          {user.status === 'waitlist' ? (
            <>
              <span className="admin-badge waitlist">waitlist</span>
              <button
                className="btn-sm btn-activate"
                disabled={activating}
                onClick={handleActivate}
              >
                {activating ? '...' : 'Attiva'}
              </button>
            </>
          ) : (
            <span className="admin-badge active">active</span>
          )}
        </td>
        <td className="credits-cell">
          <span>{user.credits}</span>
          <button
            className="btn-sm admin-edit-credits"
            onClick={(e) => {
              e.stopPropagation();
              setEditingCredits(!editingCredits);
            }}
          >
            Modifica
          </button>
          {editingCredits && (
            <div className="credit-editor" onClick={(e) => e.stopPropagation()}>
              <input
                type="number"
                value={creditVal}
                min={0}
                onChange={(e) => setCreditVal(e.target.value)}
              />
              <input
                type="text"
                placeholder="Motivo"
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
              />
              <button className="btn-sm btn-primary" onClick={handleSaveCredits}>
                Salva
              </button>
            </div>
          )}
        </td>
        <td>{user.cvs_generated}</td>
        <td>{'\u20AC' + (+user.total_spent_cents / 100).toFixed(2)}</td>
        <td>{user.last_login ? new Date(user.last_login).toLocaleDateString('it-IT') : '-'}</td>
        <td>{new Date(user.created_at).toLocaleDateString('it-IT')}</td>
      </tr>
      {expanded && (
        <tr className="user-detail-row">
          <td colSpan={8}>
            {detailLoading ? (
              'Caricamento...'
            ) : detail?.error ? (
              `Errore: ${detail.error}`
            ) : detail ? (
              <UserDetail detail={detail} />
            ) : null}
          </td>
        </tr>
      )}
    </>
  );
}

function UserDetail({ detail }) {
  if (detail.purchases.length === 0 && detail.usage.length === 0) {
    return <span>Nessuna attivit&agrave; registrata.</span>;
  }

  return (
    <>
      {detail.purchases.length > 0 && (
        <>
          <h4>Acquisti</h4>
          {detail.purchases.map((p, i) => (
            <div key={i}>
              {new Date(p.created_at).toLocaleDateString('it-IT')} {'\u2014'} {p.tier} (
              {p.credits_added} crediti, {'\u20AC'}
              {(p.amount_cents / 100).toFixed(2)})
            </div>
          ))}
        </>
      )}
      {detail.usage.length > 0 && (
        <>
          <h4 style={{ marginTop: 12 }}>Uso crediti recente</h4>
          {detail.usage.slice(0, 10).map((u, i) => (
            <div key={i}>
              {new Date(u.created_at).toLocaleDateString('it-IT')} {'\u2014'} {u.action} (-
              {u.credits_consumed})
            </div>
          ))}
        </>
      )}
    </>
  );
}
