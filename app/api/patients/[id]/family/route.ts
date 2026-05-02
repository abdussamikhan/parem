/**
 * /api/patients/[id]/family
 *
 * CRUD for a patient's FamilyMember records.
 *
 * GET    → list all family members for patient
 * POST   → add a new family member
 * DELETE → remove a family member (pass ?memberId=xxx)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

// ── GET /api/patients/[id]/family ─────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const patient = await prisma.patient.findUnique({ where: { id }, select: { id: true } });
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

  const members = await prisma.familyMember.findMany({
    where:   { patientId: id },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ patientId: id, members });
}

// ── POST /api/patients/[id]/family ────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const patient = await prisma.patient.findUnique({
    where:  { id },
    select: { id: true, consentGiven: true },
  });
  if (!patient)            return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  if (!patient.consentGiven) return NextResponse.json({ error: 'Patient consent required' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { name, phone, relationship, consentGiven } = body ?? {};

  if (!name || !phone) {
    return NextResponse.json({ error: 'name and phone are required' }, { status: 400 });
  }

  const member = await prisma.familyMember.create({
    data: {
      patientId:    id,
      name,
      phone,
      relationship: relationship ?? null,
      consentGiven: Boolean(consentGiven),
    },
  });

  return NextResponse.json({ member }, { status: 201 });
}

// ── DELETE /api/patients/[id]/family?memberId=xxx ─────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const memberId = req.nextUrl.searchParams.get('memberId');

  if (!memberId) return NextResponse.json({ error: 'memberId query param required' }, { status: 400 });

  // Verify the member belongs to this patient
  const member = await prisma.familyMember.findFirst({
    where: { id: memberId, patientId: id },
  });
  if (!member) return NextResponse.json({ error: 'Family member not found' }, { status: 404 });

  await prisma.familyMember.delete({ where: { id: memberId } });

  return NextResponse.json({ deleted: memberId });
}
