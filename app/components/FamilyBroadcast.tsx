'use client';
/**
 * app/components/FamilyBroadcast.tsx — G4: last-sent timestamps via localStorage
 */
import { useEffect, useState } from 'react';
import { CheckCircle, Send, Users, Clock } from 'lucide-react';
import type { Patient } from '@/app/hooks/useDashboard';

const LS_KEY = 'parem_nok_last_sent';

function loadSentMap(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}'); } catch { return {}; }
}
function saveSentMap(map: Record<string, string>) {
  localStorage.setItem(LS_KEY, JSON.stringify(map));
}
function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString('en-SA', { month: 'short', day: 'numeric' });
}

type NokResult = { sent: number; text: string };
type Props = {
  patients:       Patient[];
  sending:        Record<string, boolean>;
  broadcasting:   boolean;
  results:        Record<string, NokResult>;
  onSend:         (id: string) => void;
  onBroadcastAll: () => void;
};

export function FamilyBroadcast({ patients, sending, broadcasting, results, onSend, onBroadcastAll }: Props) {
  const [sentAt, setSentAt] = useState<Record<string, string>>({});

  // Load persisted timestamps from localStorage
  useEffect(() => {
    setSentAt(loadSentMap());
  }, []);

  // Update timestamp when a result arrives
  useEffect(() => {
    const updated: Record<string, string> = { ...loadSentMap() };
    let changed = false;
    for (const id of Object.keys(results)) {
      if (!updated[id]) { updated[id] = new Date().toISOString(); changed = true; }
    }
    if (changed) { saveSentMap(updated); setSentAt(updated); }
  }, [results]);

  return (
    <div className="fb-panel">
      <div className="fb-header">
        <div>
          <h2 className="fb-title"><Send size={18} color="#6366f1" />Family Broadcast</h2>
          <p className="fb-sub">Send weekly health updates to next-of-kin contacts</p>
        </div>
        <button id="broadcast-all-nok" onClick={onBroadcastAll} disabled={broadcasting} className="fb-broadcast-btn">
          {broadcasting
            ? <><span className="fb-spinner" />Broadcasting…</>
            : <><Send size={13} />Broadcast All</>}
        </button>
      </div>

      {patients.length === 0 ? (
        <div className="fb-empty"><Users size={40} color="rgba(255,255,255,.08)" /><p>No patients enrolled yet.</p></div>
      ) : (
        <div className="fb-grid">
          {patients.map(p => {
            const result    = results[p.id];
            const isSending = sending[p.id] ?? false;
            const lastSent  = sentAt[p.id];
            const nokLabel  = p.nextOfKinName ? `NOK: ${p.nextOfKinName}` : p.familyGroupMode ? '👪 Group mode' : 'No contact';
            return (
              <div key={p.id} id={`nok-card-${p.id}`} className={`fb-card ${result ? 'fb-card-sent' : ''}`}>
                <div className="fb-patient-row">
                  <div className="fb-avatar">{p.firstName[0]}{p.lastName[0]}</div>
                  <div className="fb-patient-info">
                    <p className="fb-patient-name">{p.firstName} {p.lastName}</p>
                    <p className="fb-nok-label">{nokLabel}</p>
                  </div>
                  <div className="fb-badges">
                    {p.familyGroupMode && <span className="fb-group-badge">Group</span>}
                    <span className={`fb-consent ${p.consentGiven ? 'fb-consent-yes' : 'fb-consent-no'}`}>
                      {p.consentGiven ? 'Consented' : 'No Consent'}
                    </span>
                  </div>
                </div>

                {result?.text && (
                  <p className="fb-summary">{result.text}</p>
                )}

                <div className="fb-action-row">
                  <div className="fb-status-info">
                    {result ? (
                      <span className="fb-sent-label"><CheckCircle size={11} />Sent to {result.sent} recipient{result.sent !== 1 ? 's' : ''}</span>
                    ) : lastSent ? (
                      <span className="fb-lastsent-label"><Clock size={11} />Last sent: {fmtRelative(lastSent)}</span>
                    ) : (
                      <span className="fb-pending-label">Not yet sent</span>
                    )}
                  </div>
                  <button
                    id={`send-nok-${p.id}`}
                    disabled={isSending || !p.consentGiven}
                    onClick={() => onSend(p.id)}
                    className={`fb-send-btn ${result ? 'fb-send-btn-resend' : ''}`}
                  >
                    {isSending
                      ? <><span className="fb-spinner fb-spinner-sm" />Sending…</>
                      : <><Send size={10} />{result ? 'Resend' : 'Send Update'}</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .fb-panel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:1.5rem;display:flex;flex-direction:column;gap:1.25rem}
        .fb-header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap}
        .fb-title{display:flex;align-items:center;gap:.5rem;font-size:1.0625rem;font-weight:700;color:#fff;margin-bottom:.25rem}
        .fb-sub{font-size:.8125rem;color:rgba(255,255,255,.4)}
        .fb-broadcast-btn{display:flex;align-items:center;gap:.5rem;padding:.6rem 1.125rem;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-size:.8125rem;font-weight:700;border:none;border-radius:10px;cursor:pointer;transition:opacity .2s;white-space:nowrap;box-shadow:0 4px 16px rgba(99,102,241,.3);flex-shrink:0}
        .fb-broadcast-btn:disabled{opacity:.5;cursor:not-allowed}
        .fb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:.875rem}
        .fb-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:1rem;display:flex;flex-direction:column;gap:.75rem;transition:border-color .25s,background .25s}
        .fb-card:hover{border-color:rgba(99,102,241,.2)}
        .fb-card-sent{border-color:rgba(16,185,129,.2);background:rgba(16,185,129,.04)}
        .fb-patient-row{display:flex;align-items:center;gap:.625rem}
        .fb-avatar{width:36px;height:36px;border-radius:10px;background:rgba(99,102,241,.2);color:#a5b4fc;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;flex-shrink:0}
        .fb-patient-info{flex:1;min-width:0}
        .fb-patient-name{font-size:.875rem;font-weight:600;color:#fff}
        .fb-nok-label{font-size:.6875rem;color:rgba(255,255,255,.4);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .fb-badges{display:flex;flex-direction:column;align-items:flex-end;gap:.25rem;flex-shrink:0}
        .fb-group-badge{font-size:.5625rem;font-weight:700;padding:.15rem .45rem;border-radius:999px;background:rgba(168,85,247,.2);color:#d8b4fe;letter-spacing:.04em}
        .fb-consent{font-size:.5625rem;font-weight:700;padding:.2rem .5rem;border-radius:999px;letter-spacing:.04em;text-transform:uppercase}
        .fb-consent-yes{background:rgba(16,185,129,.12);color:#6ee7b7}
        .fb-consent-no{background:rgba(239,68,68,.1);color:#fca5a5}
        .fb-summary{font-size:.75rem;color:rgba(255,255,255,.55);background:rgba(0,0,0,.18);padding:.625rem .75rem;border-radius:8px;line-height:1.6;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
        .fb-action-row{display:flex;align-items:center;justify-content:space-between;margin-top:auto;gap:.5rem}
        .fb-status-info{display:flex;align-items:center;min-width:0}
        .fb-sent-label{display:flex;align-items:center;gap:.3rem;font-size:.75rem;color:#6ee7b7;font-weight:600}
        .fb-lastsent-label{display:flex;align-items:center;gap:.3rem;font-size:.6875rem;color:rgba(255,255,255,.4);font-weight:500}
        .fb-pending-label{font-size:.75rem;color:rgba(255,255,255,.25)}
        .fb-send-btn{display:flex;align-items:center;gap:.375rem;padding:.45rem .875rem;background:rgba(99,102,241,.12);color:#a5b4fc;font-size:.75rem;font-weight:700;border:1px solid rgba(99,102,241,.22);border-radius:8px;cursor:pointer;transition:background .2s;white-space:nowrap;flex-shrink:0}
        .fb-send-btn:hover:not(:disabled){background:rgba(99,102,241,.22)}
        .fb-send-btn:disabled{opacity:.4;cursor:not-allowed}
        .fb-send-btn-resend{background:rgba(16,185,129,.1);color:#6ee7b7;border-color:rgba(16,185,129,.2)}
        .fb-send-btn-resend:hover:not(:disabled){background:rgba(16,185,129,.2)}
        .fb-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3rem;gap:.75rem;color:rgba(255,255,255,.3);font-size:.875rem}
        .fb-spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.2);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}
        .fb-spinner-sm{width:11px;height:11px;border-width:1.5px}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}
