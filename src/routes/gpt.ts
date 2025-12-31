import {
  askAutogradeAgent,
  askDictionaryAgent,
  askGptModel,
  askGrammarAgent,
  askIdeationAgent,
  askRevisionAgent,
  getGptChatHistory,
  getGptRevisionExplanationByGptLog,
  getGptRevisionExplanationListing,
  getGptUnstrcturedChatHistory as getGptAllUnstrcturedChatHistory,
  getLatestGptStructuredOutput,
  saveRevisionExplanation,
} from 'controllers/gptController';
import { Router } from 'express';
import { authorizeRole } from 'middleware/auth';

const router = Router();

router.post('/ask', askGptModel);
router.get('/listing-chat', getGptChatHistory);

router.post('/ask-ideation', authorizeRole(), askIdeationAgent);
router.post('/ask-dictionary', askDictionaryAgent);
router.post('/ask-grammar', authorizeRole(), askGrammarAgent);
router.post('/ask-autograde', authorizeRole(), askAutogradeAgent);
router.post('/ask-revision', authorizeRole(), askRevisionAgent);
router.post(
  '/submit-revision-explanation',
  authorizeRole(),
  saveRevisionExplanation,
);
router.get(
  '/revision-explanations',
  authorizeRole(),
  getGptRevisionExplanationByGptLog,
);
router.get(
  '/revision-explanation-listing',
  authorizeRole(),
  getGptRevisionExplanationListing,
);

router.get('/latest-structured', getLatestGptStructuredOutput);
router.get('/listing-all-prompt', getGptAllUnstrcturedChatHistory);

export default router;
