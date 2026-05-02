'use client';
import { useState, useCallback } from 'react';
import { RefreshCcw, Loader2 } from 'lucide-react';
import { useDashboard } from '@/app/hooks/useDashboard';
import { useToast } from '@/app/hooks/useToast';
import { FamilyBroadcast } from '@/app/components/FamilyBroadcast';
import { Toaster } from '@/app/components/Toaster';
import { CardSkeleton } from '@/app/components/SkeletonLoader';

type NokResult = { sent: number; text: string };

export default function FamilyPage() {
  const { data, loading, refresh } = useDashboard(20000);
  const toast = useToast();
  const [sending,      setSending]      = useState<Record<string, boolean>>({});
  const [broadcasting, setBroadcasting] = useState(false);
  const [results,      setResults]      = useState<Record<string, NokResult>>({});

  const sendNOK = useCallback(async (patientId: string) => {
    setSending(p => ({ ...p, [patientId]: true }));
    try {
      const res  = await fetch(`/api/patients/${patientId}/nok-summary`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      setResults(p => ({ ...p, [patientId]: { sent: json.sent ?? 0, text: json.summaryText ?? '' } }));
      toast.success('Update sent', `Delivered to ${json.sent ?? 0} family contact${json.sent !== 1 ? 's' : ''}.`);
    } catch (err) {
      toast.error('Send failed', err instanceof Error ? err.message : 'Could not send the health update.');
    } finally {
      setSending(p => ({ ...p, [patientId]: false }));
    }
  }, [toast]);

  const broadcastAll = useCallback(async () => {
    setBroadcasting(true);
    toast.info('Broadcasting to all families…', 'This may take a few moments.');
    try {
      const res = await fetch('/api/cron/nok-summary', { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Broadcast complete', 'All family contacts have been notified.');
    } catch {
      toast.error('Broadcast failed', 'An error occurred. Check the server logs.');
    } finally {
      setBroadcasting(false);
    }
  }, [toast]);

  const consentedCount = (data?.patients ?? []).filter(p => p.consentGiven).length;
  const sentCount      = Object.keys(results).length;
  const isFirstLoad    = loading && !data;

  return (
    <div className="page-root">
      <div className="page-inner">
        <header className="page-header">
          <div>
            <h1 className="page-title">Family &amp; Communications</h1>
            <p className="page-sub">Manage weekly health updates and next-of-kin broadcasts</p>
          </div>
          <button onClick={refresh} disabled={loading} className="refresh-btn" id="family-refresh">
            {loading ? <Loader2 size={15} className="spin" /> : <RefreshCcw size={15} />}
            Refresh
          </button>
        </header>

        {/* Status strip */}
        <div className="status-strip">
          {[
            { label: 'Total Patients',    value: data?.totalPatients ?? 0, color: '#6366f1', sub: 'enrolled' },
            { label: 'Consented Families',value: consentedCount,           color: '#10b981', sub: 'can receive updates' },
            { label: 'Sent This Session', value: sentCount,                color: '#a855f7', sub: 'dispatched today' },
          ].map(s => (
            <div key={s.label} className="status-card">
              <span className="status-value" style={{ color: s.color }}>{s.value}</span>
              <span className="status-label">{s.label}</span>
              <span className="status-sub">{s.sub}</span>
            </div>
          ))}
        </div>

        {isFirstLoad ? (
          <CardSkeleton rows={6} />
        ) : (
          <FamilyBroadcast
            patients={data?.patients ?? []}
            sending={sending}
            broadcasting={broadcasting}
            results={results}
            onSend={sendNOK}
            onBroadcastAll={broadcastAll}
          />
        )}
      </div>

      <Toaster toasts={toast.toasts} onDismiss={toast.dismiss} />

      <style>{`
        .page-root{min-height:calc(100vh - 58px);background:#0f1117;padding:2rem 1.5rem;font-family:'Inter',system-ui,sans-serif}
        .page-inner{max-width:1100px;margin:0 auto;display:flex;flex-direction:column;gap:1.5rem}
        .page-header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap}
        .page-title{font-size:1.625rem;font-weight:800;color:#fff;letter-spacing:-.02em}
        .page-sub{font-size:.875rem;color:rgba(255,255,255,.4);margin-top:.25rem}
        .refresh-btn{display:flex;align-items:center;gap:.5rem;padding:.55rem 1rem;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:rgba(255,255,255,.7);font-size:.8125rem;font-weight:600;cursor:pointer;transition:background .2s;flex-shrink:0}
        .refresh-btn:hover{background:rgba(255,255,255,.12)}
        .refresh-btn:disabled{opacity:.5;cursor:not-allowed}
        .spin{animation:spin .8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .status-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:.875rem}
        .status-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:1.25rem 1.375rem;display:flex;flex-direction:column;gap:.25rem;transition:border-color .2s}
        .status-card:hover{border-color:rgba(255,255,255,.12)}
        .status-value{font-size:2.125rem;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
        .status-label{font-size:.75rem;font-weight:700;color:rgba(255,255,255,.6)}
        .status-sub{font-size:.6875rem;color:rgba(255,255,255,.3);margin-top:1px}
      `}</style>
    </div>
  );
}
