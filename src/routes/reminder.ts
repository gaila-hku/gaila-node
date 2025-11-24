import {
  getReminderListing,
  sendReminder,
} from 'controllers/reminderController';
import { Router } from 'express';
import { authorizeRole } from 'middleware/auth';

const router = Router();

router.get('/listing', getReminderListing);
router.post('/send', authorizeRole(['teacher', 'admin']), sendReminder);

export default router;
