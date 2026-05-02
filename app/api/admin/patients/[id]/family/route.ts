/**
 * GET  /api/admin/patients/[id]/family   — list family members for a patient
 * POST /api/admin/patients/[id]/family   — add family member
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const deny = await requireAdmin();
  if (deny) return deny;

  const { id } = await params;
  const members = await prisma.familyMember.findMany({
    where: { patientId: id },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(members);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const deny = await requireAdmin();
  if (deny) return deny;

  const { id: patientId } = await params;
  const { name, phone, relationship, consentGiven } = await req.json();

  if (!name || !phone) {
    return NextResponse.json({ error: 'name and phone are required' }, { status: 400 });
  }

  const member = await prisma.familyMember.create({
    data: {
      patientId,
      name,
      phone,
      relationship: relationship ?? null,
      consentGiven: !!consentGiven,
    },
  });

  const session = await getSession();
  await prisma.auditLog.create({
    data: {
      action: 'ADD_FAMILY_MEMBER',
      entityType: 'FamilyMember',
      entityId: member.id,
      details: `Added family member ${name} for patient ${patientId}`,
      performedBy: session?.email || 'Unknown User',
    }
  });
  return NextResponse.json(member, { status: 201 });
}
