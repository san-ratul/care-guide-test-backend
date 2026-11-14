import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import {
  createPatient,
  deletePatient,
  getPatientById,
  listPatients,
  updatePatient,
} from '../services/patient.service';
import {
  CreatePatientInput,
  PatientListQuery,
  UpdatePatientInput,
} from '../validators/patient.schema';

export const createPatientController = asyncHandler(async (req: Request, res: Response) => {
  const patient = await createPatient(req.body as CreatePatientInput);
  sendSuccess(res, patient, { status: 201, message: 'Patient created successfully' });
});

export const listPatientsController = asyncHandler(async (req: Request, res: Response) => {
  const { patients, meta } = await listPatients(req.query as unknown as PatientListQuery);
  sendSuccess(res, patients, { meta });
});

export const getPatientController = asyncHandler(async (req: Request, res: Response) => {
  const patient = await getPatientById(req.params.id);
  sendSuccess(res, patient);
});

export const updatePatientController = asyncHandler(async (req: Request, res: Response) => {
  const patient = await updatePatient(req.params.id, req.body as UpdatePatientInput);
  sendSuccess(res, patient, { message: 'Patient updated successfully' });
});

export const deletePatientController = asyncHandler(async (req: Request, res: Response) => {
  await deletePatient(req.params.id);
  sendSuccess(res, { deleted: true }, { message: 'Patient deleted successfully' });
});
