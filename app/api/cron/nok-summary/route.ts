import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { sendWhatsAppMessage } from '@/app/lib/twilio';
import { groq } from '@/app/lib/groq';
import { startOfDay, endOfDay } from 'date-fns';

export async function POST(req: NextRequest) {
  try {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    
    // Get all patients with NOK phone
    const patients = await prisma.patient.findMany({
      where: {
        nextOfKinPhone: { not: null }
      },
      include: {
        adherenceLogs: {
          where: {
            logDate: {
              gte: todayStart,
              lte: todayEnd,
            }
          },
          include: {
            medicine: true
          }
        }
      }
    });
    
    let summariesSent = 0;
    
    for (const patient of patients) {
      if (!patient.nextOfKinPhone || patient.adherenceLogs.length === 0) continue;
      
      const takenCount = patient.adherenceLogs.filter(log => log.actualResponse === 'TAKEN').length;
      const missedCount = patient.adherenceLogs.filter(log => log.actualResponse === 'SKIPPED').length;
      
      const logDetails = patient.adherenceLogs.map(log => 
        `- ${log.medicine.medicineName}: ${log.actualResponse} at ${log.responseTime?.toLocaleTimeString() || 'Unknown'}`
      ).join('\n');
      
      const prompt = `You are an AI assistant for a clinic. Write a warm, factual daily summary (under 50 words) to ${patient.nextOfKinName} (Next of Kin) about ${patient.firstName}'s medication adherence today. 
      Details: Taken: ${takenCount}, Missed: ${missedCount}.
      Log:\n${logDetails}`;
      
      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 150,
      });
      
      const summaryMessage = chatCompletion.choices[0]?.message?.content || 
        `Daily update: ${patient.firstName} took ${takenCount} and missed ${missedCount} medications today.`;
        
      await sendWhatsAppMessage(patient.nextOfKinPhone, summaryMessage);
      summariesSent++;
    }
    
    return NextResponse.json({ success: true, summariesSent });
    
  } catch (error) {
    console.error('NOK Summary Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
