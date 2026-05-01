import 'dotenv/config'
import { PrismaClient, TimingInstruction } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const patientsData = [
    {
      firstName: 'Ahmad',
      lastName: 'Al-Farsi',
      age: 65,
      gender: 'Male',
      phone: '+966500000001',
      nextOfKinName: 'Fatima Al-Farsi',
      nextOfKinPhone: '+966500000002',
      wakeTime: '06:00',
      breakfastTime: '07:00',
      lunchTime: '13:00',
      dinnerTime: '19:00',
      bedTime: '22:00',
      consentGiven: true,
      medicines: {
        create: [
          {
            medicineName: 'Metformin',
            dose: '500mg',
            frequency: 'Twice daily',
            timingInstruction: TimingInstruction.AFTER_BREAKFAST,
            durationDays: 30,
            startDate: new Date(),
          },
          {
            medicineName: 'Amlodipine',
            dose: '5mg',
            frequency: 'Once daily',
            timingInstruction: TimingInstruction.BEFORE_BED,
            durationDays: 30,
            startDate: new Date(),
          }
        ]
      }
    },
    {
      firstName: 'Sarah',
      lastName: 'Al-Qahtani',
      age: 55,
      gender: 'Female',
      phone: '+966500000003',
      nextOfKinName: 'Omar Al-Qahtani',
      nextOfKinPhone: '+966500000004',
      wakeTime: '07:00',
      breakfastTime: '08:00',
      lunchTime: '14:00',
      dinnerTime: '20:00',
      bedTime: '23:00',
      consentGiven: true,
      medicines: {
        create: [
          {
            medicineName: 'Atorvastatin',
            dose: '20mg',
            frequency: 'Once daily',
            timingInstruction: TimingInstruction.BEFORE_BED,
            durationDays: 30,
            startDate: new Date(),
          }
        ]
      }
    },
    // Adding a few more to reach 10
    ...Array.from({ length: 8 }).map((_, i) => ({
      firstName: `TestPatient${i + 3}`,
      lastName: 'Synthetic',
      age: 40 + i,
      gender: i % 2 === 0 ? 'Male' : 'Female',
      phone: `+96650000001${i}`,
      nextOfKinName: `NOK${i + 3}`,
      nextOfKinPhone: `+96650000002${i}`,
      wakeTime: '06:30',
      breakfastTime: '07:30',
      lunchTime: '13:30',
      dinnerTime: '19:30',
      bedTime: '22:30',
      consentGiven: true,
      medicines: {
        create: [
          {
            medicineName: 'Vitamin D',
            dose: '1000 IU',
            frequency: 'Once daily',
            timingInstruction: TimingInstruction.WITH_LUNCH,
            durationDays: 30,
            startDate: new Date(),
          }
        ]
      }
    }))
  ]

  console.log('Seeding database...')
  for (const patient of patientsData) {
    const createdPatient = await prisma.patient.upsert({
      where: { phone: patient.phone },
      update: {},
      create: patient,
    })
    console.log(`Created patient: ${createdPatient.firstName} ${createdPatient.lastName}`)
  }
  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
