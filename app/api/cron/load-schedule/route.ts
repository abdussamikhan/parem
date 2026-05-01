import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { addDays, setHours, setMinutes, startOfDay } from 'date-fns';

export async function POST() {
  try {
    // Only accept POST requests from our trusted n8n instance or cron scheduler
    // You could add header authorization here
    
    const patients = await prisma.patient.findMany({
      include: {
        medicines: true
      }
    });
    
    let createdCount = 0;
    const targetDate = addDays(new Date(), 1); // Tomorrow
    
    for (const patient of patients) {
      const { wakeTime, bedTime, breakfastTime, lunchTime, dinnerTime } = patient;
      
      const timeMap: Record<string, string | null> = {
        UPON_WAKING: wakeTime,
        BEFORE_BREAKFAST: breakfastTime, // Approximate 30 mins before
        AFTER_BREAKFAST: breakfastTime, // Approximate 30 mins after
        BEFORE_LUNCH: lunchTime,
        AFTER_LUNCH: lunchTime,
        BEFORE_DINNER: dinnerTime,
        AFTER_DINNER: dinnerTime,
        BEFORE_BED: bedTime,
      };
      
      for (const med of patient.medicines) {
        const baseTimeStr = timeMap[med.timingInstruction];
        if (!baseTimeStr) continue;
        
        const [hours, minutes] = baseTimeStr.split(':').map(Number);
        
        // Adjust time based on instruction
        let scheduledTime = startOfDay(targetDate);
        scheduledTime = setHours(scheduledTime, hours);
        scheduledTime = setMinutes(scheduledTime, minutes);
        
        if (med.timingInstruction.includes('BEFORE')) {
          scheduledTime.setMinutes(scheduledTime.getMinutes() - 30);
        } else if (med.timingInstruction.includes('AFTER')) {
          scheduledTime.setMinutes(scheduledTime.getMinutes() + 30);
        }
        
        await prisma.schedule.create({
          data: {
            patientId: patient.id,
            medicineId: med.id,
            reminderTime: scheduledTime,
            date: startOfDay(targetDate),
            status: 'PENDING',
          }
        });
        
        createdCount++;
      }
    }
    
    return NextResponse.json({ success: true, schedulesCreated: createdCount });
    
  } catch (error) {
    console.error('Schedule Loader Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
