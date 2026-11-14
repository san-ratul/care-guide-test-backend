import { z } from 'zod';
import {
  dateStringSchema,
  emailSchema,
  objectIdSchema,
  phoneSchema,
  sortOrderSchema,
} from './common.schema';
import { PATIENT_CONDITIONS, PATIENT_STATUSES } from '../models/patient.model';

const optionalDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid calendar date')
  .optional();

export const createPatientSchema = z.object({
  name: z.string({ error: 'name is required' }).trim().min(2).max(120),
  doctorId: objectIdSchema,
  phone: phoneSchema,
  email: emailSchema.optional(),
  gender: z.enum(['male', 'female', 'other'], {
    error: 'gender must be male, female or other',
  }),
  dateOfBirth: optionalDateString,
  condition: z.enum(PATIENT_CONDITIONS, {
    error: 'condition is not a supported value',
  }),
  status: z.enum(PATIENT_STATUSES, {
    error: 'status is not a supported value',
  }),
  address: z.string().trim().max(240).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const updatePatientSchema = createPatientSchema
  .partial()
  .omit({ doctorId: true })
  .extend({ doctorId: objectIdSchema.optional() });

export const patientIdParamSchema = z.object({
  id: objectIdSchema,
});

export const patientListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().max(120).optional(),
  doctorId: objectIdSchema.optional(),
  condition: z
    .enum(PATIENT_CONDITIONS, {
      error: 'condition filter is not supported',
    })
    .optional(),
  status: z
    .enum(PATIENT_STATUSES, {
      error: 'status filter is not supported',
    })
    .optional(),
  gender: z
    .enum(['male', 'female', 'other'], {
      error: 'gender filter is not supported',
    })
    .optional(),
  createdFrom: dateStringSchema.optional(),
  createdTo: dateStringSchema.optional(),
  sortBy: z.enum(['name', 'createdAt', 'condition', 'status']).default('createdAt'),
  sortOrder: sortOrderSchema,
});

export const doctorPatientsQuerySchema = patientListQuerySchema.omit({ doctorId: true });

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type PatientListQuery = z.infer<typeof patientListQuerySchema>;
