import mongoose, { Model, Schema } from 'mongoose';

export const DOCTOR_SPECIALIZATIONS = [
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'Gastroenterology',
  'General Medicine',
  'Neurology',
  'Orthopedics',
  'Pediatrics',
  'Psychiatry',
  'Pulmonology',
  'Urology',
] as const;

export type DoctorSpecialization = (typeof DOCTOR_SPECIALIZATIONS)[number];

export interface IDoctor {
  _id: mongoose.Types.ObjectId;
  name: string;
  specialization: DoctorSpecialization;
  hospital: string;
  phone: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

type DoctorModel = Model<IDoctor>;

const doctorSchema = new Schema<IDoctor, DoctorModel>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    specialization: {
      type: String,
      required: true,
      enum: DOCTOR_SPECIALIZATIONS,
      index: true,
    },
    hospital: { type: String, required: true, trim: true, maxlength: 160 },
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
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
  },
  { timestamps: true },
);

doctorSchema.index({ name: 1 });
doctorSchema.index({ hospital: 1 });
doctorSchema.index({ specialization: 1, createdAt: -1 });
doctorSchema.index({ createdAt: -1 });

export const Doctor = mongoose.model<IDoctor, DoctorModel>('Doctor', doctorSchema);
