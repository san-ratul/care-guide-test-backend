import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { Doctor, DOCTOR_SPECIALIZATIONS } from '../src/models/doctor.model';
import { Patient, PATIENT_CONDITIONS, PATIENT_STATUSES } from '../src/models/patient.model';
import { User } from '../src/models/user.model';

interface DoctorSeed {
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  daysAgo: number;
}

const doctors: DoctorSeed[] = [
  {
    name: 'Dr. Ayesha Rahman',
    specialization: 'Cardiology',
    hospital: 'Square Care Hospital',
    phone: '+880 1711 200 101',
    email: 'ayesha.rahman@careguide.dev',
    daysAgo: 58,
  },
  {
    name: 'Dr. Tanvir Hasan',
    specialization: 'Dermatology',
    hospital: 'Green Life Clinic',
    phone: '+880 1711 200 102',
    email: 'tanvir.hasan@careguide.dev',
    daysAgo: 52,
  },
  {
    name: 'Dr. Nusrat Jahan',
    specialization: 'Pediatrics',
    hospital: 'Moonlight Children Hospital',
    phone: '+880 1711 200 103',
    email: 'nusrat.jahan@careguide.dev',
    daysAgo: 47,
  },
  {
    name: 'Dr. Mahmudul Karim',
    specialization: 'Orthopedics',
    hospital: 'Square Care Hospital',
    phone: '+880 1711 200 104',
    email: 'mahmudul.karim@careguide.dev',
    daysAgo: 41,
  },
  {
    name: 'Dr. Farhana Islam',
    specialization: 'Neurology',
    hospital: 'Neuro+ Institute',
    phone: '+880 1711 200 105',
    email: 'farhana.islam@careguide.dev',
    daysAgo: 35,
  },
  {
    name: 'Dr. Rakibul Islam',
    specialization: 'General Medicine',
    hospital: 'Green Life Clinic',
    phone: '+880 1711 200 106',
    email: 'rakibul.islam@careguide.dev',
    daysAgo: 28,
  },
  {
    name: 'Dr. Sadia Afrin',
    specialization: 'Endocrinology',
    hospital: 'Metro Diabetes Center',
    phone: '+880 1711 200 107',
    email: 'sadia.afrin@careguide.dev',
    daysAgo: 21,
  },
  {
    name: 'Dr. Imran Chowdhury',
    specialization: 'Pulmonology',
    hospital: 'Breathe Well Hospital',
    phone: '+880 1711 200 108',
    email: 'imran.chowdhury@careguide.dev',
    daysAgo: 14,
  },
  {
    name: 'Dr. Lamia Sultana',
    specialization: 'Psychiatry',
    hospital: 'MindCare Wellness',
    phone: '+880 1711 200 109',
    email: 'lamia.sultana@careguide.dev',
    daysAgo: 8,
  },
  {
    name: 'Dr. Zahid Hossain',
    specialization: 'Gastroenterology',
    hospital: 'Square Care Hospital',
    phone: '+880 1711 200 110',
    email: 'zahid.hossain@careguide.dev',
    daysAgo: 4,
  },
  {
    name: 'Dr. Mita Borshon',
    specialization: 'Urology',
    hospital: 'Green Life Clinic',
    phone: '+880 1711 200 111',
    email: 'mita.borshon@careguide.dev',
    daysAgo: 2,
  },
];

const firstNames = [
  'Arif',
  'Bina',
  'Chandan',
  'Dola',
  'Ehsan',
  'Fahima',
  'Gaus',
  'Hasan',
  'Ishrat',
  'Jubayer',
  'Kamrul',
  'Lubna',
  'Mizan',
  'Nabila',
  'Omar',
  'Parvin',
  'Rasel',
  'Sadia',
  'Tuhin',
  'Urmi',
  'Vabna',
  'Wasim',
  'Yamin',
  'Zara',
  'Nafis',
  'Rumana',
  'Shakib',
  'Tania',
  'Ujjal',
  'Mim',
  'Alamin',
  'Bushra',
  'Rafi',
  'Sumi',
  'Titas',
  'Pial',
  'Nadia',
  'Rezaul',
  'Sonia',
  'Joy',
  'Kona',
  'Litton',
  'Maria',
  'Noman',
  'Orin',
];
const lastNames = [
  'Ahmed',
  'Akter',
  'Chowdhury',
  'Das',
  'Farooq',
  'Ghosh',
  'Haque',
  'Islam',
  'Jones',
  'Kabir',
  'Latif',
  'Molla',
  'Noor',
  'Osman',
  'Pathan',
  'Quddus',
  'Rahman',
  'Sarker',
  'Talukder',
  'Uddin',
];
const genders = ['male', 'female'] as const;
const conditions = [...PATIENT_CONDITIONS];
const statuses = [...PATIENT_STATUSES];

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function seedRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

async function seedPatients(
  doctorIds: mongoose.Types.ObjectId[],
  random: () => number,
): Promise<number> {
  const total = 64;
  const docs = [];
  for (let i = 0; i < total; i += 1) {
    const daysAgo = Math.floor(random() * 55);
    const createdAt = new Date();
    createdAt.setUTCHours(9 + Math.floor(random() * 8), 0, 0, 0);
    createdAt.setUTCDate(createdAt.getUTCDate() - daysAgo);

    const gender = randomItem(genders);
    const name = `${randomItem(firstNames)} ${randomItem(lastNames)}`;
    const slug = name.toLowerCase().replace(/\s+/g, '.');

    docs.push({
      name,
      doctorId: doctorIds[i % doctorIds.length],
      phone: `+880 18${String(10000000 + Math.floor(random() * 89999999)).slice(0, 8)}`,
      email: random() > 0.35 ? `${slug}@example.com` : undefined,
      gender,
      dateOfBirth: new Date(
        1955 + Math.floor(random() * 50),
        Math.floor(random() * 12),
        1 + Math.floor(random() * 27),
      ),
      condition: randomItem(conditions),
      status: randomItem(statuses),
      address: `${1 + Math.floor(random() * 200)}/A, ${randomItem(['Gulshan', 'Dhanmondi', 'Banani', 'Mirpur', 'Uttara', 'Bashundhara'])}, Dhaka`,
      notes:
        random() > 0.5
          ? 'Routine follow-up scheduled. Patient responsive to current treatment plan.'
          : undefined,
      createdAt,
      updatedAt: createdAt,
    });
  }

  const inserted = (await Patient.insertMany(docs)) as unknown as unknown[];
  return inserted.length;
}

async function main(): Promise<void> {
  const fresh = process.argv.includes('--fresh');

  await mongoose.connect(env.MONGODB_URI);

  console.log(`[seed] connected to ${mongoose.connection.host}/${mongoose.connection.name}`);

  if (fresh) {
    await Promise.all([
      User.deleteMany({}),
      Doctor.deleteMany({}),
      Patient.deleteMany({}),
      mongoose.connection.collection('refreshtokens').deleteMany({}),
    ]);

    console.log('[seed] cleared existing collections');
  }

  const existingAdmin = await User.findOne({ email: env.SEED_ADMIN_EMAIL });
  if (!existingAdmin) {
    await User.create({
      name: env.SEED_ADMIN_NAME,
      email: env.SEED_ADMIN_EMAIL,
      password: env.SEED_ADMIN_PASSWORD,
      role: 'admin',
    });

    console.log(`[seed] admin created: ${env.SEED_ADMIN_EMAIL}`);
  } else {
    console.log(`[seed] admin already exists: ${env.SEED_ADMIN_EMAIL}`);
  }

  const doctorCount = await Doctor.countDocuments({});
  if (doctorCount === 0) {
    const random = seedRandom(42);
    const createdDoctors = (await Doctor.insertMany(
      doctors.map(({ daysAgo, ...doc }) => {
        const createdAt = new Date();
        createdAt.setUTCDate(createdAt.getUTCDate() - daysAgo);
        return { ...doc, createdAt, updatedAt: createdAt };
      }),
    )) as unknown as Array<{ _id: mongoose.Types.ObjectId }>;

    const patientCount = await seedPatients(
      createdDoctors.map((doc) => doc._id),
      random,
    );

    console.log(`[seed] created ${createdDoctors.length} doctors and ${patientCount} patients`);
  } else {
    console.log(
      `[seed] doctors already exist (${doctorCount}), skipping data seed. Use --fresh to rebuild.`,
    );
  }

  console.log(`[seed] specializations available: ${DOCTOR_SPECIALIZATIONS.join(', ')}`);

  await mongoose.disconnect();

  console.log('[seed] done');
}

main().catch((error) => {
  console.error('[seed] failed:', error);
  process.exit(1);
});
