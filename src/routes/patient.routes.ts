import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createPatientController,
  deletePatientController,
  getPatientController,
  listPatientsController,
  updatePatientController,
} from '../controllers/patient.controller';
import {
  createPatientSchema,
  patientIdParamSchema,
  patientListQuerySchema,
  updatePatientSchema,
} from '../validators/patient.schema';

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: patientListQuerySchema }), listPatientsController);
router.post(
  '/',
  authorize('admin'),
  validate({ body: createPatientSchema }),
  createPatientController,
);
router.get('/:id', validate({ params: patientIdParamSchema }), getPatientController);
router.put(
  '/:id',
  authorize('admin'),
  validate({ params: patientIdParamSchema, body: updatePatientSchema }),
  updatePatientController,
);
router.delete(
  '/:id',
  authorize('admin'),
  validate({ params: patientIdParamSchema }),
  deletePatientController,
);

export default router;
