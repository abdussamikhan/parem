/**
 * tts.ts
 *
 * Azure Cognitive Services Text-to-Speech integration.
 *
 * Generates an MP3 audio buffer from a text string using the
 * Azure Neural TTS REST API (no SDK dependency needed).
 *
 * Primary voice: ar-SA-HamedNeural (Arabic, male, Saudi)
 * Fallback voice: ar-SA-ZariyahNeural (Arabic, female, Saudi)
 * English fallback: en-US-JennyNeural
 *
 * Audio is returned as a Buffer so the caller can:
 *   a) upload it somewhere (e.g. Supabase Storage / S3) and send a URL, or
 *   b) upload directly to Twilio's media endpoint (not yet supported in sandbox)
 *
 * For now, sendVoiceReply() encodes as base64 data-URI suitable for debugging.
 * In production, replace with a real storage upload.
 */

const AZURE_TTS_ENDPOINT = (region: string) =>
  `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

type SpeechLanguage = 'ar' | 'en';

function selectVoice(lang: SpeechLanguage): string {
  return lang === 'ar' ? 'ar-SA-HamedNeural' : 'en-US-JennyNeural';
}

function buildSSML(text: string, lang: SpeechLanguage): string {
  const voice = selectVoice(lang);
  const xmlLang = lang === 'ar' ? 'ar-SA' : 'en-US';
  // Escape XML special chars
  const safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return `<speak version='1.0' xml:lang='${xmlLang}'>
  <voice name='${voice}'>
    <prosody rate='0%' pitch='0%'>${safe}</prosody>
  </voice>
</speak>`;
}

/**
 * Calls the Azure TTS REST API and returns the raw MP3 Buffer.
 * Returns null if Azure TTS is not configured or an error occurs.
 */
export async function synthesiseSpeech(
  text: string,
  lang: SpeechLanguage = 'ar',
): Promise<Buffer | null> {
  const key    = process.env.AZURE_TTS_KEY;
  const region = process.env.AZURE_TTS_REGION || 'eastus';

  if (!key) {
    console.warn('[tts] AZURE_TTS_KEY not set — skipping TTS synthesis');
    return null;
  }

  const ssml = buildSSML(text, lang);

  try {
    const res = await fetch(AZURE_TTS_ENDPOINT(region), {
      method:  'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type':              'application/ssml+xml',
        'X-Microsoft-OutputFormat':  'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent':                'parem-health/1.0',
      },
      body: ssml,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[tts] Azure TTS error HTTP ${res.status}:`, errText);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);

  } catch (err) {
    console.error('[tts] Azure TTS fetch failed:', err);
    return null;
  }
}

/**
 * Uploads the MP3 buffer to Twilio's media store and returns a public URL
 * that can be attached to a Twilio WhatsApp message as mediaUrl.
 *
 * NOTE: Twilio's sandbox does not support media uploads.  In production,
 * upload to a public-accessible CDN (e.g. Supabase Storage, S3, Azure Blob)
 * and return that URL instead.
 *
 * This implementation uploads to Twilio's /Assets endpoint (available on
 * paid accounts with Programmable Voice or Conversations enabled).
 *
 * Returns null if upload fails or credentials are missing.
 */
export async function uploadAudioToTwilio(
  audioBuffer: Buffer,
  filename: string = 'reply.mp3',
): Promise<string | null> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const formData    = new FormData();
    formData.append(
      'Content',
      new Blob([new Uint8Array(audioBuffer)], { type: 'audio/mpeg' }),
      filename,
    );

    const res = await fetch(
      `https://media.twiliocdn.com/accounts/${accountSid}/MediaFiles`,
      {
        method:  'POST',
        headers: { Authorization: `Basic ${credentials}` },
        body:    formData,
      },
    );

    if (!res.ok) {
      console.warn('[tts] Twilio media upload HTTP', res.status);
      return null;
    }

    const data = await res.json();
    return (data?.uri as string) ?? null;

  } catch (err) {
    console.error('[tts] Twilio media upload failed:', err);
    return null;
  }
}

/**
 * High-level helper: synthesise text → upload → return media URL.
 * Returns null at any failure point so the caller can gracefully fall back
 * to a text reply.
 */
export async function buildVoiceReplyUrl(
  text: string,
  lang: SpeechLanguage = 'ar',
): Promise<string | null> {
  const audio = await synthesiseSpeech(text, lang);
  if (!audio) return null;
  return uploadAudioToTwilio(audio);
}
