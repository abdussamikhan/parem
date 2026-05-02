/**
 * POST /api/cron/nok-summary
 *
 * Weekly cron: generates and sends family health summaries for all consented
 * patients that have at least one NOK or FamilyMember contact.
 *
 * Replaces the old single-LLM Groq implementation with:
 *   - llmRouter (NOK_SUMMARY → Qwen 2.5, Sprint A/D routing)
 *   - FamilyMember table support (group + individual)
 *   - CRON_SECRET auth header
 *   - 7-day rolling window (not today-only)
 *
 * Trigger: n8n weekly schedule → POST /api/cron/nok-summary
 *          with header x-cron-secret: $CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { buildNOKSummary } from '@/app/lib/nokSummary';
import { sendWhatsAppMessage } from '@/app/lib/twilio';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return runNOKCron(req);
}


async function runNOKCron(req: NextRequest) {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get('x-cron-secret') ?? req.headers.get('authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (token !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startedAt = new Date();

  // ── Patients eligible for NOK summary ──────────────────────────────────────
  // Include patients that have:
  //   - consent given
  //   - at least one FamilyMember with consent, OR a legacy nextOfKinPhone
  const patients = await prisma.patient.findMany({
    where: {
      consentGiven: true,
      OR: [
        { nextOfKinPhone: { not: null } },
        { familyMembers:  { some: { consentGiven: true } } },
        { familyGroupMode: true, whatsappGroupId: { not: null } },
      ],
    },
    select: { id: true, firstName: true, lastName: true },
  });

  console.log(`[nok-cron] Processing ${patients.length} eligible patients`);

  const results: Array<{
    patientId: string;
    name:      string;
    sent:      number;
    failed:    number;
  }> = [];
  const errors: Array<{ patientId: string; error: string }> = [];

  for (const p of patients) {
    try {
      const summary = await buildNOKSummary(p.id);

      let sent = 0;
      let failed = 0;

      for (const recipient of summary.recipients) {
        try {
          await sendWhatsAppMessage(recipient.phone, summary.summaryText);
          sent++;
          console.log(`[nok-cron] Sent to ${recipient.name} for patient ${p.firstName} ${p.lastName}`);
        } catch (err) {
          console.error(`[nok-cron] Send failed for ${recipient.phone}:`, err);
          failed++;
        }
      }

      results.push({ patientId: p.id, name: `${p.firstName} ${p.lastName}`, sent, failed });

    } catch (err) {
      console.error(`[nok-cron] Failed to process ${p.id}:`, err);
      errors.push({ patientId: p.id, error: (err as Error).message });
    }
  }

  const totalSent = results.reduce((acc, r) => acc + r.sent, 0);

  const response = {
    startedAt:  startedAt.toISOString(),
    patients:   patients.length,
    processed:  results.length,
    totalSent,
    errors:     errors.length,
    results,
    errorDetails: errors,
  };

  console.log(`[nok-cron] Done. Sent ${totalSent} summaries, ${errors.length} errors.`);
  return NextResponse.json(response);
}
