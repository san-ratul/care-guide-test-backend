import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

function extractBearerToken(header: string | undefined): string {
  if (!header || !header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing or malformed Authorization header');
  }
  return header.slice(7).trim();
}

export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractBearerToken(req.headers.authorization);

    let payload: { sub?: string };
    try {
      payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as {
        sub?: string;
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw ApiError.unauthorized('Access token expired', 'TOKEN_EXPIRED');
      }
      throw ApiError.unauthorized('Invalid access token', 'TOKEN_INVALID');
    }

    if (!payload.sub) {
      throw ApiError.unauthorized('Invalid access token', 'TOKEN_INVALID');
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      throw ApiError.unauthorized('User no longer exists', 'TOKEN_INVALID');
    }

    req.user = user;
    next();
  },
);

export const authorize =
  (...roles: Array<IUser['role']>) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden());
    }
    return next();
  };
