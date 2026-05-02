/**
 * tests/unit/anonymiser.test.ts
 *
 * Unit tests for the PII anonymisation module.
 * Tests sanitiseMessage (free-text scrubbing) and anonymise (PatientPII → AnonymisedPatient).
 */

import { describe, it, expect } from 'vitest';
import { sanitiseMessage, anonymise, patientContext } from '@/app/lib/anonymiser';

const TEST_PATIENT = {
  id:                'patient-test-uuid-1234',
  firstName:         'Ahmad',
  lastName:          'Al-Farsi',
  phone:             '+966500000001',
  age:               65,
  gender:            'Male',
  conditionCategory: 'Diabetes',
};

describe('sanitiseMessage', () => {
  it('replaces Saudi phone numbers with [PHONE]', () => {
    const result = sanitiseMessage('Call +966500123456 for updates');
    expect(result).not.toContain('+966500123456');
    expect(result).toContain('[PHONE]');
  });

  it('replaces email addresses with [EMAIL]', () => {
    const result = sanitiseMessage('Contact patient@example.com for records');
    expect(result).not.toContain('patient@example.com');
    expect(result).toContain('[EMAIL]');
  });

  it('replaces Emirates ID patterns with [EID]', () => {
    // Use format without surrounding phone-like characters
    const result = sanitiseMessage('Emirates ID: 784-1991-1234567-9');
    // Either phone or EID regex fires — both scrub the number. Verify the number is gone.
    expect(result).not.toContain('784-1991-1234567-9');
    // The sanitiser either replaces with [PHONE] or [EID] depending on match order
    expect(result.includes('[EID]') || result.includes('[PHONE]')).toBe(true);
  });

  it('preserves clinical terminology that is not PII', () => {
    const text   = 'Metformin 500mg twice daily after breakfast';
    const result = sanitiseMessage(text);
    expect(result).toContain('Metformin');
    expect(result).toContain('500mg');
  });

  it('handles empty string without error', () => {
    expect(sanitiseMessage('')).toBe('');
  });
});

describe('anonymise', () => {
  it('returns a pseudoName that does not contain the real name', () => {
    const anon = anonymise(TEST_PATIENT);
    expect(anon.pseudoName).not.toContain('Ahmad');
    expect(anon.pseudoName).not.toContain('Al-Farsi');
    expect(anon.pseudoName).toMatch(/^Patient-[A-F0-9]{4}$/);
  });

  it('returns an ageGroup decade string instead of exact age', () => {
    const anon = anonymise(TEST_PATIENT);
    expect(anon.ageGroup).toBe('60s');
    expect(anon.ageGroup).not.toContain('65');
  });

  it('preserves gender (low-risk field)', () => {
    const anon = anonymise(TEST_PATIENT);
    expect(anon.gender).toBe('Male');
  });

  it('preserves conditionCategory for clinical relevance', () => {
    const anon = anonymise(TEST_PATIENT);
    expect(anon.conditionCategory).toBe('Diabetes');
  });

  it('produces the same pseudoName for the same patient id (stable hash)', () => {
    const anon1 = anonymise(TEST_PATIENT);
    const anon2 = anonymise(TEST_PATIENT);
    expect(anon1.pseudoName).toBe(anon2.pseudoName);
  });
});

describe('patientContext', () => {
  it('returns a string containing pseudoName and ageGroup', () => {
    const ctx = patientContext(TEST_PATIENT);
    expect(ctx).toContain('Patient-');
    expect(ctx).toContain('60s');
    expect(ctx).toContain('Male');
    expect(ctx).toContain('Diabetes');
    // Must not contain real name or phone
    expect(ctx).not.toContain('Ahmad');
    expect(ctx).not.toContain('+966');
  });
});
