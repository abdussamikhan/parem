import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';

export async function GET() {
  try {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    // Basic Metrics
    const totalPatients = await prisma.patient.count();
    
    const activeSOS = await prisma.escalation.count({
      where: {
        outcome: null
      }
    });

    const recentSOS = await prisma.escalation.findMany({
      where: { outcome: null },
      include: { patient: true },
      // The Escalation model has no timestamp field directly, but it has alertSentAt or id (cuid) which we can order by
      orderBy: { id: 'desc' },
      take: 5
    });

    // Today's Adherence
    const todayLogs = await prisma.adherenceLog.findMany({
      where: {
        logDate: {
          gte: todayStart,
          lte: todayEnd,
        }
      }
    });

    const takenCount = todayLogs.filter(log => log.actualResponse === 'TAKEN').length;
    const missedCount = todayLogs.filter(log => log.actualResponse === 'SKIPPED').length;
    
    let adherenceRate = 0;
    if (takenCount + missedCount > 0) {
      adherenceRate = Math.round((takenCount / (takenCount + missedCount)) * 100);
    }

    const allPatients = await prisma.patient.findMany({
      include: {
        medicines: true,
      },
      take: 10
    });

    return NextResponse.json({
      totalPatients,
      activeSOS,
      recentSOS,
      todayStats: {
        taken: takenCount,
        missed: missedCount,
        rate: adherenceRate
      },
      patients: allPatients
    });

  } catch (error) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
