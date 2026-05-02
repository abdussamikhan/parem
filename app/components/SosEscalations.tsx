'use client';
/**
 * app/components/SosEscalations.tsx — G4: live counting timer
 */
import { useEffect, useState } from 'react';
import { ShieldAlert, Clock, Phone } from 'lucide-react';
import type { SOSAlert } from '@/app/hooks/useDashboard';

// ─── Live elapsed-time counter ────────────────────────────────────────────────
function LiveTimer({ iso }: { iso?: string }) {
  const getElapsed = () => {
    if (!iso) return 0;
    return Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  };
  const [secs, setSecs] = useState(getElapsed);

  useEffect(() => {
    const id = setInterval(() => setSecs(getElapsed()), 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]);

  if (secs < 5)   return <span className="sos-time"><Clock size={11} /> Just now</span>;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const urgent = secs > 300; // >5 min
  if (m < 60) return (
    <span className="sos-time" style={{ color: urgent ? '#f87171' : '#fca5a5' }}>
      <Clock size={11} />
      {m > 0 ? `${m}m ${s}s` : `${s}s`}
      {urgent && <span className="sos-urgent-dot" />}
    </span>
  );
  return <span className="sos-time"><Clock size={11} /> {Math.floor(m / 60)}h {m % 60}m</span>;
}

// ─── Severity label ───────────────────────────────────────────────────────────
function getSeverity(secs: number) {
  if (secs > 600) return { label: 'CRITICAL', color: '#f87171' };
  if (secs > 300) return { label: 'URGENT',   color: '#fb923c' };
  return { label: 'NEW', color: '#fcd34d' };
}

type Props = { alerts: SOSAlert[]; acknowledging: Record<string, boolean>; onAcknowledge: (id: string) => void };

export function SosEscalations({ alerts, acknowledging, onAcknowledge }: Props) {
  return (
    <div className="sos-panel">
      <div className="sos-header">
        <h2 className="sos-title"><ShieldAlert size={20} color="#ef4444" />Active SOS Escalations</h2>
        <span className={`sos-badge ${alerts.length > 0 ? 'sos-badge-critical' : 'sos-badge-clear'}`}>
          {alerts.length > 0 ? `${alerts.length} Critical` : 'All Clear'}
        </span>
      </div>

      {alerts.length > 0 ? (
        <div className="sos-list">
          {alerts.map(sos => {
            const elapsedSec = sos.alertSentAt ? Math.floor((Date.now() - new Date(sos.alertSentAt).getTime()) / 1000) : 0;
            const sev = getSeverity(elapsedSec);
            return (
              <div key={sos.id} id={`sos-card-${sos.id}`} className="sos-card" style={{ borderColor: `${sev.color}44` }}>
                <div className="sos-card-top">
                  <div className="sos-patient">
                    <div className="sos-avatar">{sos.patient.firstName[0]}{sos.patient.lastName[0]}</div>
                    <div>
                      <p className="sos-name">{sos.patient.firstName} {sos.patient.lastName}</p>
                      <div className="sos-meta-row">
                        <Phone size={10} color="rgba(255,255,255,.35)" />
                        <span className="sos-phone">{sos.patient.phone}</span>
                        <span className="sos-sev-chip" style={{ background: `${sev.color}22`, color: sev.color }}>{sev.label}</span>
                      </div>
                    </div>
                  </div>
                  <LiveTimer iso={sos.alertSentAt} />
                </div>

                <p className="sos-message">{sos.patientMessage}</p>

                <div className="sos-card-footer">
                  <button
                    id={`acknowledge-sos-${sos.id}`}
                    disabled={acknowledging[sos.id]}
                    onClick={() => onAcknowledge(sos.id)}
                    className="sos-ack-btn"
                  >
                    {acknowledging[sos.id] ? (
                      <><span className="sos-spinner" /> Resolving…</>
                    ) : '✓ Acknowledge & Resolve'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="sos-empty">
          <ShieldAlert size={48} color="rgba(255,255,255,.08)" />
          <p>No active emergency escalations</p>
          <span className="sos-clear-label">System monitoring 24/7</span>
        </div>
      )}

      <style>{`
        .sos-panel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:1.5rem}
        .sos-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem}
        .sos-title{display:flex;align-items:center;gap:.5rem;font-size:1rem;font-weight:700;color:#fff}
        .sos-badge{font-size:.6875rem;font-weight:700;padding:.25rem .75rem;border-radius:999px;letter-spacing:.04em;text-transform:uppercase}
        .sos-badge-critical{background:rgba(239,68,68,.2);color:#fca5a5;border:1px solid rgba(239,68,68,.3)}
        .sos-badge-clear{background:rgba(16,185,129,.15);color:#6ee7b7;border:1px solid rgba(16,185,129,.25)}
        .sos-list{display:flex;flex-direction:column;gap:.875rem}
        .sos-card{background:rgba(239,68,68,.07);border:1px solid;border-radius:14px;padding:1rem;animation:sos-pulse 2.5s ease-in-out infinite}
        @keyframes sos-pulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}50%{box-shadow:0 0 0 5px rgba(239,68,68,.12)}}
        .sos-card-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:.75rem}
        .sos-patient{display:flex;align-items:center;gap:.625rem}
        .sos-avatar{width:38px;height:38px;border-radius:10px;background:rgba(239,68,68,.25);color:#fca5a5;display:flex;align-items:center;justify-content:center;font-size:.8125rem;font-weight:700;flex-shrink:0}
        .sos-name{font-size:.875rem;font-weight:700;color:#fff;margin-bottom:3px}
        .sos-meta-row{display:flex;align-items:center;gap:.375rem}
        .sos-phone{font-size:.6875rem;color:rgba(255,255,255,.4)}
        .sos-sev-chip{font-size:.5625rem;font-weight:800;padding:.15rem .45rem;border-radius:999px;letter-spacing:.06em}
        .sos-time{display:flex;align-items:center;gap:.3rem;font-size:.6875rem;color:#fca5a5;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}
        .sos-urgent-dot{width:6px;height:6px;border-radius:50%;background:#f87171;animation:kpi-ping 1s infinite}
        @keyframes kpi-ping{0%{box-shadow:0 0 0 0 rgba(248,113,113,.7)}70%{box-shadow:0 0 0 6px rgba(248,113,113,0)}100%{box-shadow:0 0 0 0 rgba(248,113,113,0)}}
        .sos-message{font-size:.8125rem;color:rgba(255,255,255,.72);line-height:1.6;background:rgba(0,0,0,.22);padding:.625rem .875rem;border-radius:8px;border:1px solid rgba(239,68,68,.15);margin-bottom:.875rem}
        .sos-card-footer{display:flex;justify-content:flex-end}
        .sos-ack-btn{display:flex;align-items:center;gap:.5rem;padding:.5rem 1.125rem;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-size:.8125rem;font-weight:700;border:none;border-radius:9px;cursor:pointer;transition:opacity .2s,transform .15s;box-shadow:0 4px 12px rgba(239,68,68,.35)}
        .sos-ack-btn:hover:not(:disabled){opacity:.88;transform:translateY(-1px)}
        .sos-ack-btn:disabled{opacity:.5;cursor:not-allowed}
        .sos-spinner{width:12px;height:12px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        .sos-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3.5rem 2rem;gap:.75rem;color:rgba(255,255,255,.3);font-size:.875rem;text-align:center}
        .sos-clear-label{font-size:.6875rem;color:rgba(16,185,129,.5);font-weight:600;letter-spacing:.04em;text-transform:uppercase}
      `}</style>
    </div>
  );
}
