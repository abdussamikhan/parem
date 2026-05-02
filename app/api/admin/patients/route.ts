/**
 * GET  /api/admin/patients   — list all patients (with family + medicine counts)
 * POST /api/admin/patients   — create a new patient
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

export async function GET() {
  const deny = await requireAdmin();
  if (deny) return deny;

  const patients = await prisma.patient.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { medicines: true, familyMembers: true },
      },
      riskScores: {
        orderBy: { calculatedAt: 'desc' },
        take: 1,
        select: { score: true },
      },
    },
  });

  return NextResponse.json(patients);
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const deny = await requireAdmin();
  if (deny) return deny;

  const body = await req.json();
  const {
    firstName, lastName, age, gender, phone,
    nextOfKinName, nextOfKinPhone,
    wakeTime, breakfastTime, lunchTime, dinnerTime, bedTime,
    consentGiven, voicePreferred, familyGroupMode,
    whatsappGroupId, conditionCategory, mrn,
  } = body;

  if (!firstName || !lastName || !age || !gender || !phone) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    const patient = await prisma.patient.create({
      data: {
        firstName, lastName,
        age: Number(age),
        gender, phone, mrn: mrn || null,
        nextOfKinName:  nextOfKinName  ?? null,
        nextOfKinPhone: nextOfKinPhone ?? null,
        wakeTime:       wakeTime       ?? null,
        breakfastTime:  breakfastTime  ?? null,
        lunchTime:      lunchTime      ?? null,
        dinnerTime:     dinnerTime     ?? null,
        bedTime:        bedTime        ?? null,
        consentGiven:   !!consentGiven,
        voicePreferred: !!voicePreferred,
        familyGroupMode: !!familyGroupMode,
        whatsappGroupId: whatsappGroupId ?? null,
        conditionCategory: conditionCategory ?? null,
      },
    });

    // Create Audit Log
    const session = await getSession();
    await prisma.auditLog.create({
      data: {
        action: 'CREATE_PATIENT',
        entityType: 'Patient',
        entityId: patient.id,
        details: `Created patient ${firstName} ${lastName}`,
        performedBy: session?.email || 'Unknown User',
      }
    });

    return NextResponse.json(patient, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Phone number already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
