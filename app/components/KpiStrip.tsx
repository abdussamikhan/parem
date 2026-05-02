'use client';
/**
 * app/components/KpiStrip.tsx  — G4: animated count-up numbers
 */
import { useEffect, useState, useRef } from 'react';
import { Users, Activity, CheckCircle, ShieldAlert, AlertTriangle, LucideIcon } from 'lucide-react';
import type { DashboardData } from '@/app/hooks/useDashboard';

// ─── Animated number ──────────────────────────────────────────────────────────
function AnimatedNum({ target }: { target: number }) {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);

  useEffect(() => {
    if (prev.current === target) return;
    const from  = prev.current;
    const diff  = target - from;
    const steps = 24;
    const delay = 600 / steps;
    let step = 0;
    const id = setInterval(() => {
      step++;
      setDisplay(Math.round(from + diff * (step / steps)));
      if (step >= steps) { clearInterval(id); prev.current = target; }
    }, delay);
    return () => clearInterval(id);
  }, [target]);

  return <>{display}</>;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type KpiDef = { label: string; num: number; suffix?: string; Icon: LucideIcon; color: string; bg: string; alert?: boolean };
type Props  = { data: DashboardData | null; variant?: 'full' | 'triage' };

export function KpiStrip({ data, variant = 'full' }: Props) {
  const riskHigh = data?.riskSummary?.high ?? 0;

  const all: KpiDef[] = [
    { label: 'Total Enrolled Patients', num: data?.totalPatients ?? 0,          Icon: Users,         color: '#3b82f6', bg: 'rgba(59,130,246,.12)', alert: false },
    { label: "Today's Adherence Rate",  num: data?.todayStats?.rate ?? 0, suffix: '%', Icon: Activity, color: '#10b981', bg: 'rgba(16,185,129,.12)', alert: false },
    { label: 'Medicines Taken Today',   num: data?.todayStats?.taken ?? 0,       Icon: CheckCircle,   color: '#6366f1', bg: 'rgba(99,102,241,.12)', alert: false },
    { label: 'Active SOS Alerts',       num: data?.activeSOS ?? 0,               Icon: ShieldAlert,   color: '#ef4444', bg: 'rgba(239,68,68,.12)',  alert: (data?.activeSOS ?? 0) > 0 },
    { label: 'High Risk Patients',      num: riskHigh,                           Icon: AlertTriangle, color: '#f97316', bg: 'rgba(249,115,22,.12)', alert: riskHigh > 0 },
  ];

  const kpis = variant === 'triage'
    ? all.filter(k => !["Today's Adherence Rate", 'Medicines Taken Today'].includes(k.label))
    : all;

  return (
    <div className="kpi-strip">
      {kpis.map(({ label, num, suffix, Icon, color, bg, alert }) => (
        <div key={label} className={`kpi-card ${alert ? 'kpi-card-alert' : ''}`}>
          <div className="kpi-card-text">
            <p className="kpi-label">{label}</p>
            <span className="kpi-value" style={{ color: alert ? '#ef4444' : '#fff' }}>
              <AnimatedNum target={num} />{suffix}
            </span>
          </div>
          <div className="kpi-icon" style={{ background: bg }}>
            <Icon size={22} color={alert ? '#ef4444' : color} />
            {alert && <span className="kpi-ping" />}
          </div>
        </div>
      ))}

      <style>{`
        .kpi-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.875rem}
        .kpi-card{position:relative;display:flex;align-items:center;justify-content:space-between;padding:1rem 1.125rem;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:14px;transition:transform .2s,box-shadow .2s;overflow:hidden}
        .kpi-card::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.03),transparent);pointer-events:none}
        .kpi-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.35)}
        .kpi-card-alert{border-color:rgba(239,68,68,.35);background:rgba(239,68,68,.08);box-shadow:0 0 0 1px rgba(239,68,68,.2),0 0 20px rgba(239,68,68,.1)}
        .kpi-card-text{display:flex;flex-direction:column;gap:.25rem}
        .kpi-label{font-size:.6875rem;font-weight:600;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:.04em;line-height:1.2}
        .kpi-value{font-size:1.875rem;font-weight:800;color:#fff;line-height:1;font-variant-numeric:tabular-nums}
        .kpi-icon{position:relative;width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .kpi-ping{position:absolute;top:-3px;right:-3px;width:10px;height:10px;border-radius:50%;background:#ef4444;animation:kpi-ping 1.2s ease-in-out infinite}
        @keyframes kpi-ping{0%{box-shadow:0 0 0 0 rgba(239,68,68,.7)}70%{box-shadow:0 0 0 8px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}
      `}</style>
    </div>
  );
}
