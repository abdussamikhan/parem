/**
 * GET  /api/admin/patients/[id]/medicines   — list medicines for a patient
 * POST /api/admin/patients/[id]/medicines   — add a medicine
 * ADMIN only
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getSession } from '@/app/lib/auth';
import { TimingInstruction } from '@prisma/client';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const deny = await requireAdmin();
  if (deny) return deny;

  const { id } = await params;
  const medicines = await prisma.medicine.findMany({
    where: { patientId: id },
    orderBy: { startDate: 'desc' },
  });
  return NextResponse.json(medicines);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const deny = await requireAdmin();
  if (deny) return deny;

  const { id: patientId } = await params;
  const { medicineName, dose, frequency, timingInstruction, durationDays, startDate } = await req.json();

  if (!medicineName || !dose || !frequency || !timingInstruction || !durationDays || !startDate) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }

  if (!Object.values(TimingInstruction).includes(timingInstruction)) {
    return NextResponse.json({ error: 'Invalid timingInstruction' }, { status: 400 });
  }

  const medicine = await prisma.medicine.create({
    data: {
      patientId,
      medicineName,
      dose,
      frequency,
      timingInstruction: timingInstruction as TimingInstruction,
      durationDays: Number(durationDays),
      startDate: new Date(startDate),
    },
  });
  return NextResponse.json(medicine, { status: 201 });
}
