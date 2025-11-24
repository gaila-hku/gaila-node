import {
  createAssignment,
  getAssignmentDetails,
  getAssignmentListing,
  getAssignmentOptions,
  getAssignmentProgressDetails,
  getStudentAssignmentAnalytics,
  updateAssignment,
} from 'controllers/assignmentController';
import { Router } from 'express';
import { authorizeRole } from 'middleware/auth';

const router = Router();

router.get('/listing', authorizeRole(), getAssignmentListing);
router.get('/view', authorizeRole(), getAssignmentDetails);
router.post('/create', authorizeRole(['teacher', 'admin']), createAssignment);
router.post('/update', authorizeRole(['teacher', 'admin']), updateAssignment);
router.get('/view-progress', authorizeRole(), getAssignmentProgressDetails);
router.get(
  '/analytics-student',
  authorizeRole(['student']),
  getStudentAssignmentAnalytics,
);
router.get(
  '/analytics-teacher',
  authorizeRole(['teacher', 'teaching_assistant', 'admin']),
  getStudentAssignmentAnalytics,
);
router.get('/options', authorizeRole(), getAssignmentOptions);

export default router;
