import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now        = new Date();
    const todayStart = startOfDay(now);
    const todayEnd   = endOfDay(now);

    // ── Core metrics (existing) ─────────────────────────────────────────────
    const [totalPatients, activeSOS, recentSOS, todayLogs, allPatients] =
      await Promise.all([
        prisma.patient.count(),
        prisma.escalation.count({ where: { outcome: null } }),
        prisma.escalation.findMany({
          where:   { outcome: null },
          include: { patient: true },
          orderBy: { createdAt: 'desc' },
          take:    5,
        }),
        prisma.adherenceLog.findMany({
          where: { logDate: { gte: todayStart, lte: todayEnd } },
        }),
        prisma.patient.findMany({
          include: { medicines: true },
          take:    10,
        }),
      ]);

    const takenCount  = todayLogs.filter(l => l.actualResponse === 'TAKEN').length;
    const missedCount = todayLogs.filter(l => l.actualResponse === 'SKIPPED').length;
    const adherenceRate =
      takenCount + missedCount > 0
        ? Math.round((takenCount / (takenCount + missedCount)) * 100)
        : 0;

    // ── Sprint C: Risk leaderboard ──────────────────────────────────────────
    // For each patient, fetch their most recent RiskScore via a subquery
    const latestRiskRows = await prisma.$queryRaw<
      Array<{
        patient_id: string;
        score:      string;
        rationale:  string;
        calculated_at: Date;
        first_name: string;
        last_name:  string;
      }>
    >`
      SELECT DISTINCT ON (rs."patientId")
        rs."patientId"    AS patient_id,
        rs.score,
        rs.rationale,
        rs."calculatedAt" AS calculated_at,
        p."firstName"     AS first_name,
        p."lastName"      AS last_name
      FROM app.risk_scores rs
      JOIN app.patients p ON p.id = rs."patientId"
      ORDER BY rs."patientId", rs."calculatedAt" DESC
    `;

    // Sort by risk severity: HIGH → MEDIUM → LOW
    const riskOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    const riskLeaderboard = latestRiskRows
      .sort((a, b) => (riskOrder[a.score] ?? 3) - (riskOrder[b.score] ?? 3))
      .slice(0, 10)
      .map(r => ({
        patientId:    r.patient_id,
        name:         `${r.first_name} ${r.last_name}`,
        level:        r.score,
        rationale:    r.rationale,
        calculatedAt: r.calculated_at,
      }));

    const riskSummary = {
      high:   latestRiskRows.filter(r => r.score === 'HIGH').length,
      medium: latestRiskRows.filter(r => r.score === 'MEDIUM').length,
      low:    latestRiskRows.filter(r => r.score === 'LOW').length,
      unscored: totalPatients - latestRiskRows.length,
    };

    return NextResponse.json({
      totalPatients,
      activeSOS,
      recentSOS,
      todayStats: {
        taken:  takenCount,
        missed: missedCount,
        rate:   adherenceRate,
      },
      patients:       allPatients,
      riskLeaderboard,
      riskSummary,
    });

  } catch (error) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
