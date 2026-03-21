import { useState, useEffect, useRef } from 'react';
import { api } from '../../api';

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [orBalance, setOrBalance] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    Promise.all([
      api.adminOverview(),
      api.adminOpenRouter().catch(() => null),
    ])
      .then(([ov, or]) => {
        setOverview(ov);
        setOrBalance(or);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div>Errore: {error}</div>;
  if (!overview) return <div>Caricamento...</div>;

  const kpis = [
    { label: 'Utenti registrati', value: overview.users.total, sub: `+${overview.users.last7d} (7gg) / +${overview.users.last30d} (30gg)` },
    { label: 'Revenue totale', value: '\u20AC' + (overview.revenue.totalCents / 100).toFixed(2), sub: `\u20AC${(overview.revenue.last30dCents / 100).toFixed(2)} ultimi 30gg` },
    { label: 'CV generati', value: overview.cvs.total, sub: `${overview.cvs.last30d} ultimi 30gg` },
    { label: 'Cover letter', value: overview.coverLetters, sub: `${overview.creditsUsed} Raccoin usati totali` },
  ];

  if (orBalance) {
    const bal = typeof orBalance.balance === 'number' ? orBalance.balance : null;
    const usage = typeof orBalance.usage === 'number' ? orBalance.usage : null;
    kpis.push({
      label: 'OpenRouter',
      value: bal !== null ? `$${bal.toFixed(2)}` : 'N/A',
      sub: usage !== null ? `$${usage.toFixed(2)} usati` : '',
      warn: bal !== null && bal < 5,
    });
  }

  return (
    <>
      <KPIGrid kpis={kpis} />
      <TimeseriesChart metric="registrations" title="Registrazioni" />
      <TimeseriesChart metric="revenue" title="Revenue (centesimi)" />
      <CohortTable />
    </>
  );
}

function KPIGrid({ kpis }) {
  return (
    <div className="admin-kpi-grid">
      {kpis.map((kpi, i) => (
        <div className={`admin-kpi-card${kpi.warn ? ' warn' : ''}`} key={i}>
          <div className="kpi-label">{kpi.label}</div>
          <div className="kpi-value">{kpi.value}</div>
          {kpi.sub && <div className="kpi-sub">{kpi.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// -- Timeseries Chart (Canvas)
function TimeseriesChart({ metric, title }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const from = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);

    api.adminTimeseries({ metric, from, to })
      .then((res) => {
        if (canvasRef.current) drawLineChart(canvasRef.current, res.data);
      })
      .catch(() => {
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx.fillStyle = '#718096';
          ctx.fillText('Dati non disponibili', 20, 130);
        }
      });
  }, [metric]);

  return (
    <div className="admin-chart-section">
      <h3>{title}</h3>
      <canvas ref={canvasRef} width={800} height={250} className="admin-chart" />
    </div>
  );
}

function drawLineChart(canvas, data) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const pad = { top: 20, right: 20, bottom: 40, left: 60 };

  ctx.clearRect(0, 0, W, H);

  if (!data || !data.length) {
    ctx.fillStyle = '#718096';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText('Nessun dato', W / 2 - 40, H / 2);
    return;
  }

  const filled = fillDates(data);
  const values = filled.map((d) => d.value);
  const maxVal = Math.max(...values, 1);
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();
  }

  // Y-axis
  ctx.fillStyle = '#718096';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (chartH / 4) * i;
    ctx.fillText(Math.round(maxVal * (1 - i / 4)), pad.left - 8, y + 4);
  }

  // X-axis
  ctx.textAlign = 'center';
  const step = Math.max(1, Math.floor(filled.length / 6));
  for (let i = 0; i < filled.length; i += step) {
    const x = pad.left + (i / (filled.length - 1)) * chartW;
    ctx.fillText(filled[i].date.slice(5), x, H - 10);
  }

  // Line
  ctx.strokeStyle = '#00E676';
  ctx.lineWidth = 2;
  ctx.beginPath();
  filled.forEach((d, i) => {
    const x = pad.left + (i / (filled.length - 1)) * chartW;
    const y = pad.top + chartH - (d.value / maxVal) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Area
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = '#00E676';
  ctx.lineTo(pad.left + chartW, pad.top + chartH);
  ctx.lineTo(pad.left, pad.top + chartH);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function fillDates(data) {
  if (!data.length) return [];
  const map = {};
  for (const d of data) map[d.date] = d.value;
  const start = new Date(data[0].date);
  const end = new Date(data[data.length - 1].date);
  const result = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, value: map[key] || 0 });
  }
  return result;
}

// -- Cohort Table
function CohortTable() {
  const [cohorts, setCohorts] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.adminCohort()
      .then((res) => setCohorts(res.cohorts))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="admin-section"><h3>Retention per coorte</h3><p>Errore: {error}</p></div>;
  if (!cohorts) return null;

  const months = Object.keys(cohorts).sort();
  if (months.length === 0) {
    return <div className="admin-section"><h3>Retention per coorte</h3><p>Nessun dato</p></div>;
  }

  const allMonths = new Set();
  for (const m of months) {
    allMonths.add(m);
    for (const am of Object.keys(cohorts[m].months)) allMonths.add(am);
  }
  const sortedMonths = [...allMonths].sort();

  return (
    <div className="admin-section">
      <h3>Retention per coorte</h3>
      <table className="admin-table cohort-table">
        <thead>
          <tr>
            <th>Coorte</th>
            <th>Size</th>
            {sortedMonths.map((m) => (
              <th key={m}>{m.slice(5)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((cohort) => (
            <tr key={cohort}>
              <td>{cohort}</td>
              <td>{cohorts[cohort].size}</td>
              {sortedMonths.map((m) => {
                const active = cohorts[cohort].months[m] || 0;
                const pct = cohorts[cohort].size > 0 ? Math.round((active / cohorts[cohort].size) * 100) : 0;
                return (
                  <td
                    key={m}
                    className={pct > 50 ? 'cohort-high' : pct > 20 ? 'cohort-mid' : 'cohort-low'}
                  >
                    {active > 0 ? `${pct}%` : '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
