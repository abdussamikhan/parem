/**
 * GET /api/dashboard/adherence-trend
 *
 * Returns real 7-day adherence data from the adherence_logs table,
 * grouped by day, for the dashboard line chart.
 *
 * Response shape:
 * [
 *   { name: "Mon", date: "2026-04-28", taken: 8, missed: 2, rate: 80 },
 *   ...
 * ]
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const today = new Date();

    // Build array of last 7 days
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(today, 6 - i); // oldest first
      return {
        date,
        label: format(date, 'EEE'), // Mon, Tue, ...
        dateStr: format(date, 'yyyy-MM-dd'),
        start: startOfDay(date),
        end:   endOfDay(date),
      };
    });

    // Fetch all logs in the 7-day window in one query
    const logs = await prisma.adherenceLog.findMany({
      where: {
        logDate: {
          gte: days[0].start,
          lte: days[days.length - 1].end,
        },
      },
      select: {
        logDate:        true,
        actualResponse: true,
      },
    });

    // Aggregate per day
    const trend = days.map(day => {
      const dayLogs = logs.filter(l => {
        const d = new Date(l.logDate);
        return d >= day.start && d <= day.end;
      });

      const taken  = dayLogs.filter(l => l.actualResponse === 'TAKEN').length;
      const missed = dayLogs.filter(l => l.actualResponse === 'SKIPPED').length;
      const total  = taken + missed;
      const rate   = total > 0 ? Math.round((taken / total) * 100) : 0;

      return {
        name:   day.label,
        date:   day.dateStr,
        taken,
        missed,
        rate,
        hasData: total > 0,
      };
    });

    return NextResponse.json({ trend });

  } catch (error) {
    console.error('Adherence trend error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
