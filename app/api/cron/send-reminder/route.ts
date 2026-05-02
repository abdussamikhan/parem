import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { sendWhatsAppMessage } from '@/app/lib/twilio';
import { groq } from '@/app/lib/groq';

export async function POST(req: NextRequest) {
  try {
    const { scheduleId } = await req.json();
    
    if (!scheduleId) {
      return NextResponse.json({ error: 'scheduleId is required' }, { status: 400 });
    }
    
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        patient: true,
        medicine: true,
      }
    });
    
    if (!schedule || schedule.status !== 'PENDING') {
      return NextResponse.json({ error: 'Valid pending schedule not found' }, { status: 404 });
    }
    
    const { patient, medicine } = schedule;
    
    // Generate personalized reminder
    const prompt = `Generate a friendly, concise WhatsApp message (max 30 words) reminding a patient named ${patient.firstName} to take their medication: ${medicine.medicineName} (${medicine.dose}). It should be taken ${medicine.timingInstruction.replace('_', ' ').toLowerCase()}. Ask them to reply "yes" or "done" when taken.`;
    
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
      max_tokens: 100,
    });
    
    const reminderMessage = chatCompletion.choices[0]?.message?.content || 
      `Hi ${patient.firstName}, it's time to take your ${medicine.medicineName} (${medicine.dose}). Please reply "yes" when you've taken it.`;
      
    await sendWhatsAppMessage(patient.phone, reminderMessage);

    // Bug fix: mark schedule as SENT so it doesn't re-fire on the next cron tick
    await prisma.schedule.update({
      where: { id: schedule.id },
      data:  { status: 'SENT' },
    });
    
    return NextResponse.json({ success: true, messageSent: reminderMessage });

    
  } catch (error) {
    console.error('Send Reminder Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
