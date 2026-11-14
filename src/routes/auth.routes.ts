import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { authLimiter } from '../middleware/rateLimiters';
import {
  loginController,
  logoutController,
  meController,
  refreshController,
} from '../controllers/auth.controller';
import { loginSchema, logoutSchema, refreshSchema } from '../validators/auth.schema';

const router = Router();

router.post('/login', authLimiter, validate({ body: loginSchema }), loginController);
router.post('/refresh', validate({ body: refreshSchema }), refreshController);
router.post('/logout', validate({ body: logoutSchema }), logoutController);
router.get('/me', authenticate, meController);

export default router;
