import {
  getAssignmentSubmissionListing,
  getRecentSubmissions,
  getSubmissionDetails,
  gradeAssignment,
  submitAssignment,
} from 'controllers/assignmentSubmissionController';
import { Router } from 'express';
import { authorizeRole } from 'middleware/auth';

const router = Router();

router.post('/submit', authorizeRole(['student']), submitAssignment);
router.get(
  '/listing',
  authorizeRole(['teacher', 'teaching_assistant', 'admin']),
  getAssignmentSubmissionListing,
);
router.get(
  '/listing-recent',
  authorizeRole(['teacher', 'teaching_assistant', 'admin']),
  getRecentSubmissions,
);
router.get(
  '/view',
  authorizeRole(['teacher', 'teaching_assistant', 'admin']),
  getSubmissionDetails,
);
router.post('/grade', authorizeRole(['teacher', 'admin']), gradeAssignment);

export default router;
