import mongoose, { Model, Schema, Types } from 'mongoose';
import { DOCTOR_SPECIALIZATIONS, DoctorSpecialization } from './doctor.model';

export const PATIENT_CONDITIONS = [
  'hypertension',
  'diabetes',
  'asthma',
  'cardiac',
  'orthopedic',
  'dermatology',
  'neurological',
  'other',
] as const;

export type PatientCondition = (typeof PATIENT_CONDITIONS)[number];

export const PATIENT_STATUSES = ['active', 'recovering', 'critical', 'discharged'] as const;

export type PatientStatus = (typeof PATIENT_STATUSES)[number];

export interface IPatient {
  _id: Types.ObjectId;
  name: string;
  doctorId: Types.ObjectId;
  phone: string;
  email?: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth?: Date;
  condition: PatientCondition;
  status: PatientStatus;
  address?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

type PatientModel = Model<IPatient>;

const patientSchema = new Schema<IPatient, PatientModel>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (value: string) => /^[+]?[\d][\d\s\-()]{5,19}$/.test(value),
        message: 'phone must be a valid phone number',
      },
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: undefined,
      validate: {
        validator: (value?: string) => !value || /^\S+@\S+\.\S+$/.test(value),
        message: 'email must be a valid email address',
      },
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true,
      index: true,
    },
    dateOfBirth: { type: Date, default: undefined },
    condition: { type: String, enum: PATIENT_CONDITIONS, required: true, index: true },
    status: { type: String, enum: PATIENT_STATUSES, required: true, index: true },
    address: { type: String, trim: true, maxlength: 240, default: undefined },
    notes: { type: String, trim: true, maxlength: 500, default: undefined },
  },
  { timestamps: true },
);

patientSchema.index({ name: 1 });
patientSchema.index({ phone: 1 });
patientSchema.index({ doctorId: 1, createdAt: -1 });
patientSchema.index({ condition: 1, createdAt: -1 });
patientSchema.index({ createdAt: -1 });

export const Patient = mongoose.model<IPatient, PatientModel>('Patient', patientSchema);

export { DOCTOR_SPECIALIZATIONS, DoctorSpecialization };
