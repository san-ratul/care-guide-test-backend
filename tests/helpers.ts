import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import { app } from '../src/app';
import { User } from '../src/models/user.model';
import { Doctor, IDoctor } from '../src/models/doctor.model';
import { IPatient, Patient } from '../src/models/patient.model';

export const ADMIN_EMAIL = 'admin@test.dev';
export const ADMIN_PASSWORD = 'Test@12345';

type DoctorOverrides = Partial<Omit<IDoctor, '_id' | 'createdAt' | 'updatedAt'>> & {
  createdAt?: Date;
  updatedAt?: Date;
};

type PatientOverrides = Partial<Omit<IPatient, '_id' | 'doctorId' | 'createdAt' | 'updatedAt'>> & {
  createdAt?: Date;
  updatedAt?: Date;
};

export async function createAdmin(): Promise<{ id: string; email: string }> {
  const user = await User.create({
    name: 'Test Admin',
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    role: 'admin',
  });
  return { id: user._id.toString(), email: user.email };
}

export async function getAccessToken(): Promise<string> {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  return response.body.data.accessToken as string;
}

export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export const validDoctorPayload = {
  name: 'Dr. Anika Chowdhury',
  specialization: 'Cardiology',
  hospital: 'Square Care Hospital',
  phone: '+880 1711 555 001',
  email: 'anika.chowdhury@careguide.test',
};

export const validPatientPayload = {
  name: 'Rahim Uddin',
  phone: '+880 1811 555 002',
  email: 'rahim.uddin@example.test',
  gender: 'male' as const,
  condition: 'diabetes' as const,
  status: 'active' as const,
  address: '12/B Dhanmondi, Dhaka',
  notes: 'Regular check-up every 3 months.',
};

export async function createDoctor(overrides: DoctorOverrides = {}) {
  return Doctor.create({ ...validDoctorPayload, ...overrides });
}

export async function createPatient(
  doctorId: string | Types.ObjectId,
  overrides: PatientOverrides = {},
) {
  return Patient.create({
    ...validPatientPayload,
    doctorId: new mongoose.Types.ObjectId(String(doctorId)),
    ...overrides,
  });
}

export async function createDoctors(count: number, startEmail = 1) {
  const specializations = ['Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics'];
  const doctors = [];
  for (let i = 0; i < count; i += 1) {
    doctors.push(
      createDoctor({
        name: `Dr. Batch Doctor ${String(startEmail + i).padStart(3, '0')}`,
        email: `batch.doctor.${String(startEmail + i).padStart(3, '0')}@careguide.test`,
        specialization: specializations[i % specializations.length] as 'Cardiology',
      }),
    );
  }
  return Promise.all(doctors);
}
