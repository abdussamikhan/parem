import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { sendWhatsAppMessage } from '@/app/lib/twilio';
import { generateGeneralResponse } from '@/app/lib/groq';
import { queryLocalHealthcareModel } from '@/app/lib/ollama';

// Helper to determine message type
async function classifyMessage(message: string): Promise<'SOS' | 'ADHERENCE' | 'SYMPTOM' | 'GENERAL'> {
  const lowerMsg = message.toLowerCase();
  
  // Basic SOS regex
  if (/(help|sos|emergency|dying|pain|hospital|chest|breathing|bleeding)/i.test(lowerMsg)) {
    return 'SOS';
  }
  
  // Basic adherence regex
  if (/(yes|no|took it|done|taken|missed|skipped)/i.test(lowerMsg)) {
    return 'ADHERENCE';
  }
  
  // Basic symptom regex
  if (/(fever|cough|headache|rash|nausea|vomiting|dizzy|ache|hurts)/i.test(lowerMsg)) {
    return 'SYMPTOM';
  }
  
  return 'GENERAL';
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;
    
    if (!from || !body) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    
    const phoneNumber = from.replace('whatsapp:', '');
    
    // Find patient by phone
    const patient = await prisma.patient.findUnique({
      where: { phone: phoneNumber }
    });
    
    if (!patient) {
      await sendWhatsAppMessage(from, "I'm sorry, I couldn't find your patient record. Please contact the clinic.");
      return NextResponse.json({ success: true });
    }
    
    // Classify message
    const category = await classifyMessage(body);
    
    // Log conversation
    await prisma.conversationLog.create({
      data: {
        patientId: patient.id,
        messageIn: body,
        category,
      }
    });
    
    // Routing logic
    if (category === 'SOS') {
      // Create escalation
      await prisma.escalation.create({
        data: {
          patientId: patient.id,
          trigger: 'SOS',
          patientMessage: body,
        }
      });
      
      // Auto-reply
      const reply = "🚨 EMERGENCY PROTOCOL INITIATED. Your care team has been notified immediately. If you are experiencing a life-threatening emergency, please dial your local emergency number.";
      await sendWhatsAppMessage(from, reply);
      
      // Notify Care Team
      if (process.env.CARE_TEAM_WHATSAPP) {
        await sendWhatsAppMessage(
          process.env.CARE_TEAM_WHATSAPP, 
          `🚨 URGENT: SOS from ${patient.firstName} ${patient.lastName} (${patient.phone}). Message: "${body}"`
        );
      }
      
    } else if (category === 'SYMPTOM') {
      const response = await queryLocalHealthcareModel(body);
      
      if (response.includes('SOS_TRIGGERED')) {
        // Trigger SOS flow
        await prisma.escalation.create({
          data: {
            patientId: patient.id,
            trigger: 'SYMPTOM',
            patientMessage: body,
            aiResponse: response,
          }
        });
        const reply = "Based on your symptoms, I have notified your care team immediately. Please seek emergency medical care if symptoms worsen.";
        await sendWhatsAppMessage(from, reply);
      } else {
        await sendWhatsAppMessage(from, response);
      }
      
    } else if (category === 'ADHERENCE') {
      // Find the most recent PENDING schedule for this patient
      const latestSchedule = await prisma.schedule.findFirst({
        where: { 
          patientId: patient.id,
          status: 'PENDING'
        },
        orderBy: {
          reminderTime: 'asc'
        }
      });
      
      if (latestSchedule) {
        const isYes = /(yes|took it|done|taken)/i.test(body);
        const status = isYes ? 'TAKEN' : 'MISSED';
        
        await prisma.schedule.update({
          where: { id: latestSchedule.id },
          data: { status }
        });
        
        await prisma.adherenceLog.create({
          data: {
            patientId: patient.id,
            medicineId: latestSchedule.medicineId,
            logDate: new Date(),
            scheduledTime: latestSchedule.reminderTime,
            actualResponse: isYes ? 'TAKEN' : 'SKIPPED',
            responseTime: new Date(),
            status: body
          }
        });
        
        const reply = isYes ? "Great job taking your medication! I've logged it." : "I've logged that you missed this dose. Please consult your doctor if you have concerns.";
        await sendWhatsAppMessage(from, reply);
      } else {
        const reply = "I logged your message, but I couldn't find a pending medication reminder for you right now.";
        await sendWhatsAppMessage(from, reply);
      }
      
    } else {
      // General routing to GROQ
      const response = await generateGeneralResponse(body);
      await sendWhatsAppMessage(from, response);
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Twilio Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
