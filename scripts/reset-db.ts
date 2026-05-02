/**
 * scripts/reset-db.ts
 *
 * Pilot DB reset script.
 * Drops all application data in dependency order and re-seeds.
 *
 * Usage:
 *   npx ts-node --project tsconfig.seed.json scripts/reset-db.ts
 *   npm run db:reset
 *
 * ⚠️  DESTRUCTIVE — never run against production.
 * The script aborts if DATABASE_URL contains "prod" or "production".
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

const DB_URL = process.env.DATABASE_URL ?? '';
if (DB_URL.toLowerCase().includes('prod')) {
  console.error('❌  Refusing to reset a production database. Aborting.');
  process.exit(1);
}

async function reset() {
  console.log('🗑️  Deleting all data (dependency order)...');

  await prisma.$transaction([
    prisma.riskScore.deleteMany(),
    prisma.adherenceLog.deleteMany(),
    prisma.escalation.deleteMany(),
    prisma.conversationLog.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.familyMember.deleteMany(),
    prisma.medicine.deleteMany(),
    prisma.patient.deleteMany(),
  ]);

  console.log('✅  All tables cleared.');

  console.log('🌱  Re-seeding...');
  execSync('npx ts-node --project tsconfig.seed.json prisma/seed.ts', {
    stdio: 'inherit',
    env:   process.env,
  });

  console.log('\n🎉  Reset complete.');
}

reset()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
