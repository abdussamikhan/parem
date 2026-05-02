/**
 * POST /api/patients/[id]/nok-summary
 *
 * On-demand NOK summary endpoint.
 * Generates a weekly-style health summary and sends it to all resolved
 * recipients (FamilyMember records, WhatsApp group, or legacy nextOfKin).
 *
 * Returns: { sent, recipients, summaryText }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { buildNOKSummary } from '@/app/lib/nokSummary';
import { sendWhatsAppMessage } from '@/app/lib/twilio';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Verify patient exists and has consent
  const patient = await prisma.patient.findUnique({
    where:  { id },
    select: { id: true, consentGiven: true, firstName: true, lastName: true },
  });

  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }
  if (!patient.consentGiven) {
    return NextResponse.json({ error: 'Patient has not given consent' }, { status: 403 });
  }

  try {
    const result = await buildNOKSummary(id);

    if (result.recipients.length === 0) {
      return NextResponse.json({
        sent:        0,
        recipients:  [],
        summaryText: result.summaryText,
        warning:     'No recipients configured for this patient',
      });
    }

    const sent: string[] = [];
    const failed: Array<{ phone: string; error: string }> = [];

    for (const recipient of result.recipients) {
      try {
        await sendWhatsAppMessage(recipient.phone, result.summaryText);
        sent.push(recipient.phone);
        console.log(`[nok-summary] Sent to ${recipient.name} (${recipient.type}): ${recipient.phone}`);
      } catch (err) {
        console.error(`[nok-summary] Failed to send to ${recipient.phone}:`, err);
        failed.push({ phone: recipient.phone, error: (err as Error).message });
      }
    }

    return NextResponse.json({
      patientId:   id,
      sent:        sent.length,
      failed:      failed.length,
      recipients:  result.recipients,
      summaryText: result.summaryText,
    });

  } catch (err) {
    console.error('[nok-summary] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * GET /api/patients/[id]/nok-summary
 *
 * Preview-only: generates and returns the summary text WITHOUT sending.
 * Useful for the dashboard to preview before sending.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const patient = await prisma.patient.findUnique({
    where:  { id },
    select: { id: true, consentGiven: true },
  });
  if (!patient)        return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  if (!patient.consentGiven) return NextResponse.json({ error: 'No consent' }, { status: 403 });

  try {
    const result = await buildNOKSummary(id);
    return NextResponse.json({
      patientId:   id,
      summaryText: result.summaryText,
      recipients:  result.recipients,
      preview:     true,
    });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
