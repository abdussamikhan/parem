'use client';
/**
 * app/components/PatientList.tsx — G4: risk + consent filter bar
 */
import { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import type { Patient, RiskEntry } from '@/app/hooks/useDashboard';
import { PatientDrawer } from './PatientDrawer';

type FilterRisk    = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';
type FilterConsent = 'ALL' | 'CONSENTED' | 'PENDING';
type Props = { patients: Patient[]; riskLeaderboard?: RiskEntry[] };

const riskColors: Record<string, { bg: string; color: string }> = {
  HIGH:   { bg: 'rgba(239,68,68,.15)',   color: '#fca5a5' },
  MEDIUM: { bg: 'rgba(245,158,11,.15)',  color: '#fcd34d' },
  LOW:    { bg: 'rgba(16,185,129,.15)',  color: '#6ee7b7' },
};

export function PatientList({ patients, riskLeaderboard = [] }: Props) {
  const [query,      setQuery]      = useState('');
  const [filterRisk,    setFilterRisk]    = useState<FilterRisk>('ALL');
  const [filterConsent, setFilterConsent] = useState<FilterConsent>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Build risk lookup
  const riskMap = Object.fromEntries(riskLeaderboard.map(r => [r.patientId, r.level]));

  const filtered = patients.filter(p => {
    const matchText = `${p.firstName} ${p.lastName} ${p.conditionCategory ?? ''}`.toLowerCase().includes(query.toLowerCase());
    const pRisk     = riskMap[p.id];
    const matchRisk = filterRisk === 'ALL' || pRisk === filterRisk;
    const matchConsent = filterConsent === 'ALL'
      || (filterConsent === 'CONSENTED' && p.consentGiven)
      || (filterConsent === 'PENDING'   && !p.consentGiven);
    return matchText && matchRisk && matchConsent;
  });

  const activeFilters = (filterRisk !== 'ALL' ? 1 : 0) + (filterConsent !== 'ALL' ? 1 : 0);

  return (
    <>
      <div className="pl-panel">
        <div className="pl-header">
          <h3 className="pl-title">Enrolled Patients</h3>
          <div className="pl-header-right">
            <span className="pl-count">{filtered.length} / {patients.length}</span>
            <button className={`pl-filter-toggle ${showFilters ? 'pl-filter-active' : ''}`}
              onClick={() => setShowFilters(v => !v)}>
              <SlidersHorizontal size={13} />
              Filters
              {activeFilters > 0 && <span className="pl-filter-badge">{activeFilters}</span>}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="pl-search-wrap">
          <Search size={14} className="pl-search-icon" />
          <input id="patient-search" type="text" placeholder="Search by name or condition…"
            value={query} onChange={e => setQuery(e.target.value)} className="pl-search" />
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="pl-filter-panel">
            <div className="pl-filter-group">
              <span className="pl-filter-label">Risk Level</span>
              <div className="pl-chip-row">
                {(['ALL','HIGH','MEDIUM','LOW'] as FilterRisk[]).map(r => (
                  <button key={r} className={`pl-chip ${filterRisk === r ? 'pl-chip-active' : ''}`}
                    onClick={() => setFilterRisk(r)}
                    style={filterRisk === r && r !== 'ALL' ? { background: riskColors[r]?.bg, color: riskColors[r]?.color, borderColor: riskColors[r]?.color + '66' } : {}}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="pl-filter-group">
              <span className="pl-filter-label">Consent</span>
              <div className="pl-chip-row">
                {(['ALL','CONSENTED','PENDING'] as FilterConsent[]).map(c => (
                  <button key={c} className={`pl-chip ${filterConsent === c ? 'pl-chip-active' : ''}`}
                    onClick={() => setFilterConsent(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            {activeFilters > 0 && (
              <button className="pl-clear-filters" onClick={() => { setFilterRisk('ALL'); setFilterConsent('ALL'); }}>
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Patient list */}
        <div className="pl-list">
          {filtered.length === 0
            ? <p className="pl-empty">No patients match your filters.</p>
            : filtered.map(p => {
              const pRisk = riskMap[p.id] as 'HIGH'|'MEDIUM'|'LOW'|undefined;
              return (
                <div key={p.id} id={`patient-row-${p.id}`} onClick={() => setSelectedId(p.id)} className="pl-row">
                  <div className="pl-avatar">{p.firstName[0]}{p.lastName[0]}</div>
                  <div className="pl-info">
                    <p className="pl-name">{p.firstName} {p.lastName}</p>
                    <p className="pl-meta">{p.conditionCategory ?? 'General'} · {p.medicines?.length ?? 0} Rx</p>
                  </div>
                  <div className="pl-badges">
                    {pRisk && (
                      <span className="pl-risk-badge" style={{ background: riskColors[pRisk]?.bg, color: riskColors[pRisk]?.color }}>
                        {pRisk}
                      </span>
                    )}
                    <span className={`consent-badge ${p.consentGiven ? 'consent-yes' : 'consent-no'}`}>
                      {p.consentGiven ? 'Consented' : 'Pending'}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <PatientDrawer patientId={selectedId} onClose={() => setSelectedId(null)} />

      <style>{`
        .pl-panel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:1.5rem;display:flex;flex-direction:column;gap:1rem}
        .pl-header{display:flex;align-items:center;justify-content:space-between}
        .pl-title{font-size:1rem;font-weight:700;color:#fff}
        .pl-header-right{display:flex;align-items:center;gap:.625rem}
        .pl-count{font-size:.75rem;color:rgba(255,255,255,.4);font-weight:500}
        .pl-filter-toggle{display:flex;align-items:center;gap:.375rem;padding:.375rem .75rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:rgba(255,255,255,.6);font-size:.75rem;font-weight:600;cursor:pointer;transition:background .2s;position:relative}
        .pl-filter-toggle:hover{background:rgba(255,255,255,.1)}
        .pl-filter-active{border-color:rgba(99,102,241,.4);background:rgba(99,102,241,.1);color:#a5b4fc}
        .pl-filter-badge{width:16px;height:16px;border-radius:50%;background:#6366f1;color:#fff;font-size:.5625rem;font-weight:800;display:flex;align-items:center;justify-content:center}
        .pl-filter-panel{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:1rem;display:flex;flex-direction:column;gap:.875rem}
        .pl-filter-group{display:flex;flex-direction:column;gap:.5rem}
        .pl-filter-label{font-size:.6875rem;font-weight:600;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.04em}
        .pl-chip-row{display:flex;flex-wrap:wrap;gap:.375rem}
        .pl-chip{padding:.3rem .75rem;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:999px;color:rgba(255,255,255,.5);font-size:.75rem;font-weight:600;cursor:pointer;transition:all .15s}
        .pl-chip:hover{background:rgba(255,255,255,.09);color:rgba(255,255,255,.8)}
        .pl-chip-active{background:rgba(99,102,241,.15);border-color:rgba(99,102,241,.35);color:#a5b4fc}
        .pl-clear-filters{align-self:flex-start;padding:.3rem .75rem;background:none;border:none;color:rgba(255,255,255,.3);font-size:.75rem;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
        .pl-search-wrap{position:relative}
        .pl-search-icon{position:absolute;left:.875rem;top:50%;transform:translateY(-50%);color:rgba(255,255,255,.3)}
        .pl-search{width:100%;padding:.625rem .875rem .625rem 2.375rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;font-size:.875rem;outline:none;box-sizing:border-box;transition:border-color .2s}
        .pl-search::placeholder{color:rgba(255,255,255,.25)}
        .pl-search:focus{border-color:rgba(99,102,241,.5);background:rgba(255,255,255,.08)}
        .pl-list{display:flex;flex-direction:column;gap:.375rem;max-height:400px;overflow-y:auto}
        .pl-list::-webkit-scrollbar{width:4px}
        .pl-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}
        .pl-row{display:flex;align-items:center;gap:.75rem;padding:.75rem .875rem;border-radius:12px;cursor:pointer;border:1px solid transparent;transition:background .2s,border-color .2s}
        .pl-row:hover{background:rgba(99,102,241,.08);border-color:rgba(99,102,241,.2)}
        .pl-avatar{width:36px;height:36px;border-radius:10px;background:rgba(99,102,241,.2);color:#a5b4fc;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;flex-shrink:0}
        .pl-info{flex:1;min-width:0}
        .pl-name{font-size:.875rem;font-weight:600;color:#fff}
        .pl-meta{font-size:.6875rem;color:rgba(255,255,255,.4);margin-top:2px}
        .pl-badges{display:flex;align-items:center;gap:.375rem;flex-shrink:0}
        .pl-risk-badge{font-size:.5625rem;font-weight:800;padding:.175rem .45rem;border-radius:999px;letter-spacing:.05em}
        .consent-badge{font-size:.5625rem;font-weight:700;padding:.2rem .5rem;border-radius:999px;letter-spacing:.04em;text-transform:uppercase}
        .consent-yes{background:rgba(16,185,129,.12);color:#6ee7b7}
        .consent-no{background:rgba(245,158,11,.12);color:#fcd34d}
        .pl-empty{text-align:center;color:rgba(255,255,255,.3);font-size:.8125rem;padding:2rem}
      `}</style>
    </>
  );
}
