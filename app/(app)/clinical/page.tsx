'use client';
import { useState, useCallback } from 'react';
import { TrendingUp, RefreshCcw, Loader2 } from 'lucide-react';
import { useDashboard } from '@/app/hooks/useDashboard';
import { useToast } from '@/app/hooks/useToast';
import { KpiStrip } from '@/app/components/KpiStrip';
import { RiskLeaderboard } from '@/app/components/RiskLeaderboard';
import { AdherenceTrendChart } from '@/app/components/AdherenceTrendChart';
import { PatientList } from '@/app/components/PatientList';
import { Toaster } from '@/app/components/Toaster';
import { KpiSkeleton, CardSkeleton } from '@/app/components/SkeletonLoader';

export default function ClinicalPage() {
  const { data, loading, refresh } = useDashboard(15000);
  const toast = useToast();
  const [scoring, setScoring] = useState(false);

  const runRiskScoring = useCallback(async () => {
    setScoring(true);
    toast.info('Running risk scoring…', 'Analysing all patients. This may take a moment.');
    try {
      const res = await fetch('/api/cron/risk-score', { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Risk scoring complete', 'Leaderboard has been updated.');
      await refresh();
    } catch {
      toast.error('Scoring failed', 'Could not complete risk analysis. Check the server logs.');
    } finally {
      setScoring(false);
    }
  }, [refresh, toast]);

  const isFirstLoad = loading && !data;

  return (
    <div className="page-root">
      <div className="page-inner">
        <header className="page-header">
          <div>
            <h1 className="page-title">Clinical Intelligence</h1>
            <p className="page-sub">Risk stratification, adherence analytics, and full patient roster</p>
          </div>
          <div className="header-actions">
            <button id="trigger-risk-scoring" onClick={runRiskScoring} disabled={scoring || isFirstLoad} className="score-btn">
              {scoring ? <><span className="btn-spinner" />Scoring…</> : <><TrendingUp size={15} />Run Risk Scoring</>}
            </button>
            <button onClick={refresh} disabled={loading} className="refresh-btn" id="clinical-refresh">
              {loading ? <Loader2 size={15} className="spin" /> : <RefreshCcw size={15} />}
            </button>
          </div>
        </header>

        {isFirstLoad ? (
          <>
            <KpiSkeleton count={5} />
            <div className="clinical-grid">
              <div className="clinical-main"><CardSkeleton rows={5} /><CardSkeleton rows={4} /></div>
              <div className="clinical-side"><CardSkeleton rows={4} /></div>
            </div>
          </>
        ) : (
          <>
            <KpiStrip data={data} variant="full" />
            <div className="clinical-grid">
              <div className="clinical-main">
                <AdherenceTrendChart data={data?.trend ?? []} />
                <PatientList patients={data?.patients ?? []} riskLeaderboard={data?.riskLeaderboard} />
              </div>
              <div className="clinical-side">
                <RiskLeaderboard
                  summary={data?.riskSummary ?? { high: 0, medium: 0, low: 0, unscored: 0 }}
                  leaderboard={data?.riskLeaderboard ?? []}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <Toaster toasts={toast.toasts} onDismiss={toast.dismiss} />

      <style>{`
        .page-root{min-height:calc(100vh - 58px);background:#0f1117;padding:2rem 1.5rem;font-family:'Inter',system-ui,sans-serif}
        .page-inner{max-width:1280px;margin:0 auto;display:flex;flex-direction:column;gap:1.5rem}
        .page-header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap}
        .page-title{font-size:1.625rem;font-weight:800;color:#fff;letter-spacing:-.02em}
        .page-sub{font-size:.875rem;color:rgba(255,255,255,.4);margin-top:.25rem}
        .header-actions{display:flex;align-items:center;gap:.625rem;flex-shrink:0}
        .score-btn{display:flex;align-items:center;gap:.5rem;padding:.6rem 1.125rem;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-size:.8125rem;font-weight:700;border:none;border-radius:10px;cursor:pointer;box-shadow:0 4px 16px rgba(99,102,241,.3);transition:opacity .2s;white-space:nowrap}
        .score-btn:disabled{opacity:.5;cursor:not-allowed}
        .refresh-btn{display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:rgba(255,255,255,.6);cursor:pointer;transition:background .2s}
        .refresh-btn:hover{background:rgba(255,255,255,.12)}
        .refresh-btn:disabled{opacity:.5;cursor:not-allowed}
        .spin{animation:spin .8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .btn-spinner{display:inline-block;width:13px;height:13px;border:2px solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite}
        .clinical-grid{display:grid;grid-template-columns:1fr 340px;gap:1.25rem;align-items:start}
        .clinical-main{display:flex;flex-direction:column;gap:1.25rem}
        .clinical-side{display:flex;flex-direction:column;gap:1rem;position:sticky;top:74px}
        @media(max-width:900px){.clinical-grid{grid-template-columns:1fr}.clinical-side{position:static}}
      `}</style>
    </div>
  );
}
