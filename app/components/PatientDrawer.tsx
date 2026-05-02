'use client';

import { useState } from 'react';
import { X, Pill, Calendar, Users, CheckCircle, AlertTriangle, Plus } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Medicine = {
  id: string; medicineName: string; dose: string; frequency: string;
  timingInstruction: string; durationDays: number;
};

type AdherenceLog = {
  id: string; logDate: string; actualResponse: string;
  medicine: { medicineName: string };
};

type Appointment = {
  id: string; title: string; scheduledAt: string;
  attended: boolean; notes?: string;
};

type RiskScore = {
  id: string; score: 'HIGH' | 'MEDIUM' | 'LOW'; rationale: string; calculatedAt: string;
};

type FamilyMember = {
  id: string; name: string; phone: string; relationship?: string; consentGiven: boolean;
};

export type PatientDetail = {
  id: string; firstName: string; lastName: string; age: number; gender: string;
  phone: string; conditionCategory?: string; voicePreferred: boolean;
  familyGroupMode: boolean; adherenceRate7d: number | null;
  takenCount7d: number; missedCount7d: number;
  medicines: Medicine[];
  adherenceLogs: AdherenceLog[];
  appointments: Appointment[];
  riskScores: RiskScore[];
  familyMembers: FamilyMember[];
};

interface Props {
  patientId: string | null;
  onClose: () => void;
}

const RISK_COLOR: Record<string, string> = {
  HIGH:   'bg-red-100 text-red-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW:    'bg-emerald-100 text-emerald-700',
};

const RESPONSE_COLOR: Record<string, string> = {
  TAKEN:        'text-emerald-600',
  SKIPPED:      'text-red-500',
  NO_RESPONSE:  'text-slate-400',
  REMIND_LATER: 'text-amber-500',
};

// ─── Appointment Form ─────────────────────────────────────────────────────────

function AppointmentForm({ patientId, onCreated }: { patientId: string; onCreated: () => void }) {
  const [title, setTitle]   = useState('');
  const [dt, setDt]         = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !dt) return;
    setSaving(true);
    try {
      await fetch(`/api/patients/${patientId}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, scheduledAt: new Date(dt).toISOString() }),
      });
      setTitle(''); setDt('');
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex gap-2 mt-2">
      <input
        value={title} onChange={e => setTitle(e.target.value)}
        placeholder="Appointment title"
        className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
      <input
        type="datetime-local" value={dt} onChange={e => setDt(e.target.value)}
        className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
      <button
        type="submit" disabled={saving || !title || !dt}
        className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? '...' : 'Add'}
      </button>
    </form>
  );
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────

export function PatientDrawer({ patientId, onClose }: Props) {
  const [patient, setPatient]     = useState<PatientDetail | null>(null);
  const [loading, setLoading]     = useState(false);
  const [tab, setTab]             = useState<'overview' | 'appointments' | 'family'>('overview');
  const [addingAppt, setAddingAppt] = useState(false);
  const [prevId, setPrevId]       = useState<string | null>(null);

  // Fetch when patientId changes
  if (patientId !== prevId) {
    setPrevId(patientId);
    if (patientId) {
      setLoading(true);
      setPatient(null);
      setTab('overview');
      fetch(`/api/patients/${patientId}`)
        .then(r => r.json())
        .then(d => setPatient(d))
        .finally(() => setLoading(false));
    }
  }

  if (!patientId) return null;

  const riskScore = patient?.riskScores?.[0] ?? null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50">
          {loading || !patient ? (
            <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
          ) : (
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {patient.firstName} {patient.lastName}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {patient.age}y · {patient.gender}
                {patient.conditionCategory && ` · ${patient.conditionCategory}`}
              </p>
            </div>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-4 pt-2 shrink-0">
          {(['overview', 'appointments', 'family'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-semibold capitalize transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {loading && (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && patient && tab === 'overview' && (
            <>
              {/* Risk + Adherence summary row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">7-Day Adherence</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {patient.adherenceRate7d !== null ? `${patient.adherenceRate7d}%` : '—'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {patient.takenCount7d} taken · {patient.missedCount7d} missed
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">Risk Level</p>
                  {riskScore ? (
                    <>
                      <span className={`inline-block text-sm font-bold px-2.5 py-0.5 rounded-full ${RISK_COLOR[riskScore.score]}`}>
                        {riskScore.score}
                      </span>
                      <p className="text-xs text-slate-400 mt-1.5 leading-snug line-clamp-2">{riskScore.rationale}</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400 mt-1">Not yet scored</p>
                  )}
                </div>
              </div>

              {/* Badges */}
              <div className="flex gap-2 flex-wrap">
                {patient.voicePreferred && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full font-medium">🎤 Voice Preferred</span>
                )}
                {patient.familyGroupMode && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">👪 Group Mode</span>
                )}
              </div>

              {/* Medicines */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Pill size={12} /> Prescriptions ({patient.medicines.length})
                </h3>
                <div className="space-y-2">
                  {patient.medicines.map(m => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                        <Pill size={14} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{m.medicineName}</p>
                        <p className="text-xs text-slate-500">{m.dose} · {m.frequency}</p>
                      </div>
                      <span className="text-xs bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full shrink-0">
                        {m.durationDays}d
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Adherence Logs */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <CheckCircle size={12} /> Recent Adherence
                </h3>
                {patient.adherenceLogs.length === 0 ? (
                  <p className="text-sm text-slate-400">No logs in the last 7 days.</p>
                ) : (
                  <div className="space-y-1.5">
                    {patient.adherenceLogs.slice(0, 8).map(log => (
                      <div key={log.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg hover:bg-slate-50">
                        <span className="text-slate-700 font-medium truncate">{log.medicine.medicineName}</span>
                        <span className="text-slate-400 mx-2 shrink-0">
                          {new Date(log.logDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </span>
                        <span className={`font-semibold shrink-0 ${RESPONSE_COLOR[log.actualResponse] ?? 'text-slate-500'}`}>
                          {log.actualResponse}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {!loading && patient && tab === 'appointments' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={12} /> Upcoming Appointments
                </h3>
                <button
                  onClick={() => setAddingAppt(a => !a)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <Plus size={12} /> Add
                </button>
              </div>

              {addingAppt && (
                <AppointmentForm
                  patientId={patient.id}
                  onCreated={() => {
                    setAddingAppt(false);
                    // Re-fetch patient
                    fetch(`/api/patients/${patient.id}`).then(r => r.json()).then(setPatient);
                  }}
                />
              )}

              <div className="space-y-2 mt-3">
                {patient.appointments.length === 0 ? (
                  <p className="text-sm text-slate-400">No upcoming appointments.</p>
                ) : (
                  patient.appointments.map(appt => (
                    <div key={appt.id} className={`p-3 rounded-xl border ${appt.attended ? 'border-emerald-100 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{appt.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {new Date(appt.scheduledAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {appt.notes && <p className="text-xs text-slate-400 mt-1">{appt.notes}</p>}
                        </div>
                        {appt.attended && <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {!loading && patient && tab === 'family' && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Users size={12} /> Family Members
              </h3>
              {patient.familyMembers.length === 0 ? (
                <p className="text-sm text-slate-400">No family members registered.</p>
              ) : (
                <div className="space-y-2">
                  {patient.familyMembers.map(fm => (
                    <div key={fm.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {fm.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{fm.name}</p>
                        <p className="text-xs text-slate-500">{fm.relationship ?? 'Family'} · {fm.phone}</p>
                      </div>
                      {fm.consentGiven && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full shrink-0">Consent ✓</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Legacy NOK field shown if no FamilyMember records */}
              {patient.familyMembers.length === 0 && (
                <div className="mt-3 p-3 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 text-center">
                  Use the Family Members API to register contacts with consent.
                </div>
              )}
            </div>
          )}

          {!loading && patient && riskScore && tab === 'overview' && (
            <div className="p-3 rounded-xl border border-orange-100 bg-orange-50 flex items-start gap-2">
              <AlertTriangle size={14} className="text-orange-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-orange-800">Risk Assessment</p>
                <p className="text-xs text-orange-700 mt-0.5">{riskScore.rationale}</p>
                <p className="text-xs text-orange-400 mt-1">
                  Scored {new Date(riskScore.calculatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
