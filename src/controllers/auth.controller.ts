import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { login, logout, refreshSession, toPublicUser } from '../services/auth.service';

export const loginController = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  const session = await login({ email, password });

  sendSuccess(
    res,
    {
      user: toPublicUser(session.user),
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    },
    { message: 'Logged in successfully' },
  );
});

export const refreshController = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken: string };
  const session = await refreshSession(refreshToken);

  sendSuccess(res, {
    user: toPublicUser(session.user),
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  });
});

export const logoutController = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (refreshToken) {
    await logout(refreshToken);
  }
  sendSuccess(res, { loggedOut: true }, { message: 'Logged out successfully' });
});

export const meController = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, { user: toPublicUser(req.user!) });
});
