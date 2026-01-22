import {
  askAutogradeAgent,
  askDictionaryAgent,
  askGptModel,
  askGrammarAgent,
  askIdeationGuidingAgent,
  askOutlineReviewAgent,
  askRevisionAgent,
  generateVocab,
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

router.post('/ask', authorizeRole(), askGptModel);
router.get('/listing-chat', getGptChatHistory);

router.post('/ask-ideation-guiding', authorizeRole(), askIdeationGuidingAgent);
router.post('/ask-outline-review', authorizeRole(), askOutlineReviewAgent);
router.post('/ask-dictionary', authorizeRole(), askDictionaryAgent);
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
router.post('/generate-vocab', authorizeRole(), generateVocab);

router.get('/latest-structured', getLatestGptStructuredOutput);
router.get('/listing-all-prompt', getGptAllUnstrcturedChatHistory);

export default router;
