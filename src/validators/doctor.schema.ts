import { z } from 'zod';
import {
  dateStringSchema,
  emailSchema,
  objectIdSchema,
  phoneSchema,
  sortOrderSchema,
} from './common.schema';
import { DOCTOR_SPECIALIZATIONS } from '../models/doctor.model';

export const createDoctorSchema = z.object({
  name: z.string({ error: 'name is required' }).trim().min(2).max(120),
  specialization: z.enum(DOCTOR_SPECIALIZATIONS, {
    error: 'specialization is not a supported value',
  }),
  hospital: z.string({ error: 'hospital is required' }).trim().min(2).max(160),
  phone: phoneSchema,
  email: emailSchema,
});

export const updateDoctorSchema = createDoctorSchema.partial();

export const doctorIdParamSchema = z.object({
  id: objectIdSchema,
});

export const doctorListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().max(120).optional(),
  specialization: z
    .enum(DOCTOR_SPECIALIZATIONS, {
      error: 'specialization filter is not supported',
    })
    .optional(),
  hospital: z.string().trim().max(160).optional(),
  createdFrom: dateStringSchema.optional(),
  createdTo: dateStringSchema.optional(),
  sortBy: z.enum(['name', 'createdAt', 'specialization']).default('createdAt'),
  sortOrder: sortOrderSchema,
});

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;
export type DoctorListQuery = z.infer<typeof doctorListQuerySchema>;
