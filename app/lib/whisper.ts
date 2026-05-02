/**
 * whisper.ts
 *
 * Downloads an OGG audio file from Twilio (authenticated) and submits it
 * to the Ollama Whisper Large V3 model for transcription.
 *
 * Returns: { transcript, confidence, language }
 * If the model returns no confidence, we default to 1.0 when the transcript
 * is non-empty and 0 when it is empty, keeping the confidence gate simple.
 */

export interface WhisperResult {
  transcript: string;
  confidence: number;   // 0.0 – 1.0
  language:   string;   // e.g. "ar", "en"
}

const WHISPER_CONFIDENCE_THRESHOLD = 0.75;

/**
 * Downloads the audio file from Twilio's media URL.
 * Twilio requires Basic-auth (accountSid:authToken) to fetch media.
 */
async function downloadAudio(mediaUrl: string): Promise<Buffer> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
  const authToken  = process.env.TWILIO_AUTH_TOKEN  || '';
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const res = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to download audio from Twilio: HTTP ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Transcribes an OGG/audio buffer using Ollama's Whisper endpoint.
 *
 * Ollama Whisper endpoint: POST /api/generate
 * Body: { model, prompt, images: [base64audio] }  (non-standard but matches local Ollama Whisper)
 *
 * For Ollama Cloud Whisper, the API key is OLLAMA_WHISPER_KEY.
 */
async function transcribeWithOllama(audioBuffer: Buffer): Promise<WhisperResult> {
  const base64Audio = audioBuffer.toString('base64');
  const ollamaBase  = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || 'http://localhost:11434';
  const whisperKey  = process.env.OLLAMA_WHISPER_KEY;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (whisperKey) headers['Authorization'] = `Bearer ${whisperKey}`;

  const res = await fetch(`${ollamaBase}/api/generate`, {
    method:  'POST',
    headers,
    body: JSON.stringify({
      model:  'whisper',
      prompt: 'Transcribe the following audio. Return JSON: {"transcript":"...","confidence":0.95,"language":"ar"}',
      images: [base64Audio],
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama Whisper error: HTTP ${res.status}`);
  }

  const data = await res.json();
  const raw: string = data?.response ?? '';

  // Try to parse a JSON blob from the model's free-text output
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<WhisperResult>;
      return {
        transcript: parsed.transcript ?? '',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : (parsed.transcript ? 1.0 : 0),
        language:   parsed.language   ?? 'ar',
      };
    } catch {
      // fall through to plain-text handling
    }
  }

  // If the model returned plain text instead of JSON, treat it as the transcript
  const transcript = raw.trim();
  return {
    transcript,
    confidence: transcript.length > 0 ? 1.0 : 0,
    language:   'ar',
  };
}

/**
 * Full voice-note processing pipeline:
 *   1. Download OGG from Twilio
 *   2. Transcribe via Ollama Whisper
 *   3. Return result for downstream routing
 *
 * @param mediaUrl  - The MediaUrl0 value from the Twilio webhook payload
 */
export async function transcribeVoiceNote(mediaUrl: string): Promise<WhisperResult> {
  const audioBuffer = await downloadAudio(mediaUrl);
  return transcribeWithOllama(audioBuffer);
}

/**
 * Returns true if the transcript confidence meets the minimum threshold.
 * Below threshold → ask the patient to repeat.
 */
export function isConfident(result: WhisperResult): boolean {
  return result.confidence >= WHISPER_CONFIDENCE_THRESHOLD;
}

export { WHISPER_CONFIDENCE_THRESHOLD };
