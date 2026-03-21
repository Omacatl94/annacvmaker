import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api';
import Icon from './Icon';

const RACCOON_THANKS = [
  'Grazie! Analizzerò tutto con attenzione.',
  'Ricevuto! Il procione è al lavoro.',
  'Segnalazione presa in carico!',
  'Grazie mille! Ogni feedback conta.',
  'Ottimo, ci guardo subito!',
];

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('form'); // 'form' | 'history'
  const [type, setType] = useState('bug');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (open && tab === 'history') loadHistory();
  }, [open, tab]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setSent(false);
        setMessage('');
        setTab('form');
      }, 300);
    }
  }, [open]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.myFeedback();
      setHistory(res.feedback);
    } catch { setHistory([]); }
    setLoadingHistory(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await api.submitFeedback({ type, message: message.trim(), pageUrl: location.pathname });
      setSent(true);
      setMessage('');
    } catch (err) {
      alert('Errore: ' + err.message);
    }
    setSending(false);
  };

  const thanksMessage = RACCOON_THANKS[Math.floor(Math.random() * RACCOON_THANKS.length)];

  return (
    <>
      <button
        className={'feedback-fab' + (open ? ' active' : '')}
        onClick={() => setOpen(!open)}
        title="Segnala bug o suggerimento"
        aria-label="Apri pannello feedback"
      >
        <img src="/img/mascot/avatar.webp" alt="Feedback" className="feedback-fab-img" />
      </button>

      {open && (
        <div className="feedback-panel">
          <div className="feedback-panel-header">
            <div className="feedback-tabs">
              <button
                className={'feedback-tab' + (tab === 'form' ? ' active' : '')}
                onClick={() => setTab('form')}
              >
                Segnala
              </button>
              <button
                className={'feedback-tab' + (tab === 'history' ? ' active' : '')}
                onClick={() => setTab('history')}
              >
                Cronologia
              </button>
            </div>
            <button className="feedback-panel-close" onClick={() => setOpen(false)} aria-label="Chiudi pannello feedback">
              <Icon name="x" size={16} />
            </button>
          </div>

          {tab === 'form' && !sent && (
            <form className="feedback-form" onSubmit={handleSubmit}>
              <div className="feedback-type-row">
                <button
                  type="button"
                  className={'feedback-type-btn' + (type === 'bug' ? ' active bug' : '')}
                  onClick={() => setType('bug')}
                >
                  Bug
                </button>
                <button
                  type="button"
                  className={'feedback-type-btn' + (type === 'suggestion' ? ' active suggestion' : '')}
                  onClick={() => setType('suggestion')}
                >
                  Suggerimento
                </button>
              </div>
              <textarea
                className="feedback-textarea"
                placeholder={type === 'bug' ? 'Descrivi il problema...' : 'La tua idea...'}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                rows={4}
              />
              <div className="feedback-footer">
                <span className="feedback-page">
                  <Icon name="map-pin" size={12} /> {location.pathname}
                </span>
                <button className="btn-primary btn-sm" disabled={!message.trim() || sending}>
                  {sending ? '...' : 'Invia'}
                </button>
              </div>
            </form>
          )}

          {tab === 'form' && sent && (
            <div className="feedback-thanks">
              <img src="/img/mascot/success-social.webp" alt="Grazie!" className="feedback-thanks-img" />
              <p>{thanksMessage}</p>
            </div>
          )}

          {tab === 'history' && (
            <div className="feedback-history">
              {loadingHistory ? (
                <p className="feedback-empty">Caricamento...</p>
              ) : history.length === 0 ? (
                <p className="feedback-empty">Nessuna segnalazione ancora.</p>
              ) : (
                history.map((fb) => (
                  <FeedbackItem key={fb.id} item={fb} />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function FeedbackItem({ item }) {
  const date = new Date(item.created_at).toLocaleDateString('it-IT', {
    day: 'numeric', month: 'short',
  });
  const statusLabel = { pending: 'In attesa', reviewed: 'Letto', rewarded: 'Ricompensato' };
  const statusClass = item.status;

  return (
    <div className="feedback-item">
      <div className="feedback-item-top">
        <span className={'feedback-item-type ' + item.type}>
          {item.type === 'bug' ? 'Bug' : 'Idea'}
        </span>
        <span className={'feedback-item-status ' + statusClass}>
          {statusLabel[item.status]}
        </span>
        <span className="feedback-item-date">{date}</span>
      </div>
      <div className="feedback-item-msg">{item.message.substring(0, 120)}</div>
      {item.credits_awarded > 0 && (
        <div className="feedback-item-reward">+{item.credits_awarded} Raccoin</div>
      )}
      {item.admin_note && (
        <div className="feedback-item-note">{item.admin_note}</div>
      )}
    </div>
  );
}
