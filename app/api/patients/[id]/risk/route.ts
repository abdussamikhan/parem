/**
 * GET /api/patients/[id]/risk
 *
 * Returns risk score history for a specific patient.
 *
 * Response:
 * {
 *   patientId: string,
 *   latest: RiskScore | null,
 *   history: RiskScore[]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { latestRiskScore, riskHistory } from '@/app/lib/riskEngine';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Verify patient exists
  const patient = await prisma.patient.findUnique({
    where:  { id },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  const [latest, history] = await Promise.all([
    latestRiskScore(id),
    riskHistory(id, 30),
  ]);

  return NextResponse.json({ patientId: id, patient, latest, history });
}
