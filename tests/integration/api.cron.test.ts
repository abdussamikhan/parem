/**
 * tests/integration/api.cron.test.ts
 *
 * Integration tests for cron endpoints:
 * - POST /api/cron/risk-score  (nightly risk scoring)
 * - POST /api/cron/nok-summary (weekly NOK broadcast)
 *
 * All external calls (LLM, Twilio) are mocked via setup.ts.
 * Dynamic imports inside describe() callbacks avoid top-level await.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/app/lib/prisma';

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    NextResponse: {
      json: (data: unknown, init?: ResponseInit) =>
        new Response(JSON.stringify(data), {
          ...init,
          headers: { 'Content-Type': 'application/json' },
        }),
    },
  };
});

// ─── Risk Score Cron ──────────────────────────────────────────────────────────

describe('POST /api/cron/risk-score', () => {
  beforeEach(() => {
    vi.mocked(prisma.patient.findMany).mockResolvedValue([
      { id: 'p1', firstName: 'Ahmad', lastName: 'Al-Farsi', phone: '+966500000001', age: 65, consentGiven: true },
      { id: 'p2', firstName: 'Sarah', lastName: 'Al-Qahtani', phone: '+966500000003', age: 55, consentGiven: true },
    ] as never);
    vi.mocked(prisma.adherenceLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.escalation.findMany).mockResolvedValue([]);
    vi.mocked(prisma.conversationLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.conversationLog.count).mockResolvedValue(0);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.riskScore.create).mockResolvedValue({
      id: 'rs-1', patientId: 'p1', score: 'LOW', rationale: 'Healthy',
      rawFeatures: {}, calculatedAt: new Date(),
    } as never);
  });

  it('rejects requests without CRON_SECRET', async () => {
    const { POST } = await import('@/app/api/cron/risk-score/route');
    const req = new Request('http://localhost/api/cron/risk-score', { method: 'POST' });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it('accepts requests with correct CRON_SECRET', async () => {
    const { POST } = await import('@/app/api/cron/risk-score/route');
    const req = new Request('http://localhost/api/cron/risk-score', {
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
  });

  it('returns total count equal to patient count', async () => {
    const { POST } = await import('@/app/api/cron/risk-score/route');
    const req = new Request('http://localhost/api/cron/risk-score', {
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    });
    const res  = await POST(req as never);
    const body = await res.json();
    expect(body).toHaveProperty('total');
    expect(body.total).toBe(2);
  });

  it('includes scored and failed counts in response', async () => {
    const { POST } = await import('@/app/api/cron/risk-score/route');
    const req = new Request('http://localhost/api/cron/risk-score', {
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    });
    const res  = await POST(req as never);
    const body = await res.json();
    expect(body).toHaveProperty('scored');
    expect(body).toHaveProperty('failed');
    expect(typeof body.scored).toBe('number');
    expect(typeof body.failed).toBe('number');
  });
});

// ─── NOK Summary Cron ─────────────────────────────────────────────────────────

describe('POST /api/cron/nok-summary', () => {
  beforeEach(() => {
    vi.mocked(prisma.patient.findMany).mockResolvedValue([
      {
        id: 'p1', firstName: 'Ahmad', lastName: 'Al-Farsi',
        nextOfKinPhone: '+966500000002', nextOfKinName: 'Fatima',
        consentGiven: true, familyGroupMode: false, whatsappGroupId: null,
        familyMembers: [],
      },
    ] as never);
    vi.mocked(prisma.adherenceLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.escalation.count).mockResolvedValue(0);
    vi.mocked(prisma.conversationLog.count).mockResolvedValue(0);
    vi.mocked(prisma.riskScore.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({
      id: 'p1', firstName: 'Ahmad', nextOfKinName: 'Fatima',
      nextOfKinPhone: '+966500000002', familyGroupMode: false,
      whatsappGroupId: null, familyMembers: [],
    } as never);
  });

  it('rejects without CRON_SECRET', async () => {
    const { POST } = await import('@/app/api/cron/nok-summary/route');
    const req = new Request('http://localhost/api/cron/nok-summary', { method: 'POST' });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it('returns totalSent in response body', async () => {
    const { POST } = await import('@/app/api/cron/nok-summary/route');
    const req = new Request('http://localhost/api/cron/nok-summary', {
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    });
    const res  = await POST(req as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('totalSent');
  });
});
