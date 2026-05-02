'use client';

import { useEffect, useState } from 'react';
import {
  ShieldAlert, Users, Activity, CheckCircle,
  RefreshCcw, Bell, TrendingUp, AlertTriangle, Send,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { PatientDrawer } from './components/PatientDrawer';

// ─── Types ────────────────────────────────────────────────────────────────────

type Patient = { id: string; firstName: string; lastName: string; phone: string };

type SOSAlert = {
  id: string;
  patient: Patient;
  patientMessage: string;
  alertSentAt?: string;
};

type RiskEntry = {
  patientId:    string;
  name:         string;
  level:        'HIGH' | 'MEDIUM' | 'LOW';
  rationale:    string;
  calculatedAt: string;
};

type NOKPatient = {
  id:              string;
  firstName:       string;
  lastName:        string;
  nextOfKinName?:  string;
  familyGroupMode: boolean;
  medicines:       Array<{ medicineName?: string }>;
};

type RiskSummary = {
  high: number; medium: number; low: number; unscored: number;
};

// ─── Risk helpers ─────────────────────────────────────────────────────────────

const RISK_CONFIG = {
  HIGH:   { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'HIGH',   ring: 'ring-red-200'    },
  MEDIUM: { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500',  label: 'MED',    ring: 'ring-amber-200'  },
  LOW:    { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'LOW', ring: 'ring-emerald-200' },
} as const;

function RiskBadge({ level }: { level: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const cfg = RISK_CONFIG[level];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData]                   = useState<any>(null);
  const [loading, setLoading]             = useState(true);
  const [acknowledging, setAcknowledging] = useState<Record<string, boolean>>({});
  const [scoringAll, setScoringAll]         = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [chartData, setChartData]           = useState<Array<{name:string;rate:number;taken:number;missed:number}>>([]);
  const [nokSending, setNokSending]          = useState<Record<string, boolean>>({});
  const [nokBroadcasting, setNokBroadcasting]= useState(false);
  const [nokResults, setNokResults]          = useState<Record<string, { sent: number; text: string }>>({});

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [dashRes, trendRes] = await Promise.all([
        fetch('/api/dashboard', { cache: 'no-store' }),
        fetch('/api/dashboard/adherence-trend', { cache: 'no-store' }),
      ]);
      const [dash, trend] = await Promise.all([dashRes.json(), trendRes.json()]);
      setData(dash);
      if (trend?.trend) setChartData(trend.trend.map((d: { name: string; rate: number; taken: number; missed: number }) => ({ name: d.name, rate: d.rate, taken: d.taken, missed: d.missed })));
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────

  const acknowledgeAlert = async (id: string) => {
    setAcknowledging(p => ({ ...p, [id]: true }));
    try {
      await fetch(`/api/alerts/sos/${id}`, { method: 'PATCH' });
      await fetchDashboardData();
    } catch (err) {
      console.error('Acknowledge failed:', err);
    } finally {
      setAcknowledging(p => ({ ...p, [id]: false }));
    }
  };

  const triggerRiskScoring = async () => {
    setScoringAll(true);
    try {
      await fetch('/api/cron/risk-score', { method: 'POST' });
      await fetchDashboardData();
    } catch (err) {
      console.error('Risk scoring failed:', err);
    } finally {
      setScoringAll(false);
    }
  };

  const sendNOKSummary = async (patientId: string) => {
    setNokSending(p => ({ ...p, [patientId]: true }));
    try {
      const res = await fetch(`/api/patients/${patientId}/nok-summary`, { method: 'POST' });
      const json = await res.json();
      setNokResults(p => ({ ...p, [patientId]: { sent: json.sent ?? 0, text: json.summaryText ?? '' } }));
    } catch (err) {
      console.error('NOK send failed:', err);
    } finally {
      setNokSending(p => ({ ...p, [patientId]: false }));
    }
  };

  const broadcastAllNOK = async () => {
    setNokBroadcasting(true);
    try {
      await fetch('/api/cron/nok-summary', { method: 'POST' });
    } catch (err) {
      console.error('NOK broadcast failed:', err);
    } finally {
      setNokBroadcasting(false);
    }
  };

  // ── Loading screen ───────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <RefreshCcw size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────

  const riskSummary: RiskSummary = data?.riskSummary ?? { high: 0, medium: 0, low: 0, unscored: 0 };
  const riskLeaderboard: RiskEntry[] = data?.riskLeaderboard ?? [];

  const kpis = [
    { label: 'Total Enrolled Patients',  value: data?.totalPatients ?? 0,             icon: Users,        color: 'text-blue-600',    bg: 'bg-blue-100',    alert: false },
    { label: "Today's Adherence Rate",   value: `${data?.todayStats?.rate ?? 0}%`,    icon: Activity,     color: 'text-emerald-600', bg: 'bg-emerald-100', alert: false },
    { label: 'Medicines Taken Today',    value: data?.todayStats?.taken ?? 0,         icon: CheckCircle,  color: 'text-indigo-600',  bg: 'bg-indigo-100',  alert: false },
    { label: 'Active SOS Alerts',        value: data?.activeSOS ?? 0,                 icon: ShieldAlert,  color: 'text-red-600',     bg: 'bg-red-100',     alert: (data?.activeSOS ?? 0) > 0 },
    { label: 'High Risk Patients',       value: riskSummary.high,                     icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-100',  alert: riskSummary.high > 0 },
  ];


  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Care Command Center</h1>
            <p className="text-slate-500 mt-1">Real-time patient monitoring and automated intervention</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={triggerRiskScoring}
              disabled={scoringAll}
              id="trigger-risk-scoring"
              className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <TrendingUp size={16} className={scoringAll ? 'animate-pulse' : ''} />
              <span>{scoringAll ? 'Scoring...' : 'Run Risk Scoring'}</span>
            </button>
            <button
              onClick={fetchDashboardData}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-md cursor-pointer hover:bg-blue-700 transition-colors">
              <Bell size={18} />
            </div>
          </div>
        </header>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {kpis.map((kpi, idx) => (
            <div
              key={idx}
              className={`p-5 rounded-2xl bg-white shadow-sm border transition-all hover:shadow-md
                ${kpi.alert ? 'border-red-300 ring-4 ring-red-50' : 'border-slate-100'}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1 leading-tight">{kpi.label}</p>
                  <h3 className={`text-3xl font-bold ${kpi.alert ? 'text-red-600' : 'text-slate-900'}`}>{kpi.value}</h3>
                </div>
                <div className={`p-2.5 rounded-xl ${kpi.bg}`}>
                  <kpi.icon className={kpi.color} size={22} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main grid: Alerts + Chart + Risk panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left: SOS + Chart */}
          <div className="lg:col-span-2 space-y-8">

            {/* SOS Escalations */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="text-red-500" size={20} />
                  Active SOS Escalations
                </h2>
                <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                  {data?.recentSOS?.length ?? 0} Critical
                </span>
              </div>

              {data?.recentSOS?.length > 0 ? (
                <div className="space-y-4">
                  {data.recentSOS.map((sos: SOSAlert) => (
                    <div key={sos.id} className="p-4 rounded-xl border border-red-100 bg-red-50/50 hover:bg-red-50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-red-900">{sos.patient.firstName} {sos.patient.lastName}</h4>
                        <span className="text-xs text-red-500 font-medium">
                          {sos.alertSentAt ? new Date(sos.alertSentAt).toLocaleTimeString() : 'Recent'}
                        </span>
                      </div>
                      <p className="text-sm text-red-800 bg-white/60 p-3 rounded-lg border border-red-100">{sos.patientMessage}</p>
                      <div className="mt-3 flex justify-end">
                        <button
                          id={`acknowledge-sos-${sos.id}`}
                          disabled={acknowledging[sos.id]}
                          onClick={() => acknowledgeAlert(sos.id)}
                          className="px-4 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {acknowledging[sos.id] ? 'Resolving...' : 'Acknowledge'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <ShieldAlert size={48} className="mb-4 opacity-20" />
                  <p>No active emergency escalations.</p>
                </div>
              )}
            </div>

            {/* Adherence Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-80 flex flex-col">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Weekly Adherence Trend</h2>
              <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} domain={[0, 100]} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{ stroke: '#e2e8f0', strokeWidth: 2 }} />
                    <Line type="monotone" dataKey="rate" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right: Risk Leaderboard + Patient List */}
          <div className="space-y-6">

            {/* Risk summary pills */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="text-orange-500" size={18} />
                  Risk Overview
                </h2>
                {riskSummary.unscored > 0 && (
                  <span className="text-xs text-slate-400">{riskSummary.unscored} unscored</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {([
                  { label: 'High',   count: riskSummary.high,   bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200'    },
                  { label: 'Medium', count: riskSummary.medium, bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200'  },
                  { label: 'Low',    count: riskSummary.low,    bg: 'bg-emerald-50', text: 'text-emerald-700',border: 'border-emerald-200' },
                ] as const).map(r => (
                  <div key={r.label} className={`${r.bg} border ${r.border} rounded-xl p-3`}>
                    <div className={`text-2xl font-bold ${r.text}`}>{r.count}</div>
                    <div className={`text-xs font-medium ${r.text} opacity-80`}>{r.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Leaderboard */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-900">Risk Leaderboard</h2>
                <span className="text-xs text-slate-400">Newest score</span>
              </div>

              {riskLeaderboard.length > 0 ? (
                <div className="space-y-3">
                  {riskLeaderboard.map((entry, idx) => (
                    <div
                      key={entry.patientId}
                      id={`risk-entry-${entry.patientId}`}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
                    >
                      <span className="text-xs text-slate-400 w-4 shrink-0 font-medium">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{entry.name}</div>
                        <div className="text-xs text-slate-400 truncate mt-0.5">{entry.rationale}</div>
                      </div>
                      <RiskBadge level={entry.level} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2 opacity-20"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                  <p className="text-sm">No scores yet.<br />Click &quot;Run Risk Scoring&quot; to start.</p>
                </div>
              )}
            </div>

            {/* Patient List */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-900">Enrolled Patients</h2>
                <button className="text-blue-600 text-xs font-medium hover:underline">View All</button>
              </div>
              <div className="space-y-3">
                {data?.patients?.map((patient: { id: string; firstName: string; lastName: string; medicines?: unknown[] }) => (
                  <div
                    key={patient.id}
                    onClick={() => setSelectedPatientId(patient.id)}
                    className="flex items-center p-2.5 rounded-xl hover:bg-blue-50 hover:border-blue-100 transition-colors cursor-pointer group border border-transparent"
                  >
                    <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shadow-inner shrink-0">
                      {patient.firstName[0]}{patient.lastName[0]}
                    </div>
                    <div className="ml-3 flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 truncate">{patient.firstName} {patient.lastName}</h4>
                      <p className="text-xs text-slate-500">{patient.medicines?.length ?? 0} prescriptions</p>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-blue-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
        {/* ── Family Broadcast Panel (Sprint D) ─────────────────────────────── */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Send className="text-blue-500" size={20} />
                Family Broadcast
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">Send weekly health updates to family contacts</p>
            </div>
            <button
              id="broadcast-all-nok"
              onClick={broadcastAllNOK}
              disabled={nokBroadcasting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={14} className={nokBroadcasting ? 'animate-pulse' : ''} />
              {nokBroadcasting ? 'Broadcasting...' : 'Broadcast All'}
            </button>
          </div>

          {data?.patients?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(data.patients as NOKPatient[]).map((patient) => {
                const result  = nokResults[patient.id];
                const sending = nokSending[patient.id] ?? false;
                return (
                  <div
                    key={patient.id}
                    id={`nok-card-${patient.id}`}
                    className="flex flex-col gap-3 p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all"
                  >
                    {/* Patient info */}
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                        {patient.firstName[0]}{patient.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {patient.firstName} {patient.lastName}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {patient.nextOfKinName
                            ? `NOK: ${patient.nextOfKinName}`
                            : patient.familyGroupMode
                              ? '👪 Group mode'
                              : 'No family contact'}
                        </p>
                      </div>
                      {patient.familyGroupMode && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium shrink-0">Group</span>
                      )}
                    </div>

                    {/* Summary preview (shown after send) */}
                    {result?.text && (
                      <p className="text-xs text-slate-600 bg-slate-100 p-2.5 rounded-lg leading-relaxed line-clamp-3">
                        {result.text}
                      </p>
                    )}

                    {/* Action row */}
                    <div className="flex items-center justify-between mt-auto">
                      {result ? (
                        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle size={12} />
                          Sent to {result.sent} recipient{result.sent !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Not yet sent</span>
                      )}
                      <button
                        id={`send-nok-${patient.id}`}
                        disabled={sending}
                        onClick={() => sendNOKSummary(patient.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send size={11} className={sending ? 'animate-pulse' : ''} />
                        {sending ? 'Sending...' : result ? 'Resend' : 'Send Update'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Users size={40} className="mb-2 opacity-20" />
              <p className="text-sm">No patients with family contacts enrolled yet.</p>
            </div>
          )}
        </div>

      </div>
    </div>

    {/* Patient Detail Drawer (Sprint E) */}
    <PatientDrawer
      patientId={selectedPatientId}
      onClose={() => setSelectedPatientId(null)}
    />
    </>
  );
}
