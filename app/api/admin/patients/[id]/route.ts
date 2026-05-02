/**
 * GET    /api/admin/patients/[id]   — get single patient detail
 * PUT    /api/admin/patients/[id]   — update patient
 * DELETE /api/admin/patients/[id]   — delete patient (cascades medicines, family, etc.)
 * ADMIN only
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getSession } from '@/app/lib/auth';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const deny = await requireAdmin();
  if (deny) return deny;

  const { id } = await params;
  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      medicines: { orderBy: { startDate: 'desc' } },
      familyMembers: { orderBy: { createdAt: 'asc' } },
      riskScores: { orderBy: { calculatedAt: 'desc' }, take: 1 },
      _count: { select: { adherenceLogs: true, schedules: true } },
    },
  });

  if (!patient) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(patient);
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const deny = await requireAdmin();
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json();

  try {
    const updated = await prisma.patient.update({
      where: { id },
      data: {
        firstName:       body.firstName,
        lastName:        body.lastName,
        age:             body.age != null ? Number(body.age) : undefined,
        gender:          body.gender,
        phone:           body.phone,
        mrn:             body.mrn || null,
        nextOfKinName:   body.nextOfKinName   ?? null,
        nextOfKinPhone:  body.nextOfKinPhone  ?? null,
        wakeTime:        body.wakeTime        ?? null,
        breakfastTime:   body.breakfastTime   ?? null,
        lunchTime:       body.lunchTime       ?? null,
        dinnerTime:      body.dinnerTime      ?? null,
        bedTime:         body.bedTime         ?? null,
        consentGiven:    body.consentGiven    != null ? !!body.consentGiven  : undefined,
        voicePreferred:  body.voicePreferred  != null ? !!body.voicePreferred : undefined,
        familyGroupMode: body.familyGroupMode != null ? !!body.familyGroupMode : undefined,
        whatsappGroupId: body.whatsappGroupId ?? null,
        conditionCategory: body.conditionCategory ?? null,
      },
    });
    return NextResponse.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const deny = await requireAdmin();
  if (deny) return deny;

  const { id } = await params;

  // Delete related non-cascaded data manually
  await prisma.$transaction([
    prisma.adherenceLog.deleteMany({ where: { patientId: id } }),
    prisma.schedule.deleteMany({ where: { patientId: id } }),
    prisma.conversationLog.deleteMany({ where: { patientId: id } }),
    prisma.escalation.deleteMany({ where: { patientId: id } }),
    prisma.medicine.deleteMany({ where: { patientId: id } }),
    prisma.patient.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
