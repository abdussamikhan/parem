import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { addDays, setHours, setMinutes, startOfDay } from 'date-fns';

export async function POST() {
  try {
    const patients = await prisma.patient.findMany({
      include: {
        medicines: true,
      },
    });

    let createdCount = 0;
    let skippedCount = 0;
    const targetDate = addDays(new Date(), 1); // Tomorrow
    const targetDayStart = startOfDay(targetDate);

    for (const patient of patients) {
      const { wakeTime, bedTime, breakfastTime, lunchTime, dinnerTime } = patient;

      // Covers every value in the TimingInstruction enum
      const timeMap: Record<string, string | null | undefined> = {
        UPON_WAKING:           wakeTime,
        MORNING_EMPTY_STOMACH: wakeTime,
        BEFORE_BREAKFAST:      breakfastTime,
        AFTER_BREAKFAST:       breakfastTime,
        WITH_LUNCH:            lunchTime,
        BEFORE_LUNCH:          lunchTime,
        AFTER_LUNCH:           lunchTime,
        BEFORE_DINNER:         dinnerTime,
        AFTER_DINNER:          dinnerTime,
        BEFORE_BED:            bedTime,
      };

      for (const med of patient.medicines) {
        const baseTimeStr = timeMap[med.timingInstruction];
        if (!baseTimeStr) continue;

        const [hours, minutes] = baseTimeStr.split(':').map(Number);

        // Build the base scheduled time for tomorrow
        let scheduledTime = setMinutes(setHours(targetDayStart, hours), minutes);

        // Apply offset based on instruction
        if (med.timingInstruction.includes('BEFORE')) {
          scheduledTime = new Date(scheduledTime.getTime() - 30 * 60 * 1000);
        } else if (med.timingInstruction.includes('AFTER')) {
          scheduledTime = new Date(scheduledTime.getTime() + 30 * 60 * 1000);
        }

        // Guard: skip if a schedule already exists for this patient+medicine+day
        const existing = await prisma.schedule.findFirst({
          where: {
            patientId: patient.id,
            medicineId: med.id,
            date: targetDayStart,
          },
        });

        if (existing) {
          skippedCount++;
          continue;
        }

        await prisma.schedule.create({
          data: {
            patientId:    patient.id,
            medicineId:   med.id,
            reminderTime: scheduledTime,
            date:         targetDayStart,
            status:       'PENDING',
          },
        });

        createdCount++;
      }
    }

    return NextResponse.json({
      success:          true,
      schedulesCreated: createdCount,
      skipped:          skippedCount,
    });
  } catch (error) {
    console.error('Schedule Loader Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
