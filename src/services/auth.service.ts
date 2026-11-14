import { HydratedDocument } from 'mongoose';
import { env } from '../config/env';
import { RefreshToken } from '../models/refreshToken.model';
import { IUser, User } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { generateRefreshToken, hashToken, signAccessToken } from '../utils/jwt';
import { LoginInput } from '../validators/auth.schema';

export interface AuthSession {
  user: HydratedDocument<IUser>;
  accessToken: string;
  refreshToken: string;
}

const REFRESH_TTL_MS = env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000;

async function createRefreshToken(userId: string): Promise<string> {
  const rawToken = generateRefreshToken();
  await RefreshToken.create({
    user: userId,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return rawToken;
}

function buildSession(user: HydratedDocument<IUser>, refreshToken: string): AuthSession {
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
  });
  return { user, accessToken, refreshToken };
}

export async function login(input: LoginInput): Promise<AuthSession> {
  const user = await User.findOne({ email: input.email.toLowerCase() }).select('+password');
  if (!user) {
    // Uniform message prevents user enumeration.
    throw ApiError.unauthorized('Invalid email or password');
  }

  const passwordMatches = await user.comparePassword(input.password);
  if (!passwordMatches) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const refreshToken = await createRefreshToken(user._id.toString());
  return buildSession(user, refreshToken);
}

/** Rotates the refresh token: the presented one is revoked and a brand new pair is issued. */
export async function refreshSession(rawRefreshToken: string): Promise<AuthSession> {
  const tokenHash = hashToken(rawRefreshToken);
  const stored = await RefreshToken.findOne({ tokenHash });

  if (!stored || stored.revoked || stored.expiresAt.getTime() < Date.now()) {
    throw ApiError.unauthorized('Refresh token is invalid or expired', 'REFRESH_INVALID');
  }

  const user = await User.findById(stored.user);
  if (!user) {
    throw ApiError.unauthorized('User no longer exists', 'REFRESH_INVALID');
  }

  const replacement = await createRefreshToken(user._id.toString());

  stored.revoked = true;
  await stored.save();

  return buildSession(user, replacement);
}

export async function logout(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashToken(rawRefreshToken);
  await RefreshToken.updateOne({ tokenHash, revoked: false }, { revoked: true });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await RefreshToken.updateMany({ user: userId, revoked: false }, { revoked: true });
}

export function toPublicUser(user: {
  _id: { toString(): string };
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}
