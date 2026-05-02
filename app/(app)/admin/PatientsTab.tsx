'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronRight } from 'lucide-react';

type ToastApi = { success:(t:string,d?:string)=>void; error:(t:string,d?:string)=>void; info:(t:string,d?:string)=>void };
type Mode = 'patients'|'family'|'medicines';
type Patient = { id:string; mrn:string|null; firstName:string; lastName:string; age:number; gender:string; phone:string; conditionCategory:string|null; consentGiven:boolean; _count?:{medicines:number;familyMembers:number}; riskScores?:{score:string}[] };
type FamilyMember = { id:string; name:string; phone:string; relationship:string|null; consentGiven:boolean };
type Medicine = { id:string; medicineName:string; dose:string; frequency:string; timingInstruction:string; durationDays:number; startDate:string };

const TIMING = ['UPON_WAKING','MORNING_EMPTY_STOMACH','BEFORE_BREAKFAST','AFTER_BREAKFAST','WITH_LUNCH','BEFORE_LUNCH','AFTER_LUNCH','BEFORE_DINNER','AFTER_DINNER','BEFORE_BED'];
const emptyPatient = () => ({ mrn:'',firstName:'',lastName:'',age:'',gender:'Male',phone:'',conditionCategory:'',nextOfKinName:'',nextOfKinPhone:'',consentGiven:false });
const emptyFamily  = () => ({ name:'',phone:'',relationship:'',consentGiven:false });
const emptyMed     = () => ({ medicineName:'',dose:'',frequency:'Once daily',timingInstruction:'AFTER_BREAKFAST',durationDays:'30',startDate:'' });

export function PatientsTab({ toast, mode='patients' }: { toast:ToastApi; mode?:Mode }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string|null>(null);
  const [sub, setSub]           = useState<Record<string,(FamilyMember|Medicine)[]>>({});
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget]     = useState<string|null>(null);
  const [editSubTarget, setEditSubTarget] = useState<string|null>(null);
  const [form, setForm]     = useState<Record<string,string|boolean>>(emptyPatient());
  const [subForm, setSubForm] = useState<Record<string,string|boolean>>({});
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<string|null>(null);

  const loadPatients = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/patients');
    if (r.ok) setPatients(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadPatients(); }, [loadPatients]);

  const loadSub = useCallback(async (pid:string) => {
    const url = mode === 'family'
      ? `/api/admin/patients/${pid}/family`
      : `/api/admin/patients/${pid}/medicines`;
    const r = await fetch(url);
    if (r.ok) { const data = await r.json(); setSub(prev => ({...prev, [pid]: data})); }
  }, [mode]);

  const toggle = useCallback((pid:string) => {
    if (expanded === pid) { setExpanded(null); return; }
    setExpanded(pid);
    if (mode !== 'patients') loadSub(pid);
  }, [expanded, mode, loadSub]);

  const savePatient = async () => {
    setSaving(true);
    const url    = editTarget ? `/api/admin/patients/${editTarget}` : '/api/admin/patients';
    const method = editTarget ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) });
    if (r.ok) { toast.success(editTarget ? 'Patient updated' : 'Patient created'); setShowForm(false); setEditTarget(null); setForm(emptyPatient()); loadPatients(); }
    else { const e = await r.json(); toast.error('Save failed', e.error); }
    setSaving(false);
  };

  const deletePatient = async (id:string) => {
    if (!confirm('Delete this patient and ALL their data? This cannot be undone.')) return;
    setDeleting(id);
    const r = await fetch(`/api/admin/patients/${id}`, { method:'DELETE' });
    if (r.ok) { toast.success('Patient deleted'); loadPatients(); }
    else toast.error('Delete failed');
    setDeleting(null);
  };

  const saveSub = async (pid:string) => {
    setSaving(true);
    const isFamily = mode === 'family';
    const url = editSubTarget
      ? (isFamily ? `/api/admin/patients/${pid}/family/${editSubTarget}` : `/api/admin/patients/${pid}/medicines/${editSubTarget}`)
      : (isFamily ? `/api/admin/patients/${pid}/family` : `/api/admin/patients/${pid}/medicines`);
    const method = editSubTarget ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(subForm) });
    if (r.ok) { toast.success(editSubTarget ? 'Updated' : 'Created'); setEditSubTarget(null); setSubForm({}); loadSub(pid); }
    else { const e = await r.json(); toast.error('Save failed', e.error); }
    setSaving(false);
  };

  const deleteSub = async (pid:string, sid:string) => {
    if (!confirm('Delete this record?')) return;
    const isFamily = mode === 'family';
    const url = isFamily ? `/api/admin/patients/${pid}/family/${sid}` : `/api/admin/patients/${pid}/medicines/${sid}`;
    const r = await fetch(url, { method:'DELETE' });
    if (r.ok) { toast.success('Deleted'); loadSub(pid); }
    else toast.error('Delete failed');
  };

  const startEditPatient = (p:Patient) => { setEditTarget(p.id); setForm({ mrn:p.mrn??'', firstName:p.firstName, lastName:p.lastName, age:String(p.age), gender:p.gender, phone:p.phone, conditionCategory:p.conditionCategory??'', consentGiven:p.consentGiven }); setShowForm(true); };
  const startAddSub  = (isFamily:boolean) => { setEditSubTarget(null); setSubForm(isFamily ? emptyFamily() : emptyMed()); };
  const startEditSub = (item:FamilyMember|Medicine, isFamily:boolean) => {
    setEditSubTarget(item.id);
    if (isFamily) { const f = item as FamilyMember; setSubForm({ name:f.name, phone:f.phone, relationship:f.relationship??'', consentGiven:f.consentGiven }); }
    else { const m = item as Medicine; setSubForm({ medicineName:m.medicineName, dose:m.dose, frequency:m.frequency, timingInstruction:m.timingInstruction, durationDays:String(m.durationDays), startDate:m.startDate.slice(0,10) }); }
  };

  const isFamily = mode === 'family';
  const isMed    = mode === 'medicines';

  return (
    <div>
      <div className="at-bar">
        <span className="at-count">{patients.length} patients</span>
        {mode === 'patients' && (
          <button className="at-btn-add" onClick={() => { setShowForm(true); setEditTarget(null); setForm(emptyPatient()); }}>
            <Plus size={14}/> New Patient
          </button>
        )}
      </div>

      {showForm && mode === 'patients' && (
        <div className="at-modal-bg" onClick={() => setShowForm(false)}>
          <div className="at-modal" onClick={e => e.stopPropagation()}>
            <div className="at-modal-head">
              <span>{editTarget ? 'Edit Patient' : 'New Patient'}</span>
              <button onClick={() => setShowForm(false)}><X size={16}/></button>
            </div>
            <div className="at-form-grid">
              <label className="at-label">MRN<input className="at-input" value={String(form.mrn??'')} onChange={e => setForm(p => ({...p, mrn:e.target.value}))}/></label>
              <label className="at-label">First Name<input className="at-input" value={String(form.firstName??'')} onChange={e => setForm(p => ({...p, firstName:e.target.value}))}/></label>
              <label className="at-label">Last Name<input className="at-input" value={String(form.lastName??'')} onChange={e => setForm(p => ({...p, lastName:e.target.value}))}/></label>
              <label className="at-label">Age<input type="number" className="at-input" value={String(form.age??'')} onChange={e => setForm(p => ({...p, age:e.target.value}))}/></label>
              <label className="at-label">Gender
                <select className="at-input" value={String(form.gender??'Male')} onChange={e => setForm(p => ({...p, gender:e.target.value}))}>
                  {['Male','Female','Other'].map(g => <option key={g}>{g}</option>)}
                </select>
              </label>
              <label className="at-label">Phone<input className="at-input" value={String(form.phone??'')} onChange={e => setForm(p => ({...p, phone:e.target.value}))}/></label>
              <label className="at-label">Condition<input className="at-input" value={String(form.conditionCategory??'')} onChange={e => setForm(p => ({...p, conditionCategory:e.target.value}))}/></label>
              <label className="at-label">Next-of-Kin Name<input className="at-input" value={String(form.nextOfKinName??'')} onChange={e => setForm(p => ({...p, nextOfKinName:e.target.value}))}/></label>
              <label className="at-label">Next-of-Kin Phone<input className="at-input" value={String(form.nextOfKinPhone??'')} onChange={e => setForm(p => ({...p, nextOfKinPhone:e.target.value}))}/></label>
              <label className="at-check"><input type="checkbox" checked={!!form.consentGiven} onChange={e => setForm(p => ({...p, consentGiven:e.target.checked}))}/>Consent Given</label>
            </div>
            <div className="at-modal-foot">
              <button className="at-btn-cancel" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="at-btn-save" onClick={savePatient} disabled={saving}>{saving ? 'Saving…' : 'Save Patient'}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="at-empty">Loading…</div>
      ) : (
        <div className="at-table-wrap">
          <table className="at-table">
            <thead>
              <tr>
                {(isFamily||isMed) && <th style={{width:36}}/>}
                <th>MRN</th><th>Name</th><th>Age</th><th>Phone</th><th>Condition</th>
                {mode === 'patients' && <><th>💊</th><th>👨‍👩‍👧</th><th>Risk</th></>}
                <th/>
              </tr>
            </thead>
            <tbody>
              {patients.map(p => (
                <React.Fragment key={p.id}>
                  <tr className="at-row">
                    {(isFamily||isMed) && (
                      <td><button className="at-expand" onClick={() => toggle(p.id)}>{expanded === p.id ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button></td>
                    )}
                    <td className="at-mono" style={{color:'rgba(255,255,255,0.4)'}}>{p.mrn || '—'}</td>
                    <td className="at-name">{p.firstName} {p.lastName}</td>
                    <td>{p.age}</td>
                    <td className="at-mono">{p.phone}</td>
                    <td>{p.conditionCategory ?? <span className="at-nil">—</span>}</td>
                    {mode === 'patients' && (
                      <>
                        <td><span className="at-badge at-badge-blue">{p._count?.medicines ?? 0}</span></td>
                        <td><span className="at-badge at-badge-purple">{p._count?.familyMembers ?? 0}</span></td>
                        <td>{p.riskScores?.[0]
                          ? <span className={`at-risk at-risk-${p.riskScores[0].score.toLowerCase()}`}>{p.riskScores[0].score}</span>
                          : <span className="at-nil">—</span>}
                        </td>
                      </>
                    )}
                    <td>
                      <div className="at-actions">
                        {mode === 'patients' && <button className="at-btn-icon" title="Edit" onClick={() => startEditPatient(p)}><Pencil size={13}/></button>}
                        {mode === 'patients' && <button className="at-btn-icon at-btn-red" title="Delete" disabled={deleting === p.id} onClick={() => deletePatient(p.id)}><Trash2 size={13}/></button>}
                      </div>
                    </td>
                  </tr>

                  {expanded === p.id && (isFamily||isMed) && (
                    <tr>
                      <td colSpan={8} className="at-sub-cell">
                        <div className="at-sub">
                          <div className="at-sub-head">
                            <strong>{isFamily ? 'Family Members' : 'Medicines'}</strong>
                            <button className="at-btn-add-sm" onClick={() => startAddSub(isFamily)}><Plus size={12}/>Add</button>
                          </div>

                          {Object.keys(subForm).length > 0 && (
                            <div className="at-sub-form">
                              {isFamily ? (
                                <div className="at-sub-fields">
                                  <input className="at-input-sm" placeholder="Name" value={String(subForm.name??'')} onChange={e => setSubForm(p => ({...p, name:e.target.value}))}/>
                                  <input className="at-input-sm" placeholder="Phone" value={String(subForm.phone??'')} onChange={e => setSubForm(p => ({...p, phone:e.target.value}))}/>
                                  <input className="at-input-sm" placeholder="Relationship" value={String(subForm.relationship??'')} onChange={e => setSubForm(p => ({...p, relationship:e.target.value}))}/>
                                  <label className="at-check-sm"><input type="checkbox" checked={!!subForm.consentGiven} onChange={e => setSubForm(p => ({...p, consentGiven:e.target.checked}))}/>Consent</label>
                                </div>
                              ) : (
                                <div className="at-sub-fields">
                                  <input className="at-input-sm" placeholder="Medicine name" value={String(subForm.medicineName??'')} onChange={e => setSubForm(p => ({...p, medicineName:e.target.value}))}/>
                                  <input className="at-input-sm" placeholder="Dose e.g. 10mg" value={String(subForm.dose??'')} onChange={e => setSubForm(p => ({...p, dose:e.target.value}))}/>
                                  <input className="at-input-sm" placeholder="Frequency" value={String(subForm.frequency??'')} onChange={e => setSubForm(p => ({...p, frequency:e.target.value}))}/>
                                  <select className="at-input-sm" value={String(subForm.timingInstruction??'AFTER_BREAKFAST')} onChange={e => setSubForm(p => ({...p, timingInstruction:e.target.value}))}>
                                    {TIMING.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                                  </select>
                                  <input type="number" className="at-input-sm" placeholder="Days" value={String(subForm.durationDays??'')} onChange={e => setSubForm(p => ({...p, durationDays:e.target.value}))}/>
                                  <input type="date" className="at-input-sm" value={String(subForm.startDate??'')} onChange={e => setSubForm(p => ({...p, startDate:e.target.value}))}/>
                                </div>
                              )}
                              <div className="at-sub-form-btns">
                                <button className="at-btn-save-sm" onClick={() => saveSub(p.id)} disabled={saving}><Check size={12}/>{saving ? '…' : 'Save'}</button>
                                <button className="at-btn-cancel-sm" onClick={() => setSubForm({})}><X size={12}/>Cancel</button>
                              </div>
                            </div>
                          )}

                          {(sub[p.id] ?? []).length === 0 ? (
                            <div className="at-sub-empty">No records yet. Click Add to create one.</div>
                          ) : (
                            <div className="at-sub-list">
                              {(sub[p.id] ?? []).map((item:FamilyMember|Medicine) => (
                                <div key={item.id} className="at-sub-item">
                                  {isFamily ? (
                                    <span>{(item as FamilyMember).name} · {(item as FamilyMember).phone}{(item as FamilyMember).relationship ? ` (${(item as FamilyMember).relationship})` : ''}</span>
                                  ) : (
                                    <span>{(item as Medicine).medicineName} — {(item as Medicine).dose} · {(item as Medicine).frequency} · {(item as Medicine).timingInstruction.replace(/_/g,' ')}</span>
                                  )}
                                  <div className="at-actions">
                                    <button className="at-btn-icon" onClick={() => startEditSub(item, isFamily)}><Pencil size={11}/></button>
                                    <button className="at-btn-icon at-btn-red" onClick={() => deleteSub(p.id, item.id)}><Trash2 size={11}/></button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .at-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem}
        .at-count{font-size:.8125rem;color:rgba(255,255,255,.4);font-weight:500}
        .at-btn-add{display:flex;align-items:center;gap:.375rem;padding:.5rem 1rem;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:.8125rem;font-weight:700;border:none;border-radius:8px;cursor:pointer;transition:opacity .2s}
        .at-btn-add:hover{opacity:.85}
        .at-table-wrap{overflow-x:auto;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.02)}
        .at-table{width:100%;border-collapse:collapse;font-size:.8125rem}
        .at-table thead th{padding:.75rem 1rem;text-align:left;font-size:.6875rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.3);border-bottom:1px solid rgba(255,255,255,.07)}
        .at-row{border-bottom:1px solid rgba(255,255,255,.05);transition:background .15s}
        .at-row:hover{background:rgba(255,255,255,.03)}
        .at-row td{padding:.75rem 1rem;color:rgba(255,255,255,.8);vertical-align:middle}
        .at-name{font-weight:600;color:#fff}
        .at-mono{font-family:monospace;font-size:.8rem}
        .at-nil{color:rgba(255,255,255,.2)}
        .at-badge{display:inline-block;padding:.15rem .5rem;border-radius:99px;font-size:.6875rem;font-weight:700}
        .at-badge-blue{background:rgba(99,102,241,.15);color:#a5b4fc}
        .at-badge-purple{background:rgba(168,85,247,.15);color:#d8b4fe}
        .at-risk{display:inline-block;padding:.15rem .5rem;border-radius:99px;font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
        .at-risk-high{background:rgba(239,68,68,.15);color:#fca5a5}
        .at-risk-medium{background:rgba(245,158,11,.15);color:#fde68a}
        .at-risk-low{background:rgba(16,185,129,.15);color:#6ee7b7}
        .at-actions{display:flex;gap:.375rem}
        .at-btn-icon{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:rgba(255,255,255,.5);border-radius:6px;cursor:pointer;transition:all .15s}
        .at-btn-icon:hover{background:rgba(255,255,255,.1);color:#fff}
        .at-btn-icon:disabled{opacity:.4;cursor:not-allowed}
        .at-btn-red:hover{background:rgba(239,68,68,.2) !important;border-color:rgba(239,68,68,.4) !important;color:#fca5a5 !important}
        .at-expand{background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;display:flex;align-items:center;padding:.25rem}
        .at-expand:hover{color:#fff}
        .at-sub-cell{padding:0 !important;background:rgba(16,185,129,.025)}
        .at-sub{padding:1rem 1.5rem 1rem 3.5rem;border-bottom:1px solid rgba(255,255,255,.05)}
        .at-sub-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem}
        .at-sub-head strong{font-size:.8125rem;color:rgba(255,255,255,.6)}
        .at-btn-add-sm{display:flex;align-items:center;gap:.25rem;padding:.3rem .625rem;background:rgba(16,185,129,.12);color:#6ee7b7;font-size:.75rem;font-weight:600;border:1px solid rgba(16,185,129,.3);border-radius:6px;cursor:pointer;transition:all .15s}
        .at-btn-add-sm:hover{background:rgba(16,185,129,.22)}
        .at-sub-form{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:.875rem;margin-bottom:.75rem}
        .at-sub-fields{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:.625rem}
        .at-input-sm{padding:.375rem .625rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:#fff;font-size:.78rem;min-width:110px;flex:1;outline:none}
        .at-input-sm:focus{border-color:rgba(16,185,129,.5)}
        .at-input-sm::placeholder{color:rgba(255,255,255,.25)}
        .at-check-sm{display:flex;align-items:center;gap:.35rem;color:rgba(255,255,255,.6);font-size:.78rem;cursor:pointer;white-space:nowrap}
        .at-sub-form-btns{display:flex;gap:.375rem}
        .at-btn-save-sm{display:flex;align-items:center;gap:.25rem;padding:.35rem .75rem;background:#10b981;color:#fff;font-size:.75rem;font-weight:700;border:none;border-radius:6px;cursor:pointer}
        .at-btn-cancel-sm{display:flex;align-items:center;gap:.25rem;padding:.35rem .75rem;background:rgba(255,255,255,.06);color:rgba(255,255,255,.5);font-size:.75rem;font-weight:600;border:1px solid rgba(255,255,255,.1);border-radius:6px;cursor:pointer}
        .at-sub-empty{font-size:.8rem;color:rgba(255,255,255,.25);padding:.375rem 0;font-style:italic}
        .at-sub-list{display:flex;flex-direction:column;gap:.375rem}
        .at-sub-item{display:flex;align-items:center;justify-content:space-between;padding:.45rem .75rem;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:7px;font-size:.8rem;color:rgba(255,255,255,.65)}
        .at-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);z-index:100;display:flex;align-items:center;justify-content:center;padding:1rem}
        .at-modal{background:#161b2e;border:1px solid rgba(255,255,255,.12);border-radius:20px;width:100%;max-width:560px;overflow:hidden}
        .at-modal-head{display:flex;align-items:center;justify-content:space-between;padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,.08);font-weight:700;color:#fff;font-size:1rem}
        .at-modal-head button{background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;display:flex;padding:.25rem;border-radius:6px;transition:color .15s}
        .at-modal-head button:hover{color:#fff}
        .at-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:.875rem;padding:1.25rem 1.5rem}
        .at-label{display:flex;flex-direction:column;gap:.35rem;font-size:.72rem;font-weight:700;color:rgba(255,255,255,.4);letter-spacing:.05em;text-transform:uppercase}
        .at-input{padding:.575rem .75rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#fff;font-size:.875rem;outline:none;transition:border-color .15s}
        .at-input:focus{border-color:rgba(16,185,129,.5);background:rgba(16,185,129,.04)}
        .at-check{display:flex;align-items:center;gap:.5rem;color:rgba(255,255,255,.6);font-size:.84rem;cursor:pointer;grid-column:span 2;font-weight:500}
        .at-modal-foot{display:flex;justify-content:flex-end;gap:.625rem;padding:1rem 1.5rem;border-top:1px solid rgba(255,255,255,.08)}
        .at-btn-cancel{padding:.6rem 1.125rem;background:rgba(255,255,255,.06);color:rgba(255,255,255,.5);font-size:.8125rem;font-weight:600;border:1px solid rgba(255,255,255,.1);border-radius:8px;cursor:pointer;transition:all .15s}
        .at-btn-cancel:hover{background:rgba(255,255,255,.1)}
        .at-btn-save{padding:.6rem 1.25rem;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:.8125rem;font-weight:700;border:none;border-radius:8px;cursor:pointer;transition:opacity .15s}
        .at-btn-save:hover{opacity:.88}
        .at-btn-save:disabled{opacity:.45;cursor:not-allowed}
        .at-empty{padding:3rem;text-align:center;color:rgba(255,255,255,.25);font-size:.875rem}
      `}</style>
    </div>
  );
}
