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
router.post('/ask-grammar', authorizeRole(), askGrammarAgent);
router.post('/ask-autograde', authorizeRole(), askAutogradeAgent);
router.get('/latest-structured', getLatestGptStructuredOutput);

export default router;
