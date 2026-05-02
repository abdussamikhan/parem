import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

/**
 * PATCH /api/alerts/sos/[id]
 * Acknowledges an active SOS escalation by setting outcome = 'acknowledged'.
 * This removes it from the active-alert queue on the dashboard.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const escalation = await prisma.escalation.findUnique({
      where: { id },
    });

    if (!escalation) {
      return NextResponse.json({ error: 'Escalation not found' }, { status: 404 });
    }

    if (escalation.outcome) {
      return NextResponse.json(
        { error: 'Escalation already resolved', outcome: escalation.outcome },
        { status: 409 }
      );
    }

    const updated = await prisma.escalation.update({
      where: { id },
      data:  { outcome: 'acknowledged' },
    });

    return NextResponse.json({ success: true, escalation: updated });
  } catch (error) {
    console.error('Acknowledge SOS Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
