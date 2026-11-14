import bcrypt from 'bcryptjs';
import mongoose, { HydratedDocument, Model, Schema } from 'mongoose';
import { env } from '../config/env';

export interface IUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: 'admin';
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

type UserModel = Model<IUser>;

const userSchema = new Schema<IUser, UserModel>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin'], default: 'admin', required: true },
  },
  { timestamps: true },
);

userSchema.methods.comparePassword = async function (
  this: HydratedDocument<IUser>,
  candidate: string,
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, env.BCRYPT_COST);
  next();
});

export const User = mongoose.model<IUser, UserModel>('User', userSchema);
