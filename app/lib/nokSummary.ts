/**
 * nokSummary.ts
 *
 * Generates a warm, family-friendly weekly health update for a patient's
 * next-of-kin and/or registered FamilyMember contacts.
 *
 * Uses llmRouter with task=NOK_SUMMARY → Qwen 2.5 (PRD §6 routing table).
 * The summary covers:
 *   - 7-day medication adherence (% + named medicines)
 *   - Any symptom reports or escalations this week
 *   - Most recent risk level (if scored)
 *   - An encouraging closing note
 *
 * PII handled:
 *   - Patient first name only is included (per PRD §8 consent model)
 *   - NOK name used for personalised greeting
 *   - No phone numbers or IDs embedded in the prompt
 */

import { prisma } from './prisma';
import { llmRouter } from './llmRouter';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SummaryRecipient {
  name:  string;
  phone: string;
  type:  'nextOfKin' | 'familyMember' | 'group';
}

export interface NOKSummaryResult {
  patientId:   string;
  summaryText: string;
  recipients:  SummaryRecipient[];
}

// ─── Context builder ──────────────────────────────────────────────────────────

async function buildPatientContext(patientId: string): Promise<{
  patientFirstName: string;
  adherenceRate:    number;
  takenList:        string[];
  missedList:       string[];
  symptomCount:     number;
  sosCount:         number;
  riskLevel:        string | null;
}> {
  const d7Ago = new Date(Date.now() - 7 * 86_400_000);

  const [patient, adherenceLogs, symptomLogs, sosLogs, latestRisk] = await Promise.all([
    prisma.patient.findUnique({
      where:  { id: patientId },
      select: { firstName: true },
    }),
    prisma.adherenceLog.findMany({
      where:   { patientId, logDate: { gte: d7Ago } },
      include: { medicine: { select: { medicineName: true } } },
    }),
    prisma.conversationLog.count({
      where: { patientId, category: 'SYMPTOM', createdAt: { gte: d7Ago } },
    }),
    prisma.escalation.count({
      where: { patientId, createdAt: { gte: d7Ago } },
    }),
    prisma.riskScore.findFirst({
      where:   { patientId },
      orderBy: { calculatedAt: 'desc' },
      select:  { score: true },
    }),
  ]);

  const taken  = adherenceLogs.filter(l => l.actualResponse === 'TAKEN');
  const missed = adherenceLogs.filter(l => l.actualResponse === 'SKIPPED');
  const total  = adherenceLogs.length;
  const adherenceRate = total > 0 ? Math.round((taken.length / total) * 100) : 100;

  const uniqueMeds = (logs: typeof adherenceLogs) =>
    Array.from(new Set(logs.map(l => l.medicine.medicineName)));

  return {
    patientFirstName: patient?.firstName ?? 'the patient',
    adherenceRate,
    takenList:   uniqueMeds(taken),
    missedList:  uniqueMeds(missed),
    symptomCount: symptomLogs,
    sosCount:     sosLogs,
    riskLevel:    latestRisk?.score ?? null,
  };
}

// ─── LLM summarisation ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a compassionate care assistant for a remote patient monitoring programme. 
Write a warm, reassuring WhatsApp message (under 80 words) to a family member about their relative's health this week.
Tone: caring, non-alarming, encouraging. Use simple Arabic-friendly phrases where appropriate.
Do NOT include any phone numbers, IDs, or medical jargon. End with an encouraging note.`;

async function generateSummaryText(
  nokName:  string,
  ctx: Awaited<ReturnType<typeof buildPatientContext>>,
): Promise<string> {
  const takenStr  = ctx.takenList.length  ? ctx.takenList.join(', ')  : 'none';
  const missedStr = ctx.missedList.length ? ctx.missedList.join(', ') : 'none';
  const riskStr   = ctx.riskLevel ? ` Risk level: ${ctx.riskLevel}.` : '';

  const prompt = `Write a weekly health update for ${nokName} about ${ctx.patientFirstName}.
Data:
- 7-day adherence: ${ctx.adherenceRate}%
- Medicines taken regularly: ${takenStr}
- Medicines missed: ${missedStr}
- Symptom reports this week: ${ctx.symptomCount}
- Emergency escalations: ${ctx.sosCount}${riskStr}`;

  try {
    return await llmRouter('NOK_SUMMARY', prompt, SYSTEM_PROMPT);
  } catch {
    // Hard fallback — always produces something readable
    const emoji = ctx.adherenceRate >= 80 ? '✅' : '⚠️';
    return `${emoji} Dear ${nokName}, ${ctx.patientFirstName} took ${ctx.adherenceRate}% of their medications this week. ${ctx.missedList.length ? `Medicines needing attention: ${ctx.missedList.join(', ')}.` : 'All medications on track.'} ${ctx.sosCount > 0 ? 'There was an emergency alert — the care team has been informed.' : 'No emergencies this week.'} The care team is closely monitoring their progress. 💙`;
  }
}

// ─── Recipient resolution ─────────────────────────────────────────────────────

async function resolveRecipients(patientId: string): Promise<SummaryRecipient[]> {
  const patient = await prisma.patient.findUnique({
    where:   { id: patientId },
    select: {
      nextOfKinName:   true,
      nextOfKinPhone:  true,
      familyGroupMode: true,
      whatsappGroupId: true,
      familyMembers: {
        where:   { consentGiven: true },
        select:  { name: true, phone: true },
      },
    },
  });

  if (!patient) return [];

  const recipients: SummaryRecipient[] = [];

  // If group mode and group ID is set, only send to group
  if (patient.familyGroupMode && patient.whatsappGroupId) {
    recipients.push({
      name:  'Family Group',
      phone: patient.whatsappGroupId,
      type:  'group',
    });
    return recipients;
  }

  // Individual FamilyMember records (Sprint A schema)
  for (const fm of patient.familyMembers) {
    recipients.push({ name: fm.name, phone: fm.phone, type: 'familyMember' });
  }

  // Legacy nextOfKin fields (fallback if no FamilyMember records)
  if (recipients.length === 0 && patient.nextOfKinPhone) {
    recipients.push({
      name:  patient.nextOfKinName ?? 'Family',
      phone: patient.nextOfKinPhone,
      type:  'nextOfKin',
    });
  }

  return recipients;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates and returns a summary for a patient, ready to send.
 * Does NOT send the message — calling code decides delivery.
 */
export async function buildNOKSummary(patientId: string): Promise<NOKSummaryResult> {
  const [ctx, recipients] = await Promise.all([
    buildPatientContext(patientId),
    resolveRecipients(patientId),
  ]);

  // Use first recipient's name for personalisation, or generic "Family"
  const nokName = recipients[0]?.name ?? 'Family';
  const summaryText = await generateSummaryText(nokName, ctx);

  return { patientId, summaryText, recipients };
}
