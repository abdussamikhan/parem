import 'dotenv/config'
import { PrismaClient, TimingInstruction } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // ─── Existing patients (preserved) ──────────────────────────────────────────

  const basePatients = [
    {
      firstName:     'Ahmad',
      lastName:      'Al-Farsi',
      age:           65,
      gender:        'Male',
      phone:         '+966500000001',
      nextOfKinName: 'Fatima Al-Farsi',
      nextOfKinPhone:'+966500000002',
      wakeTime:      '06:00',
      breakfastTime: '07:00',
      lunchTime:     '13:00',
      dinnerTime:    '19:00',
      bedTime:       '22:00',
      consentGiven:  true,
      conditionCategory: 'Diabetes',
      medicines: {
        create: [
          {
            medicineName:      'Metformin',
            dose:              '500mg',
            frequency:         'Twice daily',
            timingInstruction: TimingInstruction.AFTER_BREAKFAST,
            durationDays:      30,
            startDate:         new Date(),
          },
          {
            medicineName:      'Amlodipine',
            dose:              '5mg',
            frequency:         'Once daily',
            timingInstruction: TimingInstruction.BEFORE_BED,
            durationDays:      30,
            startDate:         new Date(),
          },
        ],
      },
    },
    {
      firstName:     'Sarah',
      lastName:      'Al-Qahtani',
      age:           55,
      gender:        'Female',
      phone:         '+966500000003',
      nextOfKinName: 'Omar Al-Qahtani',
      nextOfKinPhone:'+966500000004',
      wakeTime:      '07:00',
      breakfastTime: '08:00',
      lunchTime:     '14:00',
      dinnerTime:    '20:00',
      bedTime:       '23:00',
      consentGiven:  true,
      conditionCategory: 'Hypertension',
      medicines: {
        create: [
          {
            medicineName:      'Atorvastatin',
            dose:              '20mg',
            frequency:         'Once daily',
            timingInstruction: TimingInstruction.BEFORE_BED,
            durationDays:      30,
            startDate:         new Date(),
          },
        ],
      },
    },
  ]

  // ─── Sprint B: Voice-preferred patient (Arabic voice note sender) ─────────

  const voicePatients = [
    {
      firstName:        'Khalid',
      lastName:         'Al-Rashidi',
      age:              72,
      gender:           'Male',
      phone:            '+966500000020',
      nextOfKinName:    'Nora Al-Rashidi',
      nextOfKinPhone:   '+966500000021',
      wakeTime:         '05:30',
      breakfastTime:    '06:30',
      lunchTime:        '12:30',
      dinnerTime:       '18:30',
      bedTime:          '21:30',
      consentGiven:     true,
      voicePreferred:   true,           // ← Sprint B: voice-preferred
      conditionCategory:'Heart Disease',
      medicines: {
        create: [
          {
            medicineName:      'Aspirin',
            dose:              '100mg',
            frequency:         'Once daily',
            timingInstruction: TimingInstruction.AFTER_BREAKFAST,
            durationDays:      90,
            startDate:         new Date(),
          },
          {
            medicineName:      'Bisoprolol',
            dose:              '2.5mg',
            frequency:         'Once daily',
            timingInstruction: TimingInstruction.UPON_WAKING,
            durationDays:      90,
            startDate:         new Date(),
          },
        ],
      },
    },
    // Family-group patient (needed for Sprint D)
    {
      firstName:        'Maryam',
      lastName:         'Al-Dosari',
      age:              68,
      gender:           'Female',
      phone:            '+966500000022',
      nextOfKinName:    'Abdullah Al-Dosari',
      nextOfKinPhone:   '+966500000023',
      wakeTime:         '06:00',
      breakfastTime:    '07:30',
      lunchTime:        '13:00',
      dinnerTime:       '19:30',
      bedTime:          '22:00',
      consentGiven:     true,
      familyGroupMode:  true,           // ← Sprint D placeholder
      conditionCategory:'Diabetes',
      medicines: {
        create: [
          {
            medicineName:      'Insulin Glargine',
            dose:              '10 units',
            frequency:         'Once daily',
            timingInstruction: TimingInstruction.BEFORE_BED,
            durationDays:      30,
            startDate:         new Date(),
          },
        ],
      },
    },
    // High-risk patient (missed adherence, older age)
    {
      firstName:        'Ibrahim',
      lastName:         'Al-Otaibi',
      age:              80,
      gender:           'Male',
      phone:            '+966500000024',
      nextOfKinName:    'Salma Al-Otaibi',
      nextOfKinPhone:   '+966500000025',
      wakeTime:         '07:00',
      breakfastTime:    '08:00',
      lunchTime:        '13:00',
      dinnerTime:       '19:00',
      bedTime:          '22:00',
      consentGiven:     true,
      conditionCategory:'COPD',
      medicines: {
        create: [
          {
            medicineName:      'Salbutamol Inhaler',
            dose:              '2 puffs',
            frequency:         'As needed',
            timingInstruction: TimingInstruction.MORNING_EMPTY_STOMACH,
            durationDays:      60,
            startDate:         new Date(),
          },
          {
            medicineName:      'Prednisolone',
            dose:              '5mg',
            frequency:         'Once daily',
            timingInstruction: TimingInstruction.AFTER_BREAKFAST,
            durationDays:      14,
            startDate:         new Date(),
          },
        ],
      },
    },
  ]

  // ─── Synthetic patients (pad to 10 baseline) ──────────────────────────────

  const syntheticPatients = Array.from({ length: 8 }).map((_, i) => ({
    firstName:     `TestPatient${i + 3}`,
    lastName:      'Synthetic',
    age:           40 + i,
    gender:        i % 2 === 0 ? 'Male' : 'Female',
    phone:         `+96650000001${i}`,
    nextOfKinName: `NOK${i + 3}`,
    nextOfKinPhone:`+96650000002${i}`,
    wakeTime:      '06:30',
    breakfastTime: '07:30',
    lunchTime:     '13:30',
    dinnerTime:    '19:30',
    bedTime:       '22:30',
    consentGiven:  true,
    medicines: {
      create: [
        {
          medicineName:      'Vitamin D',
          dose:              '1000 IU',
          frequency:         'Once daily',
          timingInstruction: TimingInstruction.WITH_LUNCH,
          durationDays:      30,
          startDate:         new Date(),
        },
      ],
    },
  }))

  // ─── Upsert all ────────────────────────────────────────────────────────────

  for (const patient of [...basePatients, ...voicePatients, ...syntheticPatients]) {
    const { medicines, ...data } = patient
    const created = await prisma.patient.upsert({
      where:  { phone: data.phone },
      update: {},
      create: { ...data, medicines },
    })
    console.log(`  ✓ ${created.firstName} ${created.lastName} (${created.phone})`)
  }

  // ─── Seed staff users (one per role) ────────────────────────────────────────

  console.log('\nSeeding staff users...')

  const staffUsers = [
    { email: 'admin@parem.sa',       password: 'Admin@1234',  fullName: 'System Admin',      role: 'ADMIN'       as const },
    { email: 'nurse@parem.sa',       password: 'Nurse@1234',  fullName: 'Sara Al-Rashidi',   role: 'NURSE'       as const },
    { email: 'doctor@parem.sa',      password: 'Doctor@1234', fullName: 'Dr. Khalid Mansour', role: 'PHYSICIAN'   as const },
    { email: 'coordinator@parem.sa', password: 'Coord@1234',  fullName: 'Nora Al-Otaibi',    role: 'COORDINATOR' as const },
  ]

  for (const u of staffUsers) {
    const passwordHash = await bcrypt.hash(u.password, 12)
    await prisma.user.upsert({
      where:  { email: u.email },
      update: { passwordHash, fullName: u.fullName, role: u.role },
      create: { email: u.email, passwordHash, fullName: u.fullName, role: u.role },
    })
    console.log(`  ✓ ${u.fullName} <${u.email}> [${u.role}]`)
  }

  console.log('\nSeeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
