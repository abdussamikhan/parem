'use client';
import { useState, useCallback } from 'react';
import { RefreshCcw, Loader2 } from 'lucide-react';
import { useDashboard } from '@/app/hooks/useDashboard';
import { useToast } from '@/app/hooks/useToast';
import { KpiStrip } from '@/app/components/KpiStrip';
import { SosEscalations } from '@/app/components/SosEscalations';
import { Toaster } from '@/app/components/Toaster';
import { KpiSkeleton, CardSkeleton } from '@/app/components/SkeletonLoader';

export default function TriagePage() {
  const { data, loading, refresh } = useDashboard(8000);
  const toast = useToast();
  const [acknowledging, setAcknowledging] = useState<Record<string, boolean>>({});

  const acknowledgeAlert = useCallback(async (id: string) => {
    setAcknowledging(p => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`/api/alerts/sos/${id}`, { method: 'PATCH' });
      if (!res.ok) throw new Error();
      toast.success('Alert resolved', 'SOS escalation has been acknowledged and cleared.');
      await refresh();
    } catch {
      toast.error('Failed to resolve', 'Please try again or contact support.');
    } finally {
      setAcknowledging(p => ({ ...p, [id]: false }));
    }
  }, [refresh, toast]);

  const highRisk = data?.riskLeaderboard?.filter(r => r.level === 'HIGH') ?? [];

  return (
    <div className="page-root">
      <div className="page-inner">
        <header className="page-header">
          <div>
            <h1 className="page-title">Emergency Triage</h1>
            <p className="page-sub">Real-time SOS escalations and critical patient alerts</p>
          </div>
          <button onClick={refresh} disabled={loading} className="refresh-btn" id="triage-refresh">
            {loading ? <Loader2 size={15} className="spin" /> : <RefreshCcw size={15} />}
            Refresh
          </button>
        </header>

        {loading && !data ? (
          <>
            <KpiSkeleton count={3} />
            <CardSkeleton rows={3} />
          </>
        ) : (
          <>
            <KpiStrip data={data} variant="triage" />
            <SosEscalations
              alerts={data?.recentSOS ?? []}
              acknowledging={acknowledging}
              onAcknowledge={acknowledgeAlert}
            />
            {highRisk.length > 0 && (
              <div className="hrl-panel">
                <h3 className="hrl-title">⚠️ High-Risk Patients — Immediate Attention Required</h3>
                <div className="hrl-list">
                  {highRisk.map(r => (
                    <div key={r.patientId} className="hrl-row">
                      <div className="hrl-avatar">{r.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
                      <div className="hrl-info">
                        <p className="hrl-name">{r.name}</p>
                        <p className="hrl-rationale">{r.rationale}</p>
                      </div>
                      <span className="hrl-badge">HIGH</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Toaster toasts={toast.toasts} onDismiss={toast.dismiss} />

      <style>{`
        .page-root{min-height:calc(100vh - 58px);background:#0f1117;padding:2rem 1.5rem;font-family:'Inter',system-ui,sans-serif}
        .page-inner{max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:1.5rem}
        .page-header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap}
        .page-title{font-size:1.625rem;font-weight:800;color:#fff;letter-spacing:-.02em}
        .page-sub{font-size:.875rem;color:rgba(255,255,255,.4);margin-top:.25rem}
        .refresh-btn{display:flex;align-items:center;gap:.5rem;padding:.55rem 1rem;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:rgba(255,255,255,.7);font-size:.8125rem;font-weight:600;cursor:pointer;transition:background .2s;flex-shrink:0}
        .refresh-btn:hover{background:rgba(255,255,255,.12)}
        .refresh-btn:disabled{opacity:.5;cursor:not-allowed}
        .spin{animation:spin .8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .hrl-panel{background:rgba(249,115,22,.06);border:1px solid rgba(249,115,22,.2);border-radius:18px;padding:1.5rem}
        .hrl-title{font-size:.9375rem;font-weight:700;color:#fff;margin-bottom:1rem}
        .hrl-list{display:flex;flex-direction:column;gap:.5rem}
        .hrl-row{display:flex;align-items:center;gap:.75rem;padding:.625rem .75rem;border-radius:10px;background:rgba(249,115,22,.05)}
        .hrl-avatar{width:34px;height:34px;border-radius:9px;background:rgba(249,115,22,.2);color:#fdba74;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;flex-shrink:0}
        .hrl-info{flex:1;min-width:0}
        .hrl-name{font-size:.875rem;font-weight:600;color:#fff}
        .hrl-rationale{font-size:.6875rem;color:rgba(255,255,255,.4);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .hrl-badge{font-size:.625rem;font-weight:800;padding:.2rem .5rem;border-radius:999px;background:rgba(239,68,68,.2);color:#fca5a5;letter-spacing:.05em;flex-shrink:0}
      `}</style>
    </div>
  );
}
