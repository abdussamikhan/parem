/**
 * GET /api/patients/[id]
 *
 * Returns a full patient profile for the detail drawer:
 * - Core demographics
 * - All medicines
 * - Last 10 adherence logs (with medicine name)
 * - Upcoming appointments (next 30 days)
 * - Latest risk score
 * - Family members
 * - 7-day adherence summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const now    = new Date();
  const d7Ago  = new Date(now.getTime() - 7  * 86_400_000);
  const d30Fwd = new Date(now.getTime() + 30 * 86_400_000);

  const patient = await prisma.patient.findUnique({
    where:   { id },
    include: {
      medicines: {
        orderBy: { startDate: 'desc' },
      },
      adherenceLogs: {
        where:   { logDate: { gte: d7Ago } },
        include: { medicine: { select: { medicineName: true } } },
        orderBy: { logDate: 'desc' },
        take:    20,
      },
      appointments: {
        where:   { scheduledAt: { gte: now, lte: d30Fwd } },
        orderBy: { scheduledAt: 'asc' },
        take:    5,
      },
      riskScores: {
        orderBy: { calculatedAt: 'desc' },
        take:    1,
      },
      familyMembers: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  // 7-day adherence summary
  const taken  = patient.adherenceLogs.filter(l => l.actualResponse === 'TAKEN').length;
  const missed = patient.adherenceLogs.filter(l => l.actualResponse === 'SKIPPED').length;
  const total  = patient.adherenceLogs.length;
  const adherenceRate7d = total > 0 ? Math.round((taken / total) * 100) : null;

  return NextResponse.json({
    ...patient,
    adherenceRate7d,
    takenCount7d:  taken,
    missedCount7d: missed,
  });
}
