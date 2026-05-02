/**
 * app/components/RiskLeaderboard.tsx
 * Risk overview pills + ranked leaderboard — used on Clinical page.
 */
import { TrendingUp } from 'lucide-react';
import type { RiskEntry, RiskSummary } from '@/app/hooks/useDashboard';

type Props = { summary: RiskSummary; leaderboard: RiskEntry[] };

function RiskBadge({ level }: { level: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const cfg = {
    HIGH:   { bg: 'rgba(239,68,68,.2)',  text: '#fca5a5', label: 'HIGH'   },
    MEDIUM: { bg: 'rgba(245,158,11,.2)', text: '#fcd34d', label: 'MED'    },
    LOW:    { bg: 'rgba(16,185,129,.2)', text: '#6ee7b7', label: 'LOW'    },
  }[level];
  return (
    <span style={{ background: cfg.bg, color: cfg.text, fontSize: '.6875rem', fontWeight: 700,
      padding: '.2rem .625rem', borderRadius: 999, letterSpacing: '.04em' }}>
      {cfg.label}
    </span>
  );
}

export function RiskLeaderboard({ summary, leaderboard }: Props) {
  return (
    <div className="rl-wrap">
      {/* Overview pills */}
      <div className="rl-panel">
        <div className="rl-header">
          <h3 className="rl-title"><TrendingUp size={16} color="#f97316" /> Risk Overview</h3>
          {summary.unscored > 0 && <span className="rl-unscored">{summary.unscored} unscored</span>}
        </div>
        <div className="rl-pills">
          {([
            { label: 'High',   count: summary.high,   color: '#ef4444', bg: 'rgba(239,68,68,.12)',   border: 'rgba(239,68,68,.25)'   },
            { label: 'Medium', count: summary.medium, color: '#f59e0b', bg: 'rgba(245,158,11,.12)',  border: 'rgba(245,158,11,.25)'  },
            { label: 'Low',    count: summary.low,    color: '#10b981', bg: 'rgba(16,185,129,.12)',  border: 'rgba(16,185,129,.25)'  },
          ] as const).map(r => (
            <div key={r.label} className="rl-pill" style={{ background: r.bg, border: `1px solid ${r.border}` }}>
              <span className="rl-pill-count" style={{ color: r.color }}>{r.count}</span>
              <span className="rl-pill-label" style={{ color: r.color, opacity: .7 }}>{r.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="rl-panel">
        <div className="rl-header">
          <h3 className="rl-title">Risk Leaderboard</h3>
          <span className="rl-unscored">Newest score</span>
        </div>
        {leaderboard.length > 0 ? (
          <div className="rl-list">
            {leaderboard.map((entry, idx) => (
              <div key={entry.patientId} id={`risk-entry-${entry.patientId}`} className="rl-row">
                <span className="rl-rank">#{idx + 1}</span>
                <div className="rl-info">
                  <p className="rl-patient">{entry.name}</p>
                  <p className="rl-rationale">{entry.rationale}</p>
                </div>
                <RiskBadge level={entry.level} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rl-empty">
            <p>No scores yet — run risk scoring to populate.</p>
          </div>
        )}
      </div>

      <style>{`
        .rl-wrap { display: flex; flex-direction: column; gap: 1rem; }
        .rl-panel {
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 16px; padding: 1.25rem;
        }
        .rl-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
        .rl-title { display: flex; align-items: center; gap: .4rem; font-size: .9375rem; font-weight: 700; color: #fff; }
        .rl-unscored { font-size: .6875rem; color: rgba(255,255,255,.35); font-weight: 500; }
        .rl-pills { display: grid; grid-template-columns: repeat(3,1fr); gap: .625rem; }
        .rl-pill {
          display: flex; flex-direction: column; align-items: center;
          padding: .75rem; border-radius: 10px; gap: .2rem;
        }
        .rl-pill-count { font-size: 1.5rem; font-weight: 800; }
        .rl-pill-label { font-size: .6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
        .rl-list { display: flex; flex-direction: column; gap: .5rem; }
        .rl-row {
          display: flex; align-items: center; gap: .75rem;
          padding: .625rem .75rem; border-radius: 10px;
          transition: background .2s;
        }
        .rl-row:hover { background: rgba(255,255,255,.05); }
        .rl-rank { font-size: .6875rem; color: rgba(255,255,255,.3); font-weight: 600; width: 20px; flex-shrink: 0; }
        .rl-info { flex: 1; min-width: 0; }
        .rl-patient { font-size: .8125rem; font-weight: 600; color: #fff; truncate; }
        .rl-rationale { font-size: .6875rem; color: rgba(255,255,255,.4); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rl-empty { padding: 2rem; text-align: center; color: rgba(255,255,255,.3); font-size: .8125rem; }
      `}</style>
    </div>
  );
}
