/**
 * tests/integration/api.dashboard.test.ts
 *
 * Integration tests for GET /api/dashboard.
 * Mocks Prisma at the module level (via setup.ts) and validates
 * response shape, risk summary, and leaderboard ordering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/app/lib/prisma';
import { GET } from '@/app/api/dashboard/route';

// Helper: mock NextResponse via fetch-compatible Response
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

describe('GET /api/dashboard', () => {
  beforeEach(() => {
    vi.mocked(prisma.patient.count).mockResolvedValue(5);
    vi.mocked(prisma.escalation.count).mockResolvedValue(1);
    vi.mocked(prisma.escalation.findMany).mockResolvedValue([
      {
        id:             'esc-1',
        patient:        { id: 'p1', firstName: 'Ahmad', lastName: 'Al-Farsi', phone: '+966500000001' },
        patientMessage: 'Chest pain',
        alertSentAt:    new Date(),
        outcome:        null,
        createdAt:      new Date(),
      },
    ] as never);
    vi.mocked(prisma.adherenceLog.findMany).mockResolvedValue([
      { actualResponse: 'TAKEN'   },
      { actualResponse: 'TAKEN'   },
      { actualResponse: 'SKIPPED' },
    ] as never);
    vi.mocked(prisma.patient.findMany).mockResolvedValue([
      { id: 'p1', firstName: 'Ahmad', lastName: 'Al-Farsi', medicines: [{}] },
    ] as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      {
        patient_id:   'p1',
        score:        'HIGH',
        rationale:    'Missed medications',
        calculated_at: new Date(),
        first_name:   'Ahmad',
        last_name:    'Al-Farsi',
      },
    ]);
  });

  it('returns 200 with the expected shape', async () => {
    const res  = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('totalPatients');
    expect(body).toHaveProperty('activeSOS');
    expect(body).toHaveProperty('todayStats');
    expect(body).toHaveProperty('riskLeaderboard');
    expect(body).toHaveProperty('riskSummary');
  });

  it('calculates adherence rate correctly (2 taken, 1 missed = 67%)', async () => {
    const res  = await GET();
    const body = await res.json();
    expect(body.todayStats.rate).toBe(67);
    expect(body.todayStats.taken).toBe(2);
    expect(body.todayStats.missed).toBe(1);
  });

  it('returns active SOS count = 1', async () => {
    const res  = await GET();
    const body = await res.json();
    expect(body.activeSOS).toBe(1);
  });

  it('returns riskLeaderboard with HIGH first', async () => {
    const res  = await GET();
    const body = await res.json();
    expect(body.riskLeaderboard[0].level).toBe('HIGH');
  });

  it('returns riskSummary with high = 1', async () => {
    const res  = await GET();
    const body = await res.json();
    expect(body.riskSummary.high).toBe(1);
    expect(body.riskSummary.medium).toBe(0);
    expect(body.riskSummary.low).toBe(0);
  });

  it('returns totalPatients from DB count', async () => {
    const res  = await GET();
    const body = await res.json();
    expect(body.totalPatients).toBe(5);
  });
});
