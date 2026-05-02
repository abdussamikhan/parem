/**
 * PUT    /api/admin/patients/[id]/family/[memberId]  — update family member
 * DELETE /api/admin/patients/[id]/family/[memberId]  — delete family member
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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const deny = await requireAdmin();
  if (deny) return deny;

  const { memberId } = await params;
  const { name, phone, relationship, consentGiven } = await req.json();

  const updated = await prisma.familyMember.update({
    where: { id: memberId },
    data: {
      name:         name         ?? undefined,
      phone:        phone        ?? undefined,
      relationship: relationship ?? null,
      consentGiven: consentGiven != null ? !!consentGiven : undefined,
    },
  });

  const session = await getSession();
  await prisma.auditLog.create({
    data: {
      action: 'UPDATE_FAMILY_MEMBER',
      entityType: 'FamilyMember',
      entityId: memberId,
      details: `Updated family member ${memberId} for patient`,
      performedBy: session?.email || 'Unknown User',
    }
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const deny = await requireAdmin();
  if (deny) return deny;

  const { id: patientId, memberId } = await params;
  await prisma.familyMember.delete({ where: { id: memberId } });

  const session = await getSession();
  await prisma.auditLog.create({
    data: {
      action: 'DELETE_FAMILY_MEMBER',
      entityType: 'FamilyMember',
      entityId: memberId,
      details: `Deleted family member ${memberId} from patient ${patientId}`,
      performedBy: session?.email || 'Unknown User',
    }
  });

  return NextResponse.json({ ok: true });
}
