import { refreshPromptCategories } from 'controllers/gptController';
import { Router } from 'express';

const router = Router();

router.get('/health', (req, res) => {
  res.sendStatus(200);
});
router.get('/version', (req, res) => {
  res.json({ version: '0.0.1' });
});

router.post('/refresh-categories', refreshPromptCategories);

export default router;
