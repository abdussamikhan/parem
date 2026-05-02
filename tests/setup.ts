/**
 * tests/setup.ts
 *
 * Global test setup:
 * - Mocks Prisma client so tests never hit a real database
 * - Mocks external services (Twilio, Azure TTS, Groq) to prevent
 *   outbound HTTP during CI
 * - Seeds vi.stubEnv with safe test credentials
 */

import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// ── Environment ───────────────────────────────────────────────────────────────
beforeAll(() => {
  vi.stubEnv('DATABASE_URL',          'postgresql://test:test@localhost:5432/parem_test');
  vi.stubEnv('GROQ_API_KEY',          'test-groq-key');
  vi.stubEnv('OLLAMA_BASE_URL',       'http://localhost:11434');
  vi.stubEnv('TWILIO_ACCOUNT_SID',    'ACtest000000000000000000000000000000');
  vi.stubEnv('TWILIO_AUTH_TOKEN',     'test-auth-token');
  vi.stubEnv('TWILIO_WHATSAPP_FROM',  'whatsapp:+15550000000');
  vi.stubEnv('AZURE_TTS_KEY',         'test-azure-key');
  vi.stubEnv('AZURE_TTS_REGION',      'eastus');
  vi.stubEnv('CARE_TEAM_WHATSAPP',    '+15559999999');
  vi.stubEnv('CRON_SECRET',           'test-cron-secret');
});

// ── Prisma mock ───────────────────────────────────────────────────────────────
vi.mock('@/app/lib/prisma', () => ({
  prisma: {
    patient:       makeMock(),
    medicine:      makeMock(),
    adherenceLog:  makeMock(),
    escalation:    makeMock(),
    conversationLog: makeMock(),
    riskScore:     makeMock(),
    familyMember:  makeMock(),
    appointment:   makeMock(),
    $queryRaw:     vi.fn().mockResolvedValue([]),
    $disconnect:   vi.fn(),
  },
}));

function makeMock() {
  return {
    findUnique:  vi.fn(),
    findFirst:   vi.fn(),
    findMany:    vi.fn().mockResolvedValue([]),
    create:      vi.fn(),
    update:      vi.fn(),
    upsert:      vi.fn(),
    delete:      vi.fn(),
    count:       vi.fn().mockResolvedValue(0),
    deleteMany:  vi.fn().mockResolvedValue({ count: 0 }),
  };
}

// ── External service mocks ────────────────────────────────────────────────────
vi.mock('@/app/lib/twilio', () => ({
  sendWhatsAppMessage: vi.fn().mockResolvedValue({ sid: 'SM-test-000' }),
  twilioClient:        { messages: { create: vi.fn().mockResolvedValue({ sid: 'SM-test-000' }) } },
}));

vi.mock('@/app/lib/groq', () => ({
  groq: {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mocked LLM response' } }],
        }),
      },
    },
  },
}));

vi.mock('@/app/lib/anonymiser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/anonymiser')>();
  return { ...actual }; // pass-through: no mocking needed for pure functions
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.unstubAllEnvs();
});
