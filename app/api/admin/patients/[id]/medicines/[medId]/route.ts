/**
 * PUT    /api/admin/patients/[id]/medicines/[medId]  — update a medicine
 * DELETE /api/admin/patients/[id]/medicines/[medId]  — delete a medicine
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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; medId: string }> },
) {
  const deny = await requireAdmin();
  if (deny) return deny;

  const { medId } = await params;
  const { medicineName, dose, frequency, timingInstruction, durationDays, startDate } = await req.json();

  if (timingInstruction && !Object.values(TimingInstruction).includes(timingInstruction)) {
    return NextResponse.json({ error: 'Invalid timingInstruction' }, { status: 400 });
  }

  const updated = await prisma.medicine.update({
    where: { id: medId },
    data: {
      medicineName:       medicineName       ?? undefined,
      dose:               dose               ?? undefined,
      frequency:          frequency          ?? undefined,
      timingInstruction:  timingInstruction  ? (timingInstruction as TimingInstruction) : undefined,
      durationDays:       durationDays       != null ? Number(durationDays) : undefined,
      startDate:          startDate          ? new Date(startDate) : undefined,
    },
  });

  const session = await getSession();
  await prisma.auditLog.create({
    data: {
      action: 'UPDATE_MEDICINE',
      entityType: 'Medicine',
      entityId: medId,
      details: `Updated medicine ${medId}`,
      performedBy: session?.email || 'Unknown User',
    }
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; medId: string }> },
) {
  const deny = await requireAdmin();
  if (deny) return deny;

  const { id: patientId, medId } = await params;

  // Delete linked records before deleting the medicine
  await prisma.$transaction([
    prisma.adherenceLog.deleteMany({ where: { medicineId: medId } }),
    prisma.schedule.deleteMany({ where: { medicineId: medId } }),
    prisma.medicine.delete({ where: { id: medId } }),
  ]);

  const session = await getSession();
  await prisma.auditLog.create({
    data: {
      action: 'DELETE_MEDICINE',
      entityType: 'Medicine',
      entityId: medId,
      details: `Deleted medicine ${medId} from patient ${patientId}`,
      performedBy: session?.email || 'Unknown User',
    }
  });

  return NextResponse.json({ ok: true });
}
