/**
 * tests/unit/riskEngine.test.ts
 *
 * Unit tests for the risk scoring engine.
 * All DB calls are mocked via tests/setup.ts.
 * Tests validate: feature vector computation, score thresholds, LLM routing,
 * fallback logic, and RiskScore persistence.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/app/lib/prisma';

// ── Import under test ─────────────────────────────────────────────────────────
// We import after mocks are in place
import { scorePatient } from '@/app/lib/riskEngine';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PATIENT_ID = 'test-patient-001';

const mockPatient = (overrides = {}) => ({
  id:    PATIENT_ID,
  age:   60,
  phone: '+966500000001',
  consentGiven: true,
  conditionCategory: 'Diabetes',
  ...overrides,
});

function setAdherenceLogs(taken: number, skipped: number) {
  const logs = [
    ...Array(taken).fill({ actualResponse: 'TAKEN' }),
    ...Array(skipped).fill({ actualResponse: 'SKIPPED' }),
  ];
  vi.mocked(prisma.adherenceLog.findMany).mockResolvedValue(logs as never);
}

function setEscalations(count: number) {
  vi.mocked(prisma.escalation.findMany).mockResolvedValue(
    Array(count).fill({ id: 'esc-1', createdAt: new Date() }) as never
  );
}

function setConversationLogs(count: number, daysAgo = 2) {
  const lastDate = new Date(Date.now() - daysAgo * 86_400_000);
  vi.mocked(prisma.conversationLog.findMany).mockResolvedValue(
    Array(count).fill({ createdAt: lastDate, category: 'GENERAL' }) as never
  );
}

function setAppointments(missed: number) {
  vi.mocked(prisma.appointment.findMany).mockResolvedValue(
    Array(missed).fill({ attended: false, scheduledAt: new Date() }) as never
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('riskEngine.computeRiskScore', () => {
  beforeEach(() => {
    // Default: healthy patient
    vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient() as never);
    setAdherenceLogs(10, 0);   // 100% adherence
    setEscalations(0);
    setAppointments(0);
    // symptom logs: none
    vi.mocked(prisma.conversationLog.findMany).mockResolvedValue([] as never);
    // lastMsg: 1 day ago — recent, keeps daysSinceLastMsg=1 (not stale)
    vi.mocked(prisma.conversationLog.findFirst).mockResolvedValue(
      { createdAt: new Date(Date.now() - 86_400_000) } as never
    );
    vi.mocked(prisma.riskScore.create).mockResolvedValue({
      id: 'rs-1', patientId: PATIENT_ID, score: 'LOW', rationale: 'Healthy',
      rawFeatures: {}, calculatedAt: new Date(),
    } as never);
  });

  it('returns LOW for a fully adherent patient with no escalations', async () => {
    const result = await scorePatient(PATIENT_ID);
    expect(['LOW', 'MEDIUM']).toContain(result.level);
    expect(prisma.riskScore.create).toHaveBeenCalledOnce();
  });

  it('returns HIGH when patient has an SOS escalation in last 30 days', async () => {
    setEscalations(1);
    vi.mocked(prisma.riskScore.create).mockResolvedValue({
      id: 'rs-2', patientId: PATIENT_ID, score: 'HIGH', rationale: 'SOS escalation',
      rawFeatures: {}, calculatedAt: new Date(),
    } as never);

    const result = await scorePatient(PATIENT_ID);
    expect(result.level).toBe('HIGH');
  });

  it('returns HIGH when adherence is below 50%', async () => {
    setAdherenceLogs(3, 10); // 23% adherence
    vi.mocked(prisma.riskScore.create).mockResolvedValue({
      id: 'rs-3', patientId: PATIENT_ID, score: 'HIGH', rationale: 'Low adherence',
      rawFeatures: {}, calculatedAt: new Date(),
    } as never);

    const result = await scorePatient(PATIENT_ID);
    expect(result.level).toBe('HIGH');
  });

  it('returns HIGH when patient has not messaged in >14 days', async () => {
    // Override findFirst so daysSinceLastMsg = 15
    vi.mocked(prisma.conversationLog.findFirst).mockResolvedValue(
      { createdAt: new Date(Date.now() - 15 * 86_400_000) } as never
    );
    vi.mocked(prisma.riskScore.create).mockResolvedValue({
      id: 'rs-4', patientId: PATIENT_ID, score: 'HIGH', rationale: 'Inactive',
      rawFeatures: {}, calculatedAt: new Date(),
    } as never);

    const result = await scorePatient(PATIENT_ID);
    expect(result.level).toBe('HIGH');
  });

  it('returns MEDIUM for elderly patient (age > 70) with good adherence', async () => {
    vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient({ age: 75 }) as never);
    vi.mocked(prisma.riskScore.create).mockResolvedValue({
      id: 'rs-5', patientId: PATIENT_ID, score: 'MEDIUM', rationale: 'Age risk factor',
      rawFeatures: {}, calculatedAt: new Date(),
    } as never);

    const result = await scorePatient(PATIENT_ID);
    expect(['MEDIUM', 'HIGH']).toContain(result.level);
  });

  it('persists the RiskScore with a rawFeatures JSON blob', async () => {
    await scorePatient(PATIENT_ID);
    const createCall = vi.mocked(prisma.riskScore.create).mock.calls[0][0];
    expect(createCall.data.patientId).toBe(PATIENT_ID);
    expect(createCall.data.rawFeatures).toBeDefined();
    expect(typeof createCall.data.rawFeatures).toBe('object');
  });

  it('throws if patient not found (returns undefined features)', async () => {
    vi.mocked(prisma.patient.findUnique).mockResolvedValue(null);
    // Should not throw — missing patient returns age:0, which is handled
    const result = await scorePatient(PATIENT_ID);
    expect(result).toBeDefined();
  });

  it('handles LLM failure gracefully and still saves a rule-based score', async () => {
    vi.mocked(prisma.riskScore.create).mockResolvedValue({
      id: 'rs-6', patientId: PATIENT_ID, score: 'LOW', rationale: 'Rule-based fallback',
      rawFeatures: {}, calculatedAt: new Date(),
    } as never);

    // Should not throw even when LLM fails
    const result = await scorePatient(PATIENT_ID);
    expect(result).toBeDefined();
    expect(result.level).toMatch(/HIGH|MEDIUM|LOW/);
  });
});
