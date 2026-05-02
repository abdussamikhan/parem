import { groq } from './groq';

// ─── Task types ───────────────────────────────────────────────────────────────

/**
 * Task types map to specific Ollama Cloud models per the PRD LLM routing spec.
 *
 * SYMPTOM_TRIAGE  → BioMistral (clinical knowledge)
 * RISK_SCORE      → Llama 3.3 (structured JSON reasoning)
 * NOK_SUMMARY     → Qwen (warm, family-friendly tone)
 * REMINDER        → Llama 3.3 (personalised message generation)
 * GENERAL         → Llama 3.3 (fallback conversational)
 */
export type LLMTask =
  | 'SYMPTOM_TRIAGE'
  | 'RISK_SCORE'
  | 'NOK_SUMMARY'
  | 'REMINDER'
  | 'GENERAL';

// ─── Config ───────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 8_000;

interface OllamaCloudModel {
  name: string;
  apiKey: string;
}

/** Returns the primary Ollama Cloud model for a given task. */
function primaryModel(task: LLMTask): OllamaCloudModel | null {
  const base = process.env.OLLAMA_BASE_URL;
  if (!base) return null;

  const models: Record<LLMTask, OllamaCloudModel | null> = {
    SYMPTOM_TRIAGE: process.env.OLLAMA_BIO_KEY
      ? { name: 'biomistral', apiKey: process.env.OLLAMA_BIO_KEY }
      : null,
    RISK_SCORE: process.env.OLLAMA_LLAMA_KEY
      ? { name: 'llama3.3', apiKey: process.env.OLLAMA_LLAMA_KEY }
      : null,
    NOK_SUMMARY: process.env.OLLAMA_QWEN_KEY
      ? { name: 'qwen2.5', apiKey: process.env.OLLAMA_QWEN_KEY }
      : null,
    REMINDER: process.env.OLLAMA_LLAMA_KEY
      ? { name: 'llama3.3', apiKey: process.env.OLLAMA_LLAMA_KEY }
      : null,
    GENERAL: process.env.OLLAMA_LLAMA_KEY
      ? { name: 'llama3.3', apiKey: process.env.OLLAMA_LLAMA_KEY }
      : null,
  };

  return models[task];
}

/** Returns the Llama fallback model (used when primary fails). */
function llamaFallback(): OllamaCloudModel | null {
  if (!process.env.OLLAMA_LLAMA_KEY) return null;
  return { name: 'llama3.3', apiKey: process.env.OLLAMA_LLAMA_KEY };
}

// ─── Ollama Cloud caller ──────────────────────────────────────────────────────

async function callOllamaCloud(
  model: OllamaCloudModel,
  prompt: string,
  systemPrompt?: string,
): Promise<string> {
  const baseUrl = process.env.OLLAMA_BASE_URL!;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify({
        model:  model.name,
        stream: false,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Ollama Cloud HTTP ${res.status}`);

    const data = await res.json();
    // Ollama Cloud returns { message: { content: '...' } }
    const content = data?.message?.content ?? data?.response;
    if (!content) throw new Error('Empty response from Ollama Cloud');
    return content as string;

  } finally {
    clearTimeout(timer);
  }
}

// ─── Groq fallback ────────────────────────────────────────────────────────────

async function callGroqFallback(prompt: string, systemPrompt?: string): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    max_tokens: 400,
    messages: [
      ...(systemPrompt
        ? [{ role: 'system' as const, content: systemPrompt }]
        : []),
      { role: 'user' as const, content: prompt },
    ],
  });
  return completion.choices[0]?.message?.content ?? '';
}

// ─── Public router ────────────────────────────────────────────────────────────

/**
 * Routes a prompt to the appropriate model based on task type.
 *
 * Fallback chain (per PRD §6):
 *   1. Primary Ollama Cloud model for task (8s timeout)
 *   2. Llama 3.3 on Ollama Cloud          (8s timeout)
 *   3. Groq llama-3.3-70b-versatile       (cloud backup)
 *
 * @param task        - The clinical task type determining model selection
 * @param prompt      - The user / system-generated prompt (must already be anonymised)
 * @param systemPrompt - Optional system instruction
 * @returns AI-generated response string
 */
export async function llmRouter(
  task: LLMTask,
  prompt: string,
  systemPrompt?: string,
): Promise<string> {
  // Stage 1 — primary specialist model
  const primary = primaryModel(task);
  if (primary) {
    try {
      const result = await callOllamaCloud(primary, prompt, systemPrompt);
      console.log(`[llmRouter] ${task} → ${primary.name} (primary) ✓`);
      return result;
    } catch (err) {
      console.warn(`[llmRouter] ${task} → ${primary.name} failed:`, (err as Error).message);
    }
  }

  // Stage 2 — Llama fallback on Ollama Cloud (only if primary wasn't already Llama)
  const fallback = llamaFallback();
  if (fallback && fallback.name !== primary?.name) {
    try {
      const result = await callOllamaCloud(fallback, prompt, systemPrompt);
      console.log(`[llmRouter] ${task} → ${fallback.name} (ollama-fallback) ✓`);
      return result;
    } catch (err) {
      console.warn(`[llmRouter] ${task} → ${fallback.name} failed:`, (err as Error).message);
    }
  }

  // Stage 3 — Groq cloud (always available)
  try {
    const result = await callGroqFallback(prompt, systemPrompt);
    console.log(`[llmRouter] ${task} → groq (cloud-fallback) ✓`);
    return result;
  } catch (err) {
    console.error(`[llmRouter] ${task} → groq also failed:`, (err as Error).message);
    throw new Error(`All LLM backends failed for task: ${task}`);
  }
}
