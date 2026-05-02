/**
 * app/hooks/useDashboard.ts
 *
 * Shared data hook — fetches once, polls every 10s.
 * Import in any page to avoid duplicate fetches.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Patient = {
  id: string; firstName: string; lastName: string; phone: string; mrn?: string | null;
  nextOfKinName?: string; nextOfKinPhone?: string;
  familyGroupMode: boolean; consentGiven: boolean;
  conditionCategory?: string;
  medicines?: Array<{ medicineName?: string; dose?: string }>;
};

export type SOSAlert = {
  id: string; patient: Pick<Patient,'id'|'firstName'|'lastName'|'phone'|'mrn'>;
  patientMessage: string; alertSentAt?: string;
};

export type RiskEntry = {
  patientId: string; name: string;
  level: 'HIGH' | 'MEDIUM' | 'LOW'; rationale: string; calculatedAt: string;
};

export type RiskSummary = { high: number; medium: number; low: number; unscored: number };

export type TrendPoint = { name: string; rate: number; taken: number; missed: number };

export type DashboardData = {
  totalPatients: number;
  todayStats:    { rate: number; taken: number; missed: number };
  activeSOS:     number;
  recentSOS:     SOSAlert[];
  patients:      Patient[];
  riskSummary:   RiskSummary;
  riskLeaderboard: RiskEntry[];
  trend:         TrendPoint[];
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboard(pollInterval = 10_000) {
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, trendRes] = await Promise.all([
        fetch('/api/dashboard', { cache: 'no-store' }),
        fetch('/api/dashboard/adherence-trend', { cache: 'no-store' }),
      ]);

      if (!dashRes.ok) throw new Error(`Dashboard API ${dashRes.status}`);

      const [dash, trendJson] = await Promise.all([dashRes.json(), trendRes.json()]);

      setData({
        totalPatients:   dash.totalPatients    ?? 0,
        todayStats:      dash.todayStats       ?? { rate: 0, taken: 0, missed: 0 },
        activeSOS:       dash.activeSOS        ?? 0,
        recentSOS:       dash.recentSOS        ?? [],
        patients:        dash.patients         ?? [],
        riskSummary:     dash.riskSummary      ?? { high: 0, medium: 0, low: 0, unscored: 0 },
        riskLeaderboard: dash.riskLeaderboard  ?? [],
        trend:           trendJson?.trend      ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollInterval);
    return () => clearInterval(id);
  }, [refresh, pollInterval]);

  return { data, loading, error, refresh };
}
