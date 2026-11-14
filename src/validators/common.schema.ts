import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid id');

export const emailSchema = z
  .string({ error: 'email is required' })
  .trim()
  .toLowerCase()
  .regex(/^\S+@\S+\.\S+$/, 'Must be a valid email address');

export const phoneSchema = z
  .string({ error: 'phone is required' })
  .trim()
  .regex(/^[+]?[\d][\d\s\-()]{5,19}$/, 'Must be a valid phone number');

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid calendar date');

export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');
