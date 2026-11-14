import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  analyticsController,
  overviewController,
  recentController,
} from '../controllers/dashboard.controller';

const router = Router();

router.use(authenticate);

router.get('/overview', overviewController);
router.get('/analytics', analyticsController);
router.get('/recent', recentController);

export default router;
