/**
 * riskEngine.ts
 *
 * Computes a risk stratification score for a single patient using a
 * 6-feature vector (wearables descoped per Sprint A decision).
 *
 * Feature vector:
 *   F1  7-day medication adherence rate          (0–100%)
 *   F2  Missed appointments in last 30 days      (count)
 *   F3  Symptom reports in last 14 days          (count)
 *   F4  SOS escalations in last 30 days          (count)
 *   F5  Days since last patient message          (recency)
 *   F6  Age (years)                              (risk proxy)
 *
 * The feature vector is embedded in a structured LLM prompt and the model
 * returns { level: "LOW"|"MEDIUM"|"HIGH", rationale: "..." }.
 * The result is persisted to the RiskScore table.
 */

import { prisma } from './prisma';
import { llmRouter } from './llmRouter';
import { RiskLevel } from '@prisma/client';

// ─── Feature Types ────────────────────────────────────────────────────────────

export interface RiskFeatureVector {
  patientId:          string;
  adherenceRate:      number;   // F1: 0–100
  missedAppointments: number;   // F2
  symptomReports:     number;   // F3
  sosEscalations:     number;   // F4
  daysSinceLastMsg:   number;   // F5
  age:                number;   // F6
  conditionCategory:  string | null;
}

export interface RiskResult {
  level:     RiskLevel;
  rationale: string;
  features:  RiskFeatureVector;
}

// ─── Feature extraction ───────────────────────────────────────────────────────

async function extractFeatures(patientId: string): Promise<RiskFeatureVector> {
  const now       = new Date();
  const d7Ago     = new Date(now.getTime() - 7  * 86_400_000);
  const d14Ago    = new Date(now.getTime() - 14 * 86_400_000);
  const d30Ago    = new Date(now.getTime() - 30 * 86_400_000);

  // Pull patient meta in parallel with log queries
  const [patient, adherenceLogs, appointments, symptomLogs, sosLogs, lastMsg] =
    await Promise.all([
      prisma.patient.findUnique({ where: { id: patientId }, select: { age: true, conditionCategory: true } }),
      prisma.adherenceLog.findMany({
        where: { patientId, logDate: { gte: d7Ago } },
        select: { actualResponse: true },
      }),
      prisma.appointment.findMany({
        where: { patientId, scheduledAt: { gte: d30Ago, lte: now }, attended: false },
        select: { id: true },
      }),
      prisma.conversationLog.findMany({
        where: { patientId, category: 'SYMPTOM', createdAt: { gte: d14Ago } },
        select: { id: true },
      }),
      prisma.escalation.findMany({
        where: { patientId, createdAt: { gte: d30Ago } },
        select: { id: true },
      }),
      prisma.conversationLog.findFirst({
        where:   { patientId },
        orderBy: { createdAt: 'desc' },
        select:  { createdAt: true },
      }),
    ]);

  // F1: adherence rate
  const taken  = adherenceLogs.filter(l => l.actualResponse === 'TAKEN').length;
  const total  = adherenceLogs.length;
  const adherenceRate = total > 0 ? Math.round((taken / total) * 100) : 100; // no data → assume compliant

  // F5: recency
  const daysSinceLastMsg = lastMsg
    ? Math.floor((now.getTime() - lastMsg.createdAt.getTime()) / 86_400_000)
    : 999; // never messaged → very stale

  return {
    patientId,
    adherenceRate,
    missedAppointments: appointments.length,
    symptomReports:     symptomLogs.length,
    sosEscalations:     sosLogs.length,
    daysSinceLastMsg,
    age:                patient?.age ?? 0,
    conditionCategory:  patient?.conditionCategory ?? null,
  };
}

// ─── LLM scoring ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a clinical risk stratification engine for a remote patient monitoring programme.
You will receive a 6-feature vector for a patient and must output ONLY valid JSON in this exact schema:
{"level":"LOW"|"MEDIUM"|"HIGH","rationale":"one concise sentence ≤25 words"}

Rules:
- HIGH  → any SOS in 30d, OR adherence <50%, OR ≥3 symptom reports, OR daysSinceLastMsg >14
- MEDIUM → adherence 50–79%, OR 1–2 symptom reports, OR missed appointment, OR age >70
- LOW   → all other cases`;

async function scoreWithLLM(features: RiskFeatureVector): Promise<{ level: RiskLevel; rationale: string }> {
  const prompt = `Patient features:
- 7-day adherence rate: ${features.adherenceRate}%
- Missed appointments (30d): ${features.missedAppointments}
- Symptom reports (14d): ${features.symptomReports}
- SOS escalations (30d): ${features.sosEscalations}
- Days since last message: ${features.daysSinceLastMsg}
- Age: ${features.age} years
- Condition: ${features.conditionCategory ?? 'unspecified'}

Classify risk level and provide rationale.`;

  const raw = await llmRouter('RISK_SCORE', prompt, SYSTEM_PROMPT);

  // Parse the JSON block the model returns
  const jsonMatch = raw.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { level?: string; rationale?: string };
      const level = (['LOW', 'MEDIUM', 'HIGH'].includes(parsed.level ?? ''))
        ? (parsed.level as RiskLevel)
        : deriveRuleBased(features);
      return { level, rationale: parsed.rationale ?? '' };
    } catch {
      // fall through to rule-based
    }
  }

  console.warn('[riskEngine] LLM did not return valid JSON — using rule-based fallback');
  return { level: deriveRuleBased(features), rationale: 'Rule-based classification (LLM parse failed)' };
}

/** Deterministic rule-based fallback — used when the LLM fails to return parseable JSON. */
function deriveRuleBased(f: RiskFeatureVector): RiskLevel {
  if (
    f.sosEscalations > 0 ||
    f.adherenceRate < 50 ||
    f.symptomReports >= 3 ||
    f.daysSinceLastMsg > 14
  ) return RiskLevel.HIGH;

  if (
    f.adherenceRate < 80 ||
    f.symptomReports >= 1 ||
    f.missedAppointments > 0 ||
    f.age > 70
  ) return RiskLevel.MEDIUM;

  return RiskLevel.LOW;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

async function persistScore(result: RiskResult): Promise<void> {
  await prisma.riskScore.create({
    data: {
      patientId:   result.features.patientId,
      score:       result.level,
      rationale:   result.rationale,
      rawFeatures: result.features as object,
    },
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Scores a single patient: extract features → LLM → persist → return result.
 */
export async function scorePatient(patientId: string): Promise<RiskResult> {
  const features = await extractFeatures(patientId);
  const { level, rationale } = await scoreWithLLM(features);
  const result: RiskResult = { level, rationale, features };
  await persistScore(result);
  return result;
}

/**
 * Fetches the most recent RiskScore for a patient (or null if never scored).
 */
export async function latestRiskScore(patientId: string) {
  return prisma.riskScore.findFirst({
    where:   { patientId },
    orderBy: { calculatedAt: 'desc' },
  });
}

/**
 * Fetches historical RiskScores for a patient, newest first, with a limit.
 */
export async function riskHistory(patientId: string, limit = 30) {
  return prisma.riskScore.findMany({
    where:   { patientId },
    orderBy: { calculatedAt: 'desc' },
    take:    limit,
  });
}
