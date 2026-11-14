import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createPatientUnderDoctorController,
  createDoctorController,
  deleteDoctorController,
  doctorPatientsController,
  getDoctorController,
  listDoctorsController,
  updateDoctorController,
} from '../controllers/doctor.controller';
import {
  createDoctorSchema,
  doctorIdParamSchema,
  doctorListQuerySchema,
  updateDoctorSchema,
} from '../validators/doctor.schema';
import { doctorPatientsQuerySchema, createPatientSchema } from '../validators/patient.schema';

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: doctorListQuerySchema }), listDoctorsController);
router.post(
  '/',
  authorize('admin'),
  validate({ body: createDoctorSchema }),
  createDoctorController,
);
router.get('/:id', validate({ params: doctorIdParamSchema }), getDoctorController);
router.put(
  '/:id',
  authorize('admin'),
  validate({ params: doctorIdParamSchema, body: updateDoctorSchema }),
  updateDoctorController,
);
router.delete(
  '/:id',
  authorize('admin'),
  validate({ params: doctorIdParamSchema }),
  deleteDoctorController,
);
router.get(
  '/:id/patients',
  validate({ params: doctorIdParamSchema, query: doctorPatientsQuerySchema }),
  doctorPatientsController,
);
router.post(
  '/:id/patients',
  authorize('admin'),
  validate({ params: doctorIdParamSchema }),
  // The path doctor is authoritative for this endpoint.
  (req, _res, next) => {
    req.body = { ...req.body, doctorId: req.params.id };
    next();
  },
  validate({ body: createPatientSchema }),
  createPatientUnderDoctorController,
);

export default router;
