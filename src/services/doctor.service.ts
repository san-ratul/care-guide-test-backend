import { FilterQuery, Types } from 'mongoose';
import { Doctor, IDoctor } from '../models/doctor.model';
import { Patient } from '../models/patient.model';
import { ApiError } from '../utils/ApiError';
import { buildPaginationMeta, parsePagination } from '../utils/pagination';
import { buildSearchRegex } from '../utils/regex';
import { CreateDoctorInput, DoctorListQuery, UpdateDoctorInput } from '../validators/doctor.schema';
import { PatientListQuery } from '../validators/patient.schema';

const LIST_PROJECTION = {
  name: 1,
  specialization: 1,
  hospital: 1,
  phone: 1,
  email: 1,
  createdAt: 1,
} as const;

function buildDateRange(createdFrom?: string, createdTo?: string): FilterQuery<IDoctor> {
  if (!createdFrom && !createdTo) return {};
  const range: { $gte?: Date; $lte?: Date } = {};
  if (createdFrom) range.$gte = new Date(`${createdFrom}T00:00:00.000Z`);
  if (createdTo) range.$lte = new Date(`${createdTo}T23:59:59.999Z`);
  return { createdAt: range };
}

export async function listDoctors(query: DoctorListQuery) {
  const { page, limit, skip } = parsePagination(query.page, query.limit);

  const filter: FilterQuery<IDoctor> = {};

  if (query.search) {
    const regex = buildSearchRegex(query.search);
    filter.$or = [
      { name: regex },
      { email: regex },
      { specialization: regex },
      { hospital: regex },
    ];
  }
  if (query.specialization) filter.specialization = query.specialization;
  if (query.hospital) filter.hospital = buildSearchRegex(query.hospital);

  Object.assign(filter, buildDateRange(query.createdFrom, query.createdTo));

  const sortDirection = query.sortOrder === 'asc' ? 1 : -1;
  const sort: Record<string, 1 | -1> = { [query.sortBy]: sortDirection, _id: sortDirection };

  const [doctors, total] = await Promise.all([
    Doctor.find(filter)
      .select(LIST_PROJECTION)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: false }),
    Doctor.countDocuments(filter),
  ]);

  return { doctors, meta: buildPaginationMeta(total, page, limit) };
}

export async function getDoctorById(id: string) {
  const doctor = await Doctor.findById(id).select(LIST_PROJECTION).lean({ virtuals: false });
  if (!doctor) throw ApiError.notFound('Doctor not found');

  const patientCount = await Patient.countDocuments({ doctorId: new Types.ObjectId(id) });
  return { ...doctor, patientCount };
}

export async function createDoctor(input: CreateDoctorInput): Promise<IDoctor> {
  const duplicate = await Doctor.findOne({ email: input.email }).lean();
  if (duplicate) {
    throw ApiError.conflict('A doctor with this email already exists', [
      { path: 'email', message: 'This email is already registered' },
    ]);
  }
  return Doctor.create(input);
}

export async function updateDoctor(id: string, input: UpdateDoctorInput): Promise<IDoctor> {
  const doctor = await Doctor.findById(id);
  if (!doctor) throw ApiError.notFound('Doctor not found');

  if (input.email && input.email !== doctor.email) {
    const duplicate = await Doctor.findOne({ email: input.email }).lean();
    if (duplicate) {
      throw ApiError.conflict('A doctor with this email already exists', [
        { path: 'email', message: 'This email is already registered' },
      ]);
    }
  }

  doctor.set(input);
  await doctor.save();
  return doctor;
}

/**
 * Doctors are only deleted when they have no patients, so patient records
 * can never be orphaned.
 */
export async function deleteDoctor(id: string): Promise<void> {
  const patientCount = await Patient.countDocuments({ doctorId: new Types.ObjectId(id) });
  if (patientCount > 0) {
    throw ApiError.conflict(
      `This doctor still has ${patientCount} patient${patientCount === 1 ? '' : 's'}. Delete or reassign the patients first.`,
      [{ path: 'patients', message: 'Doctor cannot be deleted while patients are assigned' }],
    );
  }

  const result = await Doctor.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw ApiError.notFound('Doctor not found');
}

export async function listPatientsOfDoctor(doctorId: string, query: PatientListQuery) {
  const exists = await Doctor.exists({ _id: new Types.ObjectId(doctorId) });
  if (!exists) throw ApiError.notFound('Doctor not found');

  const { page, limit, skip } = parsePagination(query.page, query.limit);

  const filter: Record<string, unknown> = { doctorId: new Types.ObjectId(doctorId) };

  if (query.search) {
    const regex = buildSearchRegex(query.search);
    filter.$or = [{ name: regex }, { phone: regex }, { email: regex }, { condition: regex }];
  }
  if (query.condition) filter.condition = query.condition;
  if (query.status) filter.status = query.status;
  if (query.gender) filter.gender = query.gender;

  const range: { $gte?: Date; $lte?: Date } = {};
  if (query.createdFrom) range.$gte = new Date(`${query.createdFrom}T00:00:00.000Z`);
  if (query.createdTo) range.$lte = new Date(`${query.createdTo}T23:59:59.999Z`);
  if (range.$gte || range.$lte) filter.createdAt = range;

  const sortDirection = query.sortOrder === 'asc' ? 1 : -1;
  const sort: Record<string, 1 | -1> = { [query.sortBy]: sortDirection, _id: sortDirection };

  const [patients, total] = await Promise.all([
    Patient.find(filter)
      .select({ doctorId: 0 })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: false }),
    Patient.countDocuments(filter),
  ]);

  return { patients, meta: buildPaginationMeta(total, page, limit) };
}
