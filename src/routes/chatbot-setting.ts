import {
  getTemplateListing,
  updateAssignmentToolSettings,
  updateGeneralSettings,
} from 'controllers/chatbotSettingController';
import { Router } from 'express';
import { authorizeRole } from 'middleware/auth';

const router = Router();

router.get('/listing', authorizeRole(['admin']), getTemplateListing);
router.post('/update-general', authorizeRole(['admin']), updateGeneralSettings);
router.post('/update', authorizeRole(['admin']), updateAssignmentToolSettings);

export default router;
