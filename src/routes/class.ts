import {
  createClass,
  getAllClasses,
  getClassDetails,
  getUserClasses,
  updateClass,
} from 'controllers/classController';
import { Router } from 'express';
import { authorizeRole } from 'middleware/auth';

const router = Router();

router.get('/listing', authorizeRole(), getUserClasses);
router.get('/view', authorizeRole(), getClassDetails);

router.get('/listing-all', authorizeRole(['admin']), getAllClasses);
router.post('/create', authorizeRole(['admin']), createClass);
router.post('/update', authorizeRole(['admin']), updateClass);

export default router;
