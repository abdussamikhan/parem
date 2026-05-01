import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const patient = await prisma.patient.findFirst();

  if (patient) {
    await prisma.patient.update({
      where: { id: patient.id },
      data: { phone: '+966509763311' }
    });
    console.log('Updated patient phone to +966509763311');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
