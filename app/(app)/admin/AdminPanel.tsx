'use client';
import { useState } from 'react';
import { Database, Users, Pill } from 'lucide-react';
import { PatientsTab } from './PatientsTab';
import { Toaster } from '@/app/components/Toaster';
import { useToast } from '@/app/hooks/useToast';

type Tab = 'patients' | 'family' | 'medicines';

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>('patients');
  const toast = useToast();

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'patients',  label: 'Patients',        icon: Database },
    { id: 'family',    label: 'Family Members',   icon: Users },
    { id: 'medicines', label: 'Medicines',         icon: Pill },
  ];

  return (
    <div className="adm-root">
      <header className="adm-header">
        <div>
          <h1 className="adm-title">Admin Data Manager</h1>
          <p className="adm-sub">Create, edit, and delete patients, family members, and medicines.</p>
        </div>
      </header>

      <div className="adm-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`adm-tab ${tab === id ? 'adm-tab-active' : ''}`}
            onClick={() => setTab(id)}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="adm-body">
        <PatientsTab toast={toast} mode={tab} />
      </div>

      <Toaster toasts={toast.toasts} onDismiss={toast.dismiss} />

      <style>{`
        .adm-root{min-height:calc(100vh - 58px);background:#0f1117;padding:2rem 1.5rem;font-family:'Inter',system-ui,sans-serif}
        .adm-header{max-width:1280px;margin:0 auto 1.5rem}
        .adm-title{font-size:1.625rem;font-weight:800;color:#fff;letter-spacing:-.02em}
        .adm-sub{font-size:.875rem;color:rgba(255,255,255,.4);margin-top:.25rem}
        .adm-tabs{max-width:1280px;margin:0 auto 1.5rem;display:flex;gap:.375rem;padding:.375rem;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;width:fit-content}
        .adm-tab{display:flex;align-items:center;gap:.45rem;padding:.5rem 1rem;font-size:.8125rem;font-weight:600;color:rgba(255,255,255,.45);background:none;border:none;border-radius:8px;cursor:pointer;transition:all .2s;white-space:nowrap}
        .adm-tab:hover{color:#fff;background:rgba(255,255,255,.07)}
        .adm-tab-active{color:#fff;background:rgba(16,185,129,.15);box-shadow:inset 0 0 0 1px rgba(16,185,129,.35)}
        .adm-body{max-width:1280px;margin:0 auto}
      `}</style>
    </div>
  );
}
