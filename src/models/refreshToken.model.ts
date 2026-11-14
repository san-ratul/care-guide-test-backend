import mongoose, { Model, Schema, Types } from 'mongoose';

export interface IRefreshToken {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
  replacedBy?: Types.ObjectId;
  createdAt: Date;
}

type RefreshTokenModel = Model<IRefreshToken>;

const refreshTokenSchema = new Schema<IRefreshToken, RefreshTokenModel>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
    replacedBy: { type: Schema.Types.ObjectId, ref: 'RefreshToken', default: undefined },
  },
  { timestamps: true },
);

// MongoDB TTL index: expired tokens are purged automatically.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model<IRefreshToken, RefreshTokenModel>(
  'RefreshToken',
  refreshTokenSchema,
);
