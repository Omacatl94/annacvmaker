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
      {loading ? (
        <div className="user-cards-loading">Caricamento...</div>
      ) : (
        <>
          <div className="user-cards">
            {users.map((u) => (
              <UserCard key={u.id} user={u} />
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

function UserCard({ user: initialUser }) {
  const [user, setUser] = useState(initialUser);
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingCredits, setEditingCredits] = useState(false);
  const [creditVal, setCreditVal] = useState(user.credits);
  const [creditReason, setCreditReason] = useState('');
  const handleToggle = async () => {
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

  const handleSaveCredits = async () => {
    try {
      await api.adminUpdateCredits(user.id, { credits: +creditVal, reason: creditReason });
      setUser((prev) => ({ ...prev, credits: +creditVal }));
      setEditingCredits(false);
      setCreditReason('');
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('it-IT') : '\u2014';
  const spent = '\u20AC' + (+user.total_spent_cents / 100).toFixed(2);

  return (
    <div className={`user-card${expanded ? ' expanded' : ''}`}>
      {/* Always-visible header */}
      <div className="user-card-header" onClick={handleToggle}>
        <div className="user-card-primary">
          <span className="user-card-name">{user.name || user.email.split('@')[0]}</span>
          <span className={`admin-badge ${user.status}`}>{user.status}</span>
        </div>
        <div className="user-card-email">{user.email}</div>
        <div className="user-card-summary">
          <span>{user.credits} Raccoin</span>
          <span className="user-card-dot">{'\u00B7'}</span>
          <span>{user.cvs_generated} CV</span>
          <span className="user-card-dot">{'\u00B7'}</span>
          <span>{spent}</span>
        </div>
        <span className={`user-card-chevron${expanded ? ' open' : ''}`}>{'\u276F'}</span>
      </div>

      {/* Expandable detail */}
      {expanded && (
        <div className="user-card-body">
          {/* Section 1: Stats KPI */}
          <div className="user-card-section-block">
            <div className="section-block-title">Statistiche</div>
            <div className="user-card-kpis">
              <div className="user-card-kpi">
                <span className="kpi-num">{user.credits}</span>
                <span className="kpi-label-sm">Raccoin</span>
              </div>
              <div className="user-card-kpi">
                <span className="kpi-num">{user.cvs_generated}</span>
                <span className="kpi-label-sm">CV generati</span>
              </div>
              <div className="user-card-kpi">
                <span className="kpi-num">{spent}</span>
                <span className="kpi-label-sm">Spesa</span>
              </div>
            </div>
          </div>

          {/* Section 2: Dates */}
          <div className="user-card-section-block">
            <div className="section-block-title">Date</div>
            <div className="user-card-dates">
              <div className="user-card-date-item">
                <span className="date-label">Ultimo login</span>
                <span className="date-value">{fmtDate(user.last_login)}</span>
              </div>
              <div className="user-card-date-item">
                <span className="date-label">Registrato</span>
                <span className="date-value">{fmtDate(user.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Actions */}
          <div className="user-card-section-block">
            <div className="section-block-title">Azioni</div>
            <div className="user-card-actions-row">
              <button
                className="btn-sm"
                onClick={() => setEditingCredits(!editingCredits)}
              >
                Modifica Raccoin
              </button>
            </div>
            {editingCredits && (
              <div className="user-card-credit-editor">
                <input
                  type="number"
                  value={creditVal}
                  min={0}
                  onChange={(e) => setCreditVal(e.target.value)}
                  placeholder="Raccoin"
                />
                <input
                  type="text"
                  placeholder="Motivo"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                />
                <div className="credit-editor-btns">
                  <button className="btn-sm btn-primary" onClick={handleSaveCredits}>
                    Salva
                  </button>
                  <button className="btn-sm" onClick={() => setEditingCredits(false)}>
                    Annulla
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Activity history */}
          {detailLoading ? (
            <div className="user-card-detail-loading">Caricamento dettagli...</div>
          ) : detail?.error ? (
            <div className="user-card-detail-error">Errore: {detail.error}</div>
          ) : detail ? (
            <UserDetail detail={detail} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function UserDetail({ detail }) {
  if (detail.purchases.length === 0 && detail.usage.length === 0) {
    return <div className="user-card-no-activity">Nessuna attivit&agrave; registrata.</div>;
  }

  return (
    <div className="user-card-activity">
      {detail.purchases.length > 0 && (
        <div className="user-card-section">
          <h4>Acquisti</h4>
          {detail.purchases.map((p, i) => (
            <div key={i} className="activity-row">
              <span className="activity-date">{new Date(p.created_at).toLocaleDateString('it-IT')}</span>
              <span className="activity-desc">{p.tier}</span>
              <span className="activity-value">+{p.credits_added} cr &middot; {'\u20AC'}{(p.amount_cents / 100).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
      {detail.usage.length > 0 && (
        <div className="user-card-section">
          <h4>Uso Raccoin</h4>
          {detail.usage.slice(0, 10).map((u, i) => (
            <div key={i} className="activity-row">
              <span className="activity-date">{new Date(u.created_at).toLocaleDateString('it-IT')}</span>
              <span className="activity-desc">{u.action}</span>
              <span className="activity-value">-{u.credits_consumed}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
