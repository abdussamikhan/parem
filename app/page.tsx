'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, Users, Activity, CheckCircle, RefreshCcw, Bell } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
};

type SOSAlert = {
  id: string;
  patient: Patient;
  patientMessage: string;
  alertSentAt?: string;
  status: string;
};

export default function Dashboard() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin text-blue-600">
          <RefreshCcw size={32} />
        </div>
      </div>
    );
  }

  const kpis = [
    { label: 'Total Enrolled Patients', value: data?.totalPatients || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: "Today's Adherence Rate", value: `${data?.todayStats?.rate || 0}%`, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Medicines Taken Today', value: data?.todayStats?.taken || 0, icon: CheckCircle, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    { label: 'Active SOS Alerts', value: data?.activeSOS || 0, icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-100', alert: data?.activeSOS > 0 },
  ];

  // Dummy chart data for visualization (in a real app, fetch historical adherence)
  const chartData = [
    { name: 'Mon', adherence: 85 },
    { name: 'Tue', adherence: 88 },
    { name: 'Wed', adherence: 92 },
    { name: 'Thu', adherence: 80 },
    { name: 'Fri', adherence: 89 },
    { name: 'Sat', adherence: 95 },
    { name: 'Sun', adherence: data?.todayStats?.rate || 0 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Care Command Center</h1>
            <p className="text-slate-500 mt-1">Real-time patient monitoring and automated intervention</p>
          </div>
          <div className="flex items-center space-x-4">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpis.map((kpi, idx) => (
            <div key={idx} className={`p-6 rounded-2xl bg-white shadow-sm border ${kpi.alert ? 'border-red-300 ring-4 ring-red-50' : 'border-slate-100'} transition-all hover:shadow-md`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">{kpi.label}</p>
                  <h3 className={`text-3xl font-bold ${kpi.alert ? 'text-red-600' : 'text-slate-900'}`}>{kpi.value}</h3>
                </div>
                <div className={`p-3 rounded-xl ${kpi.bg}`}>
                  <kpi.icon className={kpi.color} size={24} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Active Alerts Panel */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="text-red-500" size={20} />
                  Active SOS Escalations
                </h2>
                <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                  {data?.recentSOS?.length || 0} Critical
                </span>
              </div>
              
              {data?.recentSOS?.length > 0 ? (
                <div className="space-y-4">
                  {data.recentSOS.map((sos: SOSAlert) => (
                    <div key={sos.id} className="p-4 rounded-xl border border-red-100 bg-red-50/50 hover:bg-red-50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-red-900">{sos.patient.firstName} {sos.patient.lastName}</h4>
                        <span className="text-xs text-red-500 font-medium">{sos.alertSentAt ? new Date(sos.alertSentAt).toLocaleTimeString() : 'Recent'}</span>
                      </div>
                      <p className="text-sm text-red-800 bg-white/60 p-3 rounded-lg border border-red-100">{sos.patientMessage}</p>
                      <div className="mt-3 flex justify-end">
                        <button className="px-4 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-red-700 transition-colors">
                          Acknowledge
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

            {/* Chart Panel */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-96 flex flex-col">
              <h2 className="text-lg font-semibold text-slate-900 mb-6">Weekly Adherence Trend</h2>
              <div className="flex-1 w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                      cursor={{stroke: '#e2e8f0', strokeWidth: 2}}
                    />
                    <Line type="monotone" dataKey="adherence" stroke="#2563eb" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Sidebar / Patient List */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Enrolled Patients</h2>
              <button className="text-blue-600 text-sm font-medium hover:underline">View All</button>
            </div>
            
            <div className="space-y-4">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {data?.patients?.map((patient: any) => (
                <div key={patient.id} className="flex items-center p-3 rounded-xl hover:bg-slate-50 transition-colors group border border-transparent hover:border-slate-100">
                  <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shadow-inner">
                    {patient.firstName[0]}{patient.lastName[0]}
                  </div>
                  <div className="ml-4 flex-1">
                    <h4 className="text-sm font-semibold text-slate-900">{patient.firstName} {patient.lastName}</h4>
                    <p className="text-xs text-slate-500">{patient.medicines?.length || 0} active prescriptions</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="text-blue-600 p-1 hover:bg-blue-50 rounded-md">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
