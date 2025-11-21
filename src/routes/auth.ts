import { Router } from 'express';
import { authorizeRole } from 'middleware/auth';

import {
  createUser,
  loginUser,
  refreshToken,
} from '../controllers/authController';

const router = Router();

router.post('/login', loginUser);
router.post('/refresh', refreshToken);
router.post('/create', authorizeRole(['admin']), createUser);

export default router;
