import {
  askAutogradeAgent,
  askDictionaryAgent,
  askGptModel,
  askGrammarAgent,
  getGptChatHistory,
  getLatestGptStructuredOutput,
} from 'controllers/gptController';
import { Router } from 'express';
import { authorizeRole } from 'middleware/auth';

const router = Router();

router.post('/ask', askGptModel);
router.get('/listing-chat', getGptChatHistory);
router.post('/ask-dictionary', askDictionaryAgent);
router.post(
  '/ask-grammar',
  authorizeRole(['student', 'teacher', 'admin']),
  askGrammarAgent,
);
router.post(
  '/ask-autograde',
  authorizeRole(['student', 'teacher', 'admin']),
  askAutogradeAgent,
);
router.get('/latest-structured', getLatestGptStructuredOutput);

export default router;
