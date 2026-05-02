/**
 * GET|POST /api/patients/[id]/appointments
 *
 * GET  → list upcoming (and recent past) appointments
 * POST → create a new appointment
 *
 * Body (POST):
 * {
 *   title:       string   (required)
 *   scheduledAt: string   (ISO datetime, required)
 *   notes?:      string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getSession } from '@/app/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const patient = await prisma.patient.findUnique({ where: { id }, select: { id: true } });
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

  const now    = new Date();
  const d7Ago  = new Date(now.getTime() - 7  * 86_400_000);
  const d60Fwd = new Date(now.getTime() + 60 * 86_400_000);

  const appointments = await prisma.appointment.findMany({
    where:   { patientId: id, scheduledAt: { gte: d7Ago, lte: d60Fwd } },
    orderBy: { scheduledAt: 'asc' },
  });

  return NextResponse.json({ patientId: id, appointments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const patient = await prisma.patient.findUnique({ where: { id }, select: { id: true } });
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const { title, scheduledAt, notes } = body ?? {};

  if (!title || !scheduledAt) {
    return NextResponse.json({ error: 'title and scheduledAt are required' }, { status: 400 });
  }

  const appointment = await prisma.appointment.create({
    data: {
      patientId:   id,
      title,
      scheduledAt: new Date(scheduledAt),
      notes:       notes ?? null,
    },
  });

  const session = await getSession();
  await prisma.auditLog.create({
    data: {
      action: 'CREATE_APPOINTMENT',
      entityType: 'Appointment',
      entityId: appointment.id,
      details: `Created appointment "${title}" for patient ${id}`,
      performedBy: session?.email || 'Unknown User',
    }
  });

  return NextResponse.json({ appointment }, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const { appointmentId, attended } = body ?? {};

  if (!appointmentId) {
    return NextResponse.json({ error: 'appointmentId required' }, { status: 400 });
  }

  const appt = await prisma.appointment.findFirst({
    where: { id: appointmentId, patientId: id },
  });
  if (!appt) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data:  { attended: Boolean(attended) },
  });

  const session = await getSession();
  await prisma.auditLog.create({
    data: {
      action: 'UPDATE_APPOINTMENT',
      entityType: 'Appointment',
      entityId: appointmentId,
      details: `Updated attendance to ${Boolean(attended)} for appointment ${appointmentId}`,
      performedBy: session?.email || 'Unknown User',
    }
  });

  return NextResponse.json({ appointment: updated });
}
