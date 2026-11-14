import { z } from 'zod';
import { emailSchema } from './common.schema';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'password is required' }).min(1, 'password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string({ error: 'refreshToken is required' }).min(32, 'refreshToken is invalid'),
});

export const logoutSchema = refreshSchema;

export type LoginInput = z.infer<typeof loginSchema>;
