import { Router } from 'express';
import { authorizeRole } from 'middleware/auth';

import upload from 'config/multer-upload';

import {
  createUser,
  deleteUser,
  getClassOptions,
  getStudentOptions,
  getUserListing,
  getUserProfile,
  modifyUser,
  updateUserProfile,
  uploadUser,
} from '../controllers/userController';

const router = Router();

router.get(
  '/class-options',
  authorizeRole(['teacher', 'teaching_assistant', 'admin']),
  getClassOptions,
);
router.get(
  '/student-options',
  authorizeRole(['teacher', 'teaching_assistant', 'admin']),
  getStudentOptions,
);
router.get('/listing', authorizeRole(['admin']), getUserListing);
router.post('/update', authorizeRole(['admin']), modifyUser);
router.post('/create', authorizeRole(['admin']), createUser);
router.post('/delete', authorizeRole(['admin']), deleteUser);
router.post(
  '/upload',
  authorizeRole(['admin']),
  upload.single('file'),
  uploadUser,
);
router.get('/profile', authorizeRole(), getUserProfile);
router.post('/update-profile', authorizeRole(), updateUserProfile);

export default router;
