import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { getAnalytics, getOverview, getRecent } from '../services/dashboard.service';

export const overviewController = asyncHandler(async (_req: Request, res: Response) => {
  const overview = await getOverview();
  sendSuccess(res, overview);
});

export const analyticsController = asyncHandler(async (req: Request, res: Response) => {
  const rawDays = req.query.days ? Number.parseInt(String(req.query.days), 10) : undefined;
  const analytics = await getAnalytics(rawDays);
  sendSuccess(res, analytics);
});

export const recentController = asyncHandler(async (_req: Request, res: Response) => {
  const recent = await getRecent(5);
  sendSuccess(res, recent);
});
