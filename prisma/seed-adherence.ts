import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const db = new PrismaClient();

async function main() {
  const patients = await db.patient.findMany({ include: { medicines: true } });
  const today = new Date();
  let count = 0;

  for (const p of patients) {
    for (const m of p.medicines) {
      for (let d = 0; d < 14; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() - d);
        const dateOnly = new Date(date.toISOString().split('T')[0]);
        const scheduled = new Date(dateOnly);
        scheduled.setHours(8, 0, 0, 0);
        const responses: Array<'TAKEN' | 'SKIPPED'> = ['TAKEN', 'TAKEN', 'TAKEN', 'SKIPPED', 'TAKEN'];
        const resp = responses[Math.floor(Math.random() * responses.length)];
        try {
          await db.adherenceLog.create({
            data: {
              patientId: p.id,
              medicineId: m.id,
              logDate: dateOnly,
              scheduledTime: scheduled,
              actualResponse: resp,
            },
          });
          count++;
        } catch {
          // skip duplicate
        }
      }
    }
  }

  console.log(`Created ${count} adherence logs for ${patients.length} patients.`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
