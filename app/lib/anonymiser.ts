import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PatientPII {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  age: number;
  gender: string;
  conditionCategory?: string | null;
}

export interface AnonymisedPatient {
  pseudoName: string;   // e.g. "Patient-A3F2"
  ageGroup: string;     // e.g. "60s"
  gender: string;       // kept as-is (low-risk)
  conditionCategory: string | null;
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Produces a stable 4-char hex code for a patient id.
 * Same patient always gets the same suffix within and across sessions.
 */
function patientTag(patientId: string): string {
  return createHash('sha256')
    .update(patientId)
    .digest('hex')
    .slice(0, 4)
    .toUpperCase();
}

/** Buckets age into a decade string to preserve clinical relevance without exact DOB. */
function ageGroup(age: number): string {
  const decade = Math.floor(age / 10) * 10;
  return `${decade}s`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Converts a PatientPII object into an AnonymisedPatient safe to embed in LLM prompts.
 *
 * Usage:
 *   const anon = anonymise(patient);
 *   const prompt = `Patient ${anon.pseudoName}, ${anon.ageGroup} ${anon.gender}, reports: "${message}"`;
 */
export function anonymise(patient: PatientPII): AnonymisedPatient {
  return {
    pseudoName:        `Patient-${patientTag(patient.id)}`,
    ageGroup:          ageGroup(patient.age),
    gender:            patient.gender,
    conditionCategory: patient.conditionCategory ?? null,
  };
}

/**
 * Sanitises a free-text message from a patient:
 *   - strips phone numbers
 *   - strips email addresses
 *   - strips national ID / Emirates ID patterns
 */
export function sanitiseMessage(text: string): string {
  return text
    // Phone numbers (international + local formats)
    .replace(/(\+?\d[\d\s\-().]{7,}\d)/g, '[PHONE]')
    // Email addresses
    .replace(/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi, '[EMAIL]')
    // Emirates ID (784-XXXX-XXXXXXX-X)
    .replace(/784-?\d{4}-?\d{7}-?\d/g, '[EID]')
    // Generic sequences that look like national IDs (10+ digits)
    .replace(/\b\d{10,}\b/g, '[ID]');
}

/**
 * Builds a safe, anonymised prompt fragment describing the patient context.
 * Use this at the start of any LLM prompt that references patient data.
 *
 * Example output:
 *   "Clinical context: Patient-A3F2, 60s, Male, Diabetes."
 */
export function patientContext(patient: PatientPII): string {
  const anon = anonymise(patient);
  const condition = anon.conditionCategory ? `, ${anon.conditionCategory}` : '';
  return `Clinical context: ${anon.pseudoName}, ${anon.ageGroup}, ${anon.gender}${condition}.`;
}
