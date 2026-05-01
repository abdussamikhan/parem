import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { sendWhatsAppMessage } from '@/app/lib/twilio';

export async function POST(req: NextRequest) {
  try {
    const { patientId, reason } = await req.json();
    
    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    }
    
    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });
    
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }
    
    // Create escalation record
    await prisma.escalation.create({
      data: {
        patientId: patient.id,
        trigger: 'SOS',
        patientMessage: reason || 'External SOS Button Triggered',
      }
    });
    
    // Auto-reply to patient
    const reply = "🚨 EMERGENCY PROTOCOL INITIATED. Your care team has been notified immediately. If you are experiencing a life-threatening emergency, please dial your local emergency number.";
    await sendWhatsAppMessage(patient.phone, reply);
    
    // Notify Care Team
    if (process.env.CARE_TEAM_WHATSAPP) {
      await sendWhatsAppMessage(
        process.env.CARE_TEAM_WHATSAPP, 
        `🚨 URGENT: External SOS triggered for ${patient.firstName} (${patient.phone}). Reason: ${reason || 'Button press'}`
      );
    }
    
    // Notify Next of Kin
    if (patient.nextOfKinPhone) {
      await sendWhatsAppMessage(
        patient.nextOfKinPhone, 
        `⚠️ SOS ALERT: ${patient.firstName} has triggered an SOS alert. The care team has been notified.`
      );
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('SOS Alert Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
