/**
 * POST /api/cron/risk-score
 *
 * Nightly cron endpoint.
 * - Iterates all consented patients
 * - Scores each via riskEngine (6-feature LLM vector)
 * - Sends proactive outreach:
 *     HIGH   → WhatsApp alert to care team + patient
 *     MEDIUM → WhatsApp check-in prompt to patient
 * - Returns a summary JSON with per-patient results
 *
 * Call via: POST /api/cron/risk-score  (n8n schedule trigger or cURL)
 * Protected by CRON_SECRET header check (x-cron-secret).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { scorePatient } from '@/app/lib/riskEngine';
import { sendWhatsAppMessage } from '@/app/lib/twilio';
import { RiskLevel } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Outreach message templates
const HIGH_CARE_TEAM_MSG = (name: string, phone: string, rationale: string) =>
  `⚠️ HIGH RISK ALERT\nPatient: ${name} (${phone})\nReason: ${rationale}\nPlease review and initiate contact within 2 hours.`;

const HIGH_PATIENT_MSG =
  `مرحباً، لاحظ فريق رعايتك بعض المؤشرات التي تستدعي المتابعة. سيتواصل معك أحد أعضاء الفريق قريباً. إذا كنت تشعر بتوعك شديد، يرجى الاتصال بالطوارئ.`;

const MEDIUM_PATIENT_MSG =
  `مرحباً! 😊 نتمنى أن تكون بخير. هل تناولت أدويتك اليوم؟ لا تتردد في مشاركتنا أي أعراض أو استفسارات.`;

export async function POST(req: NextRequest) {
  return runRiskCron(req);
}


async function runRiskCron(req: NextRequest) {
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
  const results: Array<{
    patientId:   string;
    name:        string;
    level:       RiskLevel;
    rationale:   string;
    outreach:    string;
  }> = [];
  const errors:  Array<{ patientId: string; error: string }> = [];

  // ── Fetch all consented patients ────────────────────────────────────────────
  const patients = await prisma.patient.findMany({
    where:  { consentGiven: true },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });

  console.log(`[risk-cron] Starting risk scoring for ${patients.length} patients`);

  // ── Score each patient sequentially (avoids LLM rate-limit hammering) ───────
  for (const p of patients) {
    try {
      const result = await scorePatient(p.id);
      let outreach = 'none';

      if (result.level === 'HIGH') {
        // Alert care team
        if (process.env.CARE_TEAM_WHATSAPP) {
          await sendWhatsAppMessage(
            process.env.CARE_TEAM_WHATSAPP,
            HIGH_CARE_TEAM_MSG(`${p.firstName} ${p.lastName}`, p.phone, result.rationale),
          );
        }
        // Alert patient
        await sendWhatsAppMessage(p.phone, HIGH_PATIENT_MSG);
        outreach = 'high-alert';
        console.log(`[risk-cron] HIGH risk: ${p.firstName} ${p.lastName} — outreach sent`);

      } else if (result.level === 'MEDIUM') {
        // Gentle check-in
        await sendWhatsAppMessage(p.phone, MEDIUM_PATIENT_MSG);
        outreach = 'medium-checkin';
        console.log(`[risk-cron] MEDIUM risk: ${p.firstName} ${p.lastName} — check-in sent`);
      }

      results.push({
        patientId: p.id,
        name:      `${p.firstName} ${p.lastName}`,
        level:     result.level,
        rationale: result.rationale,
        outreach,
      });

    } catch (err) {
      console.error(`[risk-cron] Failed to score ${p.id}:`, err);
      errors.push({ patientId: p.id, error: (err as Error).message });
    }
  }

  const summary = {
    scoredAt:   startedAt.toISOString(),
    total:      patients.length,
    scored:     results.length,
    failed:     errors.length,
    breakdown: {
      HIGH:   results.filter(r => r.level === 'HIGH').length,
      MEDIUM: results.filter(r => r.level === 'MEDIUM').length,
      LOW:    results.filter(r => r.level === 'LOW').length,
    },
    results,
    errors,
  };

  console.log('[risk-cron] Completed:', JSON.stringify(summary.breakdown));
  return NextResponse.json(summary);
}
