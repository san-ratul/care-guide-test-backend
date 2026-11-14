import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import {
  createDoctor,
  deleteDoctor,
  getDoctorById,
  listDoctors,
  listPatientsOfDoctor,
  updateDoctor,
} from '../services/doctor.service';
import { CreateDoctorInput, DoctorListQuery, UpdateDoctorInput } from '../validators/doctor.schema';
import { PatientListQuery } from '../validators/patient.schema';
import { createPatient } from '../services/patient.service';
import { CreatePatientInput } from '../validators/patient.schema';

export const createDoctorController = asyncHandler(async (req: Request, res: Response) => {
  const doctor = await createDoctor(req.body as CreateDoctorInput);
  sendSuccess(res, doctor, { status: 201, message: 'Doctor created successfully' });
});

export const listDoctorsController = asyncHandler(async (req: Request, res: Response) => {
  const { doctors, meta } = await listDoctors(req.query as unknown as DoctorListQuery);
  sendSuccess(res, doctors, { meta });
});

export const getDoctorController = asyncHandler(async (req: Request, res: Response) => {
  const doctor = await getDoctorById(req.params.id);
  sendSuccess(res, doctor);
});

export const updateDoctorController = asyncHandler(async (req: Request, res: Response) => {
  const doctor = await updateDoctor(req.params.id, req.body as UpdateDoctorInput);
  sendSuccess(res, doctor, { message: 'Doctor updated successfully' });
});

export const deleteDoctorController = asyncHandler(async (req: Request, res: Response) => {
  await deleteDoctor(req.params.id);
  sendSuccess(res, { deleted: true }, { message: 'Doctor deleted successfully' });
});

export const doctorPatientsController = asyncHandler(async (req: Request, res: Response) => {
  const { patients, meta } = await listPatientsOfDoctor(
    req.params.id,
    req.query as unknown as PatientListQuery,
  );
  sendSuccess(res, patients, { meta });
});

/**
 * Creates a patient directly under the doctor addressed by the path.
 * The path doctor wins over any body value.
 */
export const createPatientUnderDoctorController = asyncHandler(
  async (req: Request, res: Response) => {
    const patient = await createPatient({
      ...(req.body as Omit<CreatePatientInput, 'doctorId'>),
      doctorId: req.params.id,
    });
    sendSuccess(res, patient, { status: 201, message: 'Patient created successfully' });
  },
);
