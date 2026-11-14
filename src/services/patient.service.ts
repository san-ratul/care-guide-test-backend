import { FilterQuery, Types } from 'mongoose';
import { Doctor } from '../models/doctor.model';
import { Patient, IPatient } from '../models/patient.model';
import { ApiError } from '../utils/ApiError';
import { buildPaginationMeta, parsePagination } from '../utils/pagination';
import { buildSearchRegex } from '../utils/regex';
import {
  CreatePatientInput,
  PatientListQuery,
  UpdatePatientInput,
} from '../validators/patient.schema';

const LIST_PROJECTION = {
  name: 1,
  doctorId: 1,
  phone: 1,
  email: 1,
  gender: 1,
  dateOfBirth: 1,
  condition: 1,
  status: 1,
  address: 1,
  notes: 1,
  createdAt: 1,
} as const;

async function assertDoctorExists(doctorId: string): Promise<void> {
  const exists = await Doctor.exists({ _id: new Types.ObjectId(doctorId) });
  if (!exists) {
    throw ApiError.unprocessable('doctorId does not reference an existing doctor', [
      { path: 'doctorId', message: 'Selected doctor does not exist' },
    ]);
  }
}

function buildDateRange(createdFrom?: string, createdTo?: string): FilterQuery<IPatient> {
  if (!createdFrom && !createdTo) return {};
  const range: { $gte?: Date; $lte?: Date } = {};
  if (createdFrom) range.$gte = new Date(`${createdFrom}T00:00:00.000Z`);
  if (createdTo) range.$lte = new Date(`${createdTo}T23:59:59.999Z`);
  return { createdAt: range };
}

export async function listPatients(query: PatientListQuery) {
  const { page, limit, skip } = parsePagination(query.page, query.limit);

  const filter: FilterQuery<IPatient> = {};

  if (query.search) {
    const regex = buildSearchRegex(query.search);
    filter.$or = [
      { name: regex },
      { phone: regex },
      { email: regex },
      { condition: regex },
      { address: regex },
    ];
  }
  if (query.doctorId) filter.doctorId = new Types.ObjectId(query.doctorId);
  if (query.condition) filter.condition = query.condition;
  if (query.status) filter.status = query.status;
  if (query.gender) filter.gender = query.gender;

  Object.assign(filter, buildDateRange(query.createdFrom, query.createdTo));

  const sortDirection = query.sortOrder === 'asc' ? 1 : -1;
  const sort: Record<string, 1 | -1> = { [query.sortBy]: sortDirection, _id: sortDirection };

  const [patients, total] = await Promise.all([
    Patient.find(filter)
      .select(LIST_PROJECTION)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: false }),
    Patient.countDocuments(filter),
  ]);

  return { patients, meta: buildPaginationMeta(total, page, limit) };
}

export async function getPatientById(id: string) {
  const patient = await Patient.findById(id).select(LIST_PROJECTION).lean({ virtuals: false });
  if (!patient) throw ApiError.notFound('Patient not found');

  const doctor = await Doctor.findById(patient.doctorId)
    .select({ name: 1, specialization: 1, hospital: 1, email: 1, phone: 1 })
    .lean({ virtuals: false });

  return { ...patient, doctor };
}

export async function createPatient(input: CreatePatientInput): Promise<IPatient> {
  await assertDoctorExists(input.doctorId);
  return Patient.create(input);
}

export async function updatePatient(id: string, input: UpdatePatientInput): Promise<IPatient> {
  const patient = await Patient.findById(id);
  if (!patient) throw ApiError.notFound('Patient not found');

  if (input.doctorId && input.doctorId !== patient.doctorId.toString()) {
    await assertDoctorExists(input.doctorId);
  }

  patient.set(input);
  await patient.save();
  return patient;
}

export async function deletePatient(id: string): Promise<void> {
  const result = await Patient.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw ApiError.notFound('Patient not found');
}
