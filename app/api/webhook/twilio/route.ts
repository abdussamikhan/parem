import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { prisma } from '@/app/lib/prisma';
import { sendWhatsAppMessage } from '@/app/lib/twilio';

import { transcribeVoiceNote, isConfident } from '@/app/lib/whisper';
import { buildVoiceReplyUrl } from '@/app/lib/tts';
import { sanitiseMessage, patientContext, type PatientPII } from '@/app/lib/anonymiser';
import { llmRouter } from '@/app/lib/llmRouter';

// ─── Message classifier ───────────────────────────────────────────────────────

type MessageCategory = 'SOS' | 'ADHERENCE' | 'SYMPTOM' | 'GENERAL';

function classifyMessage(message: string): MessageCategory {
  const m = message.toLowerCase();
  if (/(help|sos|emergency|dying|pain|hospital|chest|breathing|bleeding)/i.test(m)) return 'SOS';
  if (/(yes|no|took it|done|taken|missed|skipped)/i.test(m))                         return 'ADHERENCE';
  if (/(fever|cough|headache|rash|nausea|vomiting|dizzy|ache|hurts)/i.test(m))      return 'SYMPTOM';
  return 'GENERAL';
}

// ─── Reply helper — sends text or voice depending on patient preference ───────

async function replyToPatient(
  to:       string,
  text:     string,
  patient:  { voicePreferred: boolean; id: string },
  lang:     'ar' | 'en' = 'ar',
): Promise<void> {
  if (patient.voicePreferred) {
    const mediaUrl = await buildVoiceReplyUrl(text, lang);
    if (mediaUrl) {
      const { twilioClient } = await import('@/app/lib/twilio');
      if (twilioClient) {
        await twilioClient.messages.create({
          from:     `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
          to:       to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
          body:     text,       // text fallback for notification preview
          mediaUrl: [mediaUrl],
        });
        console.log(`[webhook] Sent voice reply to ${to}`);
        return;
      }
    }
    // TTS failed — fall through to text reply
    console.warn('[webhook] TTS failed; falling back to text reply');
  }
  await sendWhatsAppMessage(to, text);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      // Validate Twilio signature (Sprint 0 fix)
      const authToken  = process.env.TWILIO_AUTH_TOKEN  || '';
      const webhookUrl = process.env.TWILIO_WEBHOOK_URL || '';
      const signature  = req.headers.get('x-twilio-signature') || '';

      const rawBody = await req.text();
      const params: Record<string, string> = {};
      new URLSearchParams(rawBody).forEach((v, k) => { params[k] = v; });

      if (!twilio.validateRequest(authToken, signature, webhookUrl, params)) {
        console.warn('[webhook] Invalid Twilio signature — rejected');
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      return handleWebhook(new URLSearchParams(rawBody));
    }

    // Dev: skip signature check
    const fd = await req.formData();
    const params = new URLSearchParams();
    fd.forEach((v, k) => params.set(k, v.toString()));
    return handleWebhook(params);

  } catch (err) {
    console.error('[webhook] Unhandled error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// ─── Core handler ─────────────────────────────────────────────────────────────

async function handleWebhook(fd: URLSearchParams) {
  try {
    const from = fd.get('From');
    if (!from) return NextResponse.json({ error: 'Missing From' }, { status: 400 });

    const phoneNumber = from.replace('whatsapp:', '');

    // ── Look up patient ───────────────────────────────────────────────────────
    const patient = await prisma.patient.findUnique({ where: { phone: phoneNumber } });
    if (!patient) {
      await sendWhatsAppMessage(from, "I'm sorry, I couldn't find your patient record. Please contact the clinic.");
      return NextResponse.json({ success: true });
    }

    // ── Detect message type: audio or text ────────────────────────────────────
    const numMedia       = parseInt(fd.get('NumMedia') ?? '0', 10);
    const mediaType      = fd.get('MediaContentType0') ?? '';
    const mediaUrl       = fd.get('MediaUrl0')         ?? '';
    const isAudioMessage = numMedia > 0 && mediaType.startsWith('audio/');

    let messageText: string;
    let isVoiceNote = false;

    if (isAudioMessage) {
      isVoiceNote = true;
      console.log(`[webhook] Audio message received from ${phoneNumber}, type: ${mediaType}`);

      const whisperResult = await transcribeVoiceNote(mediaUrl);

      if (!isConfident(whisperResult) || !whisperResult.transcript) {
        // Confidence below threshold — ask patient to repeat
        const retryMsg = patient.voicePreferred
          ? 'عذراً، لم أتمكن من فهم رسالتك الصوتية بشكل صحيح. هل يمكنك إعادة الإرسال؟'
          : "Sorry, I couldn't understand your voice message clearly. Could you please send it again, or type your message?";
        await replyToPatient(from, retryMsg, patient, 'ar');
        // Log the attempt
        await prisma.conversationLog.create({
          data: {
            patientId:  patient.id,
            messageIn:  `[voice note — low confidence: ${whisperResult.confidence.toFixed(2)}]`,
            messageOut: retryMsg,
            category:   'GENERAL',
          },
        });
        return NextResponse.json({ success: true, action: 'low_confidence_retry' });
      }

      messageText = whisperResult.transcript;
      console.log(`[webhook] Transcribed (${whisperResult.confidence.toFixed(2)}): "${messageText}"`);
    } else {
      messageText = fd.get('Body') ?? '';
      if (!messageText) return NextResponse.json({ error: 'Empty body' }, { status: 400 });
    }

    // ── Anonymise for LLM calls ───────────────────────────────────────────────
    const pii: PatientPII = {
      id:                patient.id,
      firstName:         patient.firstName,
      lastName:          patient.lastName,
      phone:             patient.phone,
      age:               patient.age,
      gender:            patient.gender,
      conditionCategory: patient.conditionCategory,
    };
    const ctx            = patientContext(pii);
    const safeMessage    = sanitiseMessage(messageText);
    const lang: 'ar' | 'en' = isVoiceNote ? 'ar' : 'en';

    // ── Classify ──────────────────────────────────────────────────────────────
    const category = classifyMessage(messageText);

    // ── Log conversation ──────────────────────────────────────────────────────
    await prisma.conversationLog.create({
      data: {
        patientId: patient.id,
        messageIn: isVoiceNote ? `[voice] ${messageText}` : messageText,
        category,
      },
    });

    // ── Route & respond ───────────────────────────────────────────────────────
    if (category === 'SOS') {
      await prisma.escalation.create({
        data: { patientId: patient.id, trigger: 'SOS', patientMessage: messageText },
      });

      const reply = '🚨 EMERGENCY PROTOCOL INITIATED. Your care team has been notified immediately. If you are experiencing a life-threatening emergency, please dial your local emergency number.';
      await replyToPatient(from, reply, patient, lang);

      if (process.env.CARE_TEAM_WHATSAPP) {
        await sendWhatsAppMessage(
          process.env.CARE_TEAM_WHATSAPP,
          `🚨 URGENT: SOS from ${patient.firstName} ${patient.lastName} (${patient.phone}). Message: "${messageText}"`,
        );
      }

    } else if (category === 'SYMPTOM') {
      // Use anonymised message for LLM call
      const prompt = `${ctx}\n\nPatient reports: "${safeMessage}"\n\nAssess severity and respond concisely (≤50 words). If life-threatening (chest pain, severe breathing difficulty, major bleeding) reply with exactly: SOS_TRIGGERED`;
      const response = await llmRouter('SYMPTOM_TRIAGE', prompt);

      if (response.includes('SOS_TRIGGERED')) {
        await prisma.escalation.create({
          data: { patientId: patient.id, trigger: 'SYMPTOM', patientMessage: messageText, aiResponse: response },
        });
        const reply = 'Based on your symptoms, I have notified your care team immediately. Please seek emergency medical care if symptoms worsen.';
        await replyToPatient(from, reply, patient, lang);
      } else {
        await replyToPatient(from, response, patient, lang);
      }

    } else if (category === 'ADHERENCE') {
      const latestSchedule = await prisma.schedule.findFirst({
        where:   { patientId: patient.id, status: { in: ['SENT', 'PENDING'] } },
        orderBy: { reminderTime: 'asc' },
      });

      if (latestSchedule) {
        const isYes      = /(yes|took it|done|taken)/i.test(messageText);
        const newStatus  = isYes ? 'TAKEN' : 'MISSED';

        await prisma.schedule.update({ where: { id: latestSchedule.id }, data: { status: newStatus } });

        await prisma.adherenceLog.create({
          data: {
            patientId:      patient.id,
            medicineId:     latestSchedule.medicineId,
            logDate:        new Date(),
            scheduledTime:  latestSchedule.reminderTime,
            actualResponse: isYes ? 'TAKEN' : 'SKIPPED',
            responseTime:   new Date(),
            status:         messageText,
          },
        });

        const reply = isYes
          ? "Great job taking your medication! I've logged it. 💊"
          : "I've logged that you missed this dose. Please consult your doctor if you have concerns.";
        await replyToPatient(from, reply, patient, lang);
      } else {
        const reply = "I logged your message, but I couldn't find a pending medication reminder for you right now.";
        await replyToPatient(from, reply, patient, lang);
      }

    } else {
      // GENERAL — route through llmRouter with anonymised prompt
      const prompt   = `${ctx}\n\nPatient message: "${safeMessage}"\n\nRespond in a compassionate, concise way (≤50 words). Do not diagnose.`;
      const response = await llmRouter('GENERAL', prompt);
      await replyToPatient(from, response, patient, lang);
    }

    return NextResponse.json({ success: true, category, voiceNote: isVoiceNote });

  } catch (err) {
    console.error('[webhook] Handler error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
