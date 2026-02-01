import { Response } from 'express';
import {
  fetchAutogradeAgentResponse,
  fetchChatResponse,
  fetchDashboardbGenerationResponse,
  fetchDictionaryAgentResponse,
  fetchGrammarAgentResponse,
  fetchIdeationGuidingAgentResponse,
  fetchOutlineReviewAgentResponse,
  fetchPromptClassificationResponse,
  fetchRevisionAgentResponse,
  fetchVocabGenerationResponse,
} from 'external/chat-service';
import { isArray, isNil, isNumber } from 'lodash-es';
import {
  fetchAssignmentById,
  fetchAssignmentDescriptionById,
  fetchRubricsByAssignmentId,
} from 'models/assignmentModel';
import { fetchAssignmentStagesWithToolsByAssignmentId } from 'models/assignmentStageModel';
import {
  fetchLatestEssaySubmissionByAssignmentIdStudentId,
  fetchLatestOutlineSubmissionByAssignmentIdStudentId,
  fetchLatestSubmissionByStageIdStudentId,
} from 'models/assignmentSubmissionModel';
import {
  fetchAssignmentToolByAssignmentToolId,
  fetchToolSettingsByAssignmentToolId,
} from 'models/assignmentToolModel';
import {
  fetchGptLogsByAssignmentId,
  fetchGptUnstructuredLogCountByUserIdAssignmentId,
  fetchGptUnstructuredLogListingByUserIdAssignmentId,
  fetchGptUnstructuredLogsByUserIdToolId,
  fetchLatestGptLogByUserIdToolId,
  fetchLatestStructuredGptLogsByUserIdToolId,
  fetchStudentRevisionExplanationByGptLogIdsAspectIds,
  fetchStudentRevisionExplanationByUserIdAssignmentId,
  fetchStudentRevisionExplanationCountByUserIdAssignmentId,
  fetchUncategorizedPromptsByAssignmentId,
  saveNewGptLog,
  savePromptCategories,
  saveStudentRevisionExplanation,
} from 'models/gptLogModel';
import { saveNewTraceData } from 'models/traceDataModel';

import {
  AssignmentDraftingContent,
  AssignmentOutliningContent,
  AssignmentReadingContent,
  AssignmentRevisingContent,
} from 'types/db/assignment';
import { GptLog } from 'types/db/gpt';
import {
  StudentRevisionExplanationListingItem,
  VocabGenerateResult,
} from 'types/external/gpt';
import { AuthorizedRequest } from 'types/request';
import { getErrorMessage } from 'utils/getErrorMessage';
import parseListingQuery from 'utils/parseListingQuery';
import parseQueryNumber from 'utils/parseQueryNumber';
import safeJsonParse from 'utils/safeJsonParse';

import { fetchStructuredGptLogsByUserIdToolId } from './../models/gptLogModel';

// TODO: also prepare image
const prepareGptRequest = async (
  req: AuthorizedRequest,
  options?: { questionUnstructuredOnly?: boolean },
) => {
  const isStructured = req.body.is_structured || false;

  if (!req.user?.id) {
    throw new Error('User not authenticated');
  }

  if (!req.body.assignment_tool_id) {
    throw new Error('Chat type required');
  }

  if (
    !req.body.question &&
    !isStructured &&
    !options?.questionUnstructuredOnly
  ) {
    throw new Error('Question required');
  }
  const { question, assignment_tool_id: assignmentToolId } = req.body;

  const settings = await fetchToolSettingsByAssignmentToolId(assignmentToolId);
  if (!settings) {
    throw new Error('Tool settings not found');
  }

  const { rolePrompt, config } = settings;

  const assignmentTool =
    await fetchAssignmentToolByAssignmentToolId(assignmentToolId);
  if (!assignmentTool) {
    throw new Error('Assignment tool not found');
  }

  const { assignment_id: assignmentId, assignment_stage_id: stageId } =
    assignmentTool;

  let taskDescription = '';
  if (assignmentId) {
    taskDescription =
      (await fetchAssignmentDescriptionById(assignmentId)) || '';
  }

  const pastMessageLogs = isStructured
    ? []
    : await fetchLatestGptLogByUserIdToolId(req.user.id, assignmentToolId, 10);

  if (!pastMessageLogs.some(log => log.is_structured)) {
    const latestStructured = await fetchLatestStructuredGptLogsByUserIdToolId(
      req.user.id,
      assignmentToolId,
    );
    if (latestStructured) {
      pastMessageLogs.push(latestStructured);
    }
  }

  pastMessageLogs.sort((a, b) => a.user_ask_time - b.user_ask_time);
  const pastMessages = pastMessageLogs.map(log => ({
    user_question: log.user_question,
    gpt_answer: log.gpt_answer,
  }));

  return {
    userId: req.user.id,
    question,
    assignmentToolId,
    rolePrompt,
    config,
    assignmentId,
    stageId,
    isStructured,
    pastMessages,
    taskDescription,
  };
};

const prepareSubmissionContent = async (
  req: AuthorizedRequest,
  assignmentId: number | undefined,
  config?: { essayOnly?: boolean; outlineOnly?: boolean },
) => {
  if (req.user?.role !== 'student') {
    return { outline: '', essay: '' };
  }
  if (!assignmentId) {
    throw new Error('Essay and assignment ID not given');
  }
  let outline: string = req.body.outline || '';
  let essay: string = req.body.essay || '';
  if (!config?.essayOnly && !outline) {
    const latestOutlineSubmission =
      await fetchLatestOutlineSubmissionByAssignmentIdStudentId(
        assignmentId,
        req.user.id,
      );
    outline =
      (latestOutlineSubmission?.content as AssignmentOutliningContent)
        ?.outline || '';
  }
  if (!config?.outlineOnly && !essay) {
    const latestEssaySubmission =
      await fetchLatestEssaySubmissionByAssignmentIdStudentId(
        assignmentId,
        req.user.id,
      );
    essay =
      (latestEssaySubmission?.content as AssignmentRevisingContent)?.essay ||
      '';
  }
  return { outline, essay };
};

const pendingCategoryLogs: GptLog[] = [];
const CATEGORY_BATCH_SIZE = 5;

const classifyPrompt = async (
  gptlog: GptLog,
  taskDescription: string | null,
  forceBatch?: boolean,
) => {
  pendingCategoryLogs.push(gptlog);
  if (pendingCategoryLogs.length < CATEGORY_BATCH_SIZE && !forceBatch) {
    return;
  }
  const res = await fetchPromptClassificationResponse(
    taskDescription,
    pendingCategoryLogs.map(s => s.user_question),
  );
  if (!res.response.choices[0]) {
    console.error('Invalid response from ChatGPT');
    return;
  }
  const gptAnswer = res.response.choices[0].message.parsed;
  if (!gptAnswer) {
    console.error(
      'No response content from ChatGPT.\nResponse: ' + JSON.stringify(res),
    );
    return;
  }
  const categories = 'categories' in gptAnswer ? gptAnswer.categories : [];
  if (
    !isArray(categories) ||
    categories.length !== pendingCategoryLogs.length ||
    !categories.every(
      (s, index) =>
        s.prompt.slice(0, 3) ===
        pendingCategoryLogs[index].user_question.slice(0, 3),
    ) ||
    !categories.every(
      s => isNumber(s.prompt_nature_code) && isNumber(s.writing_aspect_code),
    )
  ) {
    console.error('Response length mismatch from ChatGPT');
    return;
  }
  savePromptCategories(
    pendingCategoryLogs.map(s => s.id),
    categories.map(s => s.prompt_nature_code),
    categories.map(s => s.writing_aspect_code),
  );
};

export const askGptModel = async (req: AuthorizedRequest, res: Response) => {
  try {
    const {
      userId,
      question,
      assignmentToolId,
      rolePrompt,
      assignmentId,
      stageId,
      pastMessages,
      taskDescription,
      config,
    } = await prepareGptRequest(req);

    const { outline, essay } = await prepareSubmissionContent(
      req,
      assignmentId,
    );

    let rubrics: string | null = null;
    if (assignmentId) {
      rubrics = await fetchRubricsByAssignmentId(assignmentId);
    }

    try {
      const userAskTime = Date.now();
      const chatRes = await fetchChatResponse(
        question,
        rolePrompt,
        outline || '',
        essay || '',
        JSON.stringify(rubrics || ''),
        pastMessages,
        taskDescription || '',
        config,
      );

      if (!chatRes.response.choices[0]) {
        throw new Error('Invalid response from ChatGPT');
      }
      const gptAnswer = chatRes.response.choices[0].message.content;
      if (!gptAnswer) {
        throw new Error(
          'No response content from ChatGPT.\nResponse: ' +
            JSON.stringify(chatRes),
        );
      }

      const gptLog = await saveNewGptLog(
        userId,
        assignmentToolId,
        question,
        gptAnswer,
        JSON.stringify(chatRes.wholeprompt),
        userAskTime,
        Date.now(),
        false,
      );

      await saveNewTraceData(
        userId,
        assignmentId || null,
        stageId || null,
        'ASK_GPT',
        JSON.stringify({
          question,
          answer: gptAnswer,
        }),
      );

      if (assignmentId) {
        classifyPrompt(gptLog, taskDescription);
      }

      return res.json(gptLog);
    } catch (e) {
      console.error(e);
      return res.status(500).json({
        error_message: 'ChatGPT error: ' + getErrorMessage(e),
        error_code: 500,
      });
    }
  } catch (e) {
    return res.status(400).json({
      error_message: (e as Error).message,
      error_code: 400,
    });
  }
};

export const askIdeationGuidingAgent = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  try {
    const {
      userId,
      question,
      assignmentToolId,
      rolePrompt,
      assignmentId,
      stageId,
      isStructured,
      pastMessages,
      taskDescription,
      config,
    } = await prepareGptRequest(req, { questionUnstructuredOnly: true });

    if (!stageId) {
      throw new Error('Invalid assignment stage ID');
    }

    if (!assignmentId) {
      throw new Error('Invalid assignment ID');
    }

    const { outline } = await prepareSubmissionContent(req, assignmentId, {
      outlineOnly: true,
    });
    const rubrics = await fetchRubricsByAssignmentId(assignmentId);

    if (!rubrics) {
      throw new Error('Rubrics not found');
    }

    try {
      const userAskTime = Date.now();
      const chatRes = await fetchIdeationGuidingAgentResponse(
        question,
        outline,
        rolePrompt,
        pastMessages,
        JSON.stringify(rubrics),
        taskDescription || '',
        isStructured,
        config,
      );

      if (!chatRes.response.choices[0]) {
        throw new Error('Invalid response from ChatGPT');
      }
      const gptAnswer = isStructured
        ? chatRes.response.choices[0].message.parsed
        : chatRes.response.choices[0].message.content;
      if (!gptAnswer) {
        throw new Error(
          'No response content from ChatGPT.\nResponse: ' +
            JSON.stringify(chatRes),
        );
      }

      const finalQuestion = isStructured ? 'IDEATION_GUIDING' : question;

      const gptLog = await saveNewGptLog(
        userId,
        assignmentToolId,
        finalQuestion,
        JSON.stringify(gptAnswer),
        JSON.stringify(chatRes.wholeprompt),
        userAskTime,
        Date.now(),
        isStructured,
      );

      await saveNewTraceData(
        userId,
        assignmentId || null,
        stageId,
        'ASK_GPT',
        JSON.stringify({
          question: finalQuestion,
          answer: gptAnswer,
        }),
      );

      if (!isStructured) {
        classifyPrompt(gptLog, taskDescription);
      }

      return res.json(gptLog);
    } catch (e) {
      console.error(e);
      return res.status(500).json({
        error_message: 'ChatGPT error: ' + getErrorMessage(e),
        error_code: 500,
      });
    }
  } catch (e) {
    return res.status(400).json({
      error_message: (e as Error).message,
      error_code: 400,
    });
  }
};

export const askOutlineReviewAgent = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  try {
    const {
      userId,
      question,
      assignmentToolId,
      rolePrompt,
      assignmentId,
      stageId,
      isStructured,
      pastMessages,
      taskDescription,
      config,
    } = await prepareGptRequest(req, { questionUnstructuredOnly: true });

    if (!stageId) {
      throw new Error('Invalid assignment stage ID');
    }

    if (!assignmentId) {
      throw new Error('Invalid assignment ID');
    }

    const { outline } = await prepareSubmissionContent(req, assignmentId, {
      outlineOnly: true,
    });
    const rubrics = await fetchRubricsByAssignmentId(assignmentId);

    if (!rubrics) {
      throw new Error('Rubrics not found');
    }

    try {
      const userAskTime = Date.now();
      const chatRes = await fetchOutlineReviewAgentResponse(
        question,
        outline,
        rolePrompt,
        pastMessages,
        JSON.stringify(rubrics),
        taskDescription || '',
        isStructured,
        config,
      );

      if (!chatRes.response.choices[0]) {
        throw new Error('Invalid response from ChatGPT');
      }
      const gptAnswer = isStructured
        ? chatRes.response.choices[0].message.parsed
        : chatRes.response.choices[0].message.content;
      if (!gptAnswer) {
        throw new Error(
          'No response content from ChatGPT.\nResponse: ' +
            JSON.stringify(chatRes),
        );
      }

      const finalQuestion = isStructured ? 'OUTLINE_REVIEW' : question;

      const gptLog = await saveNewGptLog(
        userId,
        assignmentToolId,
        finalQuestion,
        JSON.stringify(gptAnswer),
        JSON.stringify(chatRes.wholeprompt),
        userAskTime,
        Date.now(),
        isStructured,
      );

      await saveNewTraceData(
        userId,
        assignmentId || null,
        stageId,
        'ASK_GPT',
        JSON.stringify({
          question: finalQuestion,
          answer: gptAnswer,
        }),
      );

      if (!isStructured) {
        classifyPrompt(gptLog, taskDescription);
      }

      return res.json(gptLog);
    } catch (e) {
      console.error(e);
      return res.status(500).json({
        error_message: 'ChatGPT error: ' + getErrorMessage(e),
        error_code: 500,
      });
    }
  } catch (e) {
    return res.status(400).json({
      error_message: (e as Error).message,
      error_code: 400,
    });
  }
};

export const askDictionaryAgent = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  try {
    const {
      userId,
      question,
      assignmentToolId,
      rolePrompt,
      assignmentId,
      stageId,
      isStructured,
      pastMessages,
      taskDescription,
      config,
    } = await prepareGptRequest(req);

    if (!stageId) {
      throw new Error('Invalid assignment stage ID');
    }

    let outline = '';
    let essay = '';
    if (!isStructured) {
      const contents = await prepareSubmissionContent(req, assignmentId);
      outline = contents.outline;
      essay = contents.essay;
    }

    try {
      const userAskTime = Date.now();
      const chatRes = await fetchDictionaryAgentResponse(
        question,
        outline,
        essay,
        rolePrompt,
        pastMessages,
        isStructured,
        config,
      );

      if (!chatRes.response.choices[0]) {
        throw new Error('Invalid response from ChatGPT');
      }
      const gptAnswer = isStructured
        ? chatRes.response.choices[0].message.parsed
        : chatRes.response.choices[0].message.content;
      if (!gptAnswer) {
        throw new Error(
          'No response content from ChatGPT.\nResponse: ' +
            JSON.stringify(chatRes),
        );
      }

      const gptLog = await saveNewGptLog(
        userId,
        assignmentToolId,
        question,
        JSON.stringify(gptAnswer),
        JSON.stringify(chatRes.wholeprompt),
        userAskTime,
        Date.now(),
        isStructured,
      );

      await saveNewTraceData(
        userId,
        assignmentId || null,
        stageId,
        'ASK_GPT',
        JSON.stringify({
          question,
          answer: gptAnswer,
        }),
      );

      if (!isStructured) {
        classifyPrompt(gptLog, taskDescription);
      }

      return res.json(gptLog);
    } catch (e) {
      console.error(e);
      return res.status(500).json({
        error_message: 'ChatGPT error: ' + getErrorMessage(e),
        error_code: 500,
      });
    }
  } catch (e) {
    return res.status(400).json({
      error_message: (e as Error).message,
      error_code: 400,
    });
  }
};

export const askGrammarAgent = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  try {
    const {
      userId,
      question,
      assignmentToolId,
      rolePrompt,
      assignmentId,
      stageId,
      isStructured,
      pastMessages,
      taskDescription,
      config,
    } = await prepareGptRequest(req, { questionUnstructuredOnly: true });

    if (!stageId) {
      throw new Error('Invalid assignment stage ID');
    }

    const { outline, essay } = await prepareSubmissionContent(
      req,
      assignmentId,
    );

    try {
      const userAskTime = Date.now();
      const chatRes = await fetchGrammarAgentResponse(
        question,
        rolePrompt,
        outline,
        essay,
        pastMessages,
        isStructured,
        config,
      );

      if (!chatRes.response.choices[0]) {
        throw new Error('Invalid response from ChatGPT');
      }
      const gptAnswer = isStructured
        ? chatRes.response.choices[0].message.parsed
        : chatRes.response.choices[0].message.content;
      if (!gptAnswer) {
        throw new Error(
          'No response content from ChatGPT.\nResponse: ' +
            JSON.stringify(chatRes),
        );
      }

      const finalQuestion = isStructured ? 'GRAMMAR_CHECK' : question;

      const gptLog = await saveNewGptLog(
        userId,
        assignmentToolId,
        finalQuestion,
        JSON.stringify(gptAnswer),
        JSON.stringify(chatRes.wholeprompt),
        userAskTime,
        Date.now(),
        isStructured,
      );

      await saveNewTraceData(
        userId,
        assignmentId || null,
        stageId,
        'ASK_GPT',
        JSON.stringify({
          question: finalQuestion,
          answer: gptAnswer,
        }),
      );

      if (!isStructured) {
        classifyPrompt(gptLog, taskDescription);
      }

      return res.json(gptLog);
    } catch (e) {
      console.error(e);
      return res.status(500).json({
        error_message: 'ChatGPT error: ' + getErrorMessage(e),
        error_code: 500,
      });
    }
  } catch (e) {
    return res.status(400).json({
      error_message: (e as Error).message,
      error_code: 400,
    });
  }
};

export const askAutogradeAgent = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  try {
    const {
      userId,
      question,
      assignmentToolId,
      rolePrompt,
      assignmentId,
      stageId,
      isStructured,
      pastMessages,
      taskDescription,
      config,
    } = await prepareGptRequest(req, { questionUnstructuredOnly: true });

    if (req.user?.role === 'student' && !stageId) {
      throw new Error('Invalid assignment stage ID');
    }

    const { outline, essay } = await prepareSubmissionContent(
      req,
      assignmentId,
      { essayOnly: isStructured },
    );

    if (!assignmentId) {
      throw new Error('Invalid assignment ID');
    }

    const rubrics = await fetchRubricsByAssignmentId(assignmentId);

    if (!rubrics) {
      throw new Error('Rubrics not found');
    }

    try {
      const userAskTime = Date.now();
      const chatRes = await fetchAutogradeAgentResponse(
        question,
        rolePrompt,
        outline,
        essay,
        JSON.stringify(rubrics),
        pastMessages,
        taskDescription || '',
        isStructured,
        config,
      );

      if (!chatRes.response.choices[0]) {
        throw new Error('Invalid response from ChatGPT');
      }
      const gptAnswer = isStructured
        ? chatRes.response.choices[0].message.parsed
        : chatRes.response.choices[0].message.content;
      if (!gptAnswer) {
        throw new Error(
          'No response content from ChatGPT.\nResponse: ' +
            JSON.stringify(chatRes),
        );
      }

      const finalQuestion = isStructured ? 'AUTOGRADE' : question;

      const gptLog = await saveNewGptLog(
        userId,
        assignmentToolId,
        finalQuestion,
        JSON.stringify(gptAnswer),
        JSON.stringify(chatRes.wholeprompt),
        userAskTime,
        Date.now(),
        isStructured,
      );

      if (req.user?.role === 'student') {
        await saveNewTraceData(
          userId,
          assignmentId || null,
          stageId as number,
          'ASK_GPT',
          JSON.stringify({
            question: finalQuestion,
            answer: gptAnswer,
          }),
        );
      }

      return res.json(gptLog);
    } catch (e) {
      console.error(e);
      return res.status(500).json({
        error_message: 'ChatGPT error: ' + getErrorMessage(e),
        error_code: 500,
      });
    }
  } catch (e) {
    return res.status(400).json({
      error_message: (e as Error).message,
      error_code: 400,
    });
  }
};

export const askRevisionAgent = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  try {
    const {
      userId,
      question,
      assignmentToolId,
      rolePrompt,
      assignmentId,
      stageId,
      isStructured,
      pastMessages,
      taskDescription,
      config,
    } = await prepareGptRequest(req, { questionUnstructuredOnly: true });

    if (!stageId) {
      throw new Error('Invalid assignment stage ID');
    }

    const { outline, essay } = await prepareSubmissionContent(
      req,
      assignmentId,
      { essayOnly: isStructured },
    );

    if (!assignmentId) {
      throw new Error('Invalid assignment ID');
    }

    const rubrics = await fetchRubricsByAssignmentId(assignmentId);

    if (!rubrics) {
      throw new Error('Rubrics not found');
    }

    try {
      const userAskTime = Date.now();
      const chatRes = await fetchRevisionAgentResponse(
        question,
        rolePrompt,
        outline,
        essay,
        JSON.stringify(rubrics),
        pastMessages,
        taskDescription || '',
        isStructured,
        config,
      );

      if (!chatRes.response.choices[0]) {
        throw new Error('Invalid response from ChatGPT');
      }
      const gptAnswer = isStructured
        ? chatRes.response.choices[0].message.parsed
        : chatRes.response.choices[0].message.content;
      if (!gptAnswer) {
        throw new Error(
          'No response content from ChatGPT.\nResponse: ' +
            JSON.stringify(chatRes),
        );
      }

      const finalQuestion = isStructured ? 'REVISION' : question;

      const gptLog = await saveNewGptLog(
        userId,
        assignmentToolId,
        finalQuestion,
        JSON.stringify(gptAnswer),
        JSON.stringify(chatRes.wholeprompt),
        userAskTime,
        Date.now(),
        isStructured,
      );

      await saveNewTraceData(
        userId,
        assignmentId || null,
        stageId,
        'ASK_GPT',
        JSON.stringify({
          question: finalQuestion,
          answer: gptAnswer,
        }),
      );

      if (!isStructured) {
        classifyPrompt(gptLog, taskDescription);
      }

      return res.json(gptLog);
    } catch (e) {
      console.error(e);
      return res.status(500).json({
        error_message: 'ChatGPT error: ' + getErrorMessage(e),
        error_code: 500,
      });
    }
  } catch (e) {
    return res.status(400).json({
      error_message: (e as Error).message,
      error_code: 400,
    });
  }
};

export const getGptChatHistory = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  try {
    const parsedToolId = parseQueryNumber(req.query.assignment_tool_id);
    if (isNil(parsedToolId) || isNaN(parsedToolId)) {
      throw new Error('Invalid assignment tool id');
    }

    const { limit, page } = parseListingQuery(req);

    try {
      const gptLogs = await fetchGptUnstructuredLogsByUserIdToolId(
        req.user.id,
        parsedToolId,
        limit,
        page,
      );

      return res.json({ page, limit, value: gptLogs });
    } catch (err) {
      return res.status(500).json({
        error_message: 'Server error: ' + getErrorMessage(err),
        error_code: 500,
      });
    }
  } catch (e) {
    return res.status(400).json({
      error_message: 'Invalid query parameters: ' + (e as Error).message,
      error_code: 400,
    });
  }
};

export const getLatestGptStructuredOutput = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  const toolIds = safeJsonParse(req.query.assignment_tool_ids as string);
  if (!isArray(toolIds)) {
    return res
      .status(400)
      .json({ error_message: 'Invalid assignment tool ids', error_code: 400 });
  }

  const parsedToolIds = toolIds.map(parseQueryNumber) as number[];

  if (parsedToolIds.some(id => isNil(id) || isNaN(id))) {
    return res
      .status(400)
      .json({ error_message: 'Invalid assignment tool id', error_code: 400 });
  }

  const results = [];
  for (const toolId of parsedToolIds) {
    const gptLog = await fetchLatestStructuredGptLogsByUserIdToolId(
      req.user.id,
      toolId,
    );
    if (gptLog) {
      results.push(gptLog);
    }
  }

  return res.json(results);
};

export const refreshPromptCategories = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  const assignmentIds = req.body.assignment_ids;
  if (!Array.isArray(assignmentIds) || !assignmentIds.every(Number.isInteger)) {
    return res
      .status(400)
      .json({ error_message: 'Invalid assignment ids', error_code: 400 });
  }

  for (const assignmentId of assignmentIds) {
    console.info(`Refreshing prompt categories for assignment ${assignmentId}`);
    const logs = await fetchUncategorizedPromptsByAssignmentId(assignmentId);
    const taskDescription = await fetchAssignmentDescriptionById(assignmentId);
    for (const [index, log] of logs.entries()) {
      console.info(`Refreshing prompt ${log.user_question}`);
      await classifyPrompt(log, taskDescription, index === logs.length - 1);
    }
  }
  return res.sendStatus(200);
};

export const getGptUnstrcturedChatHistory = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  const userId = parseQueryNumber(req.query.user_id) || req.user.id;
  if (!isNumber(userId)) {
    return res
      .status(400)
      .json({ error_message: 'Missing user id', error_code: 400 });
  }

  const assignmentId = parseQueryNumber(req.query.assignment_id);
  if (!isNumber(assignmentId)) {
    return res
      .status(400)
      .json({ error_message: 'Missing assignment id', error_code: 400 });
  }

  try {
    const { limit, page } = parseListingQuery(req);

    try {
      const resObj = { page, limit, value: [] as GptLog[] };

      resObj.value = await fetchGptUnstructuredLogListingByUserIdAssignmentId(
        userId,
        assignmentId,
        limit,
        page,
      );

      if (parseQueryNumber(req.query.skipCount)) {
        return res.json(resObj);
      }

      const count = await fetchGptUnstructuredLogCountByUserIdAssignmentId(
        userId,
        assignmentId,
      );
      return res.json({ ...resObj, count });
    } catch (err) {
      return res.status(500).json({
        error_message: 'Server error: ' + getErrorMessage(err),
        error_code: 500,
      });
    }
  } catch (e) {
    return res.status(400).json({
      error_message: 'Invalid query parameters: ' + (e as Error).message,
      error_code: 400,
    });
  }
};

export const saveRevisionExplanation = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  const {
    gpt_log_id: gptLogId,
    aspect_id: aspectId,
    response_type: responseType,
    explanation,
  } = req.body;

  if (!gptLogId || !aspectId || !responseType) {
    return res
      .status(400)
      .json({ error_message: 'Missing required fields', error_code: 400 });
  }

  try {
    const aiResponseLog = await saveStudentRevisionExplanation(
      req.user.id,
      gptLogId,
      aspectId,
      responseType,
      explanation,
    );

    if (!aiResponseLog) {
      return res
        .status(404)
        .json({ error_message: 'GPT log not found', error_code: 404 });
    }

    return res.json(aiResponseLog);
  } catch (e) {
    return res.status(500).json({
      error_message: 'Server error: ' + (e as Error).message,
      error_code: 500,
    });
  }
};

export const getGptRevisionExplanationByGptLog = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  const gptLogIds = safeJsonParse(req.query.gpt_log_ids as string);
  if (!isArray(gptLogIds)) {
    return res
      .status(400)
      .json({ error_message: 'Invalid GPT Log IDs', error_code: 400 });
  }

  const aspectIds = safeJsonParse(req.query.aspect_ids as string);
  if (!isArray(aspectIds)) {
    return res
      .status(400)
      .json({ error_message: 'Invalid aspect IDs', error_code: 400 });
  }

  try {
    const explanations =
      await fetchStudentRevisionExplanationByGptLogIdsAspectIds(
        gptLogIds as number[],
        aspectIds as string[],
      );
    return res.json(explanations);
  } catch (e) {
    return res.status(500).json({
      error_message: 'Server error: ' + (e as Error).message,
      error_code: 500,
    });
  }
};

export const getGptRevisionExplanationListing = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  try {
    const { limit, page } = parseListingQuery(req);

    const studentId = parseQueryNumber(req.query.student_id);
    if (isNil(studentId) || isNaN(studentId)) {
      return res
        .status(400)
        .json({ error_message: 'Invalid student ID', error_code: 400 });
    }

    const assignmentId = parseQueryNumber(req.query.assignment_id);
    if (isNil(assignmentId) || isNaN(assignmentId)) {
      return res
        .status(400)
        .json({ error_message: 'Invalid assignment ID', error_code: 400 });
    }

    try {
      const resObj = {
        page,
        limit,
        value: [] as StudentRevisionExplanationListingItem[],
      };
      resObj.value = await fetchStudentRevisionExplanationByUserIdAssignmentId(
        studentId,
        assignmentId,
        limit,
        page,
      );

      if (req.query.skipCount) {
        return res.json(resObj);
      }

      const count =
        await fetchStudentRevisionExplanationCountByUserIdAssignmentId(
          studentId,
          assignmentId,
        );
      return res.json({ ...resObj, count });
    } catch (e) {
      return res.status(500).json({
        error_message: 'Server error: ' + (e as Error).message,
        error_code: 500,
      });
    }
  } catch (e) {
    return res.status(400).json({
      error_message: 'Invalid query parameters: ' + (e as Error).message,
      error_code: 400,
    });
  }
};

export const generateVocab = async (req: AuthorizedRequest, res: Response) => {
  try {
    const {
      userId,
      rolePrompt,
      assignmentId,
      assignmentToolId,
      stageId,
      taskDescription,
      config,
    } = await prepareGptRequest(req, { questionUnstructuredOnly: true });

    if (!assignmentId) {
      throw new Error('Invalid assignment ID');
    }

    if (!stageId) {
      throw new Error('Invalid assignment stage ID');
    }

    const rubrics = (await fetchRubricsByAssignmentId(assignmentId)) || '';

    try {
      const userAskTime = Date.now();
      const chatRes = await fetchVocabGenerationResponse(
        rolePrompt,
        JSON.stringify(rubrics),
        taskDescription || '',
        config,
      );

      if (!chatRes.response.choices[0]) {
        throw new Error('Invalid response from ChatGPT');
      }
      const gptAnswer = chatRes.response.choices[0].message.parsed;
      if (!gptAnswer) {
        throw new Error(
          'No response content from ChatGPT.\nResponse: ' +
            JSON.stringify(chatRes),
        );
      }

      const gptLog = await saveNewGptLog(
        userId,
        assignmentToolId,
        'VOCAB_GENERATE',
        JSON.stringify(gptAnswer),
        JSON.stringify(chatRes.wholeprompt),
        userAskTime,
        Date.now(),
        true,
      );

      await saveNewTraceData(
        userId,
        assignmentId || null,
        stageId,
        'VOCAB_GENERATE',
        JSON.stringify({
          answer: gptAnswer,
        }),
      );

      return res.json(gptLog);
    } catch (e) {
      console.error(e);
      return res.status(500).json({
        error_message: 'ChatGPT error: ' + getErrorMessage(e),
        error_code: 500,
      });
    }
  } catch (e) {
    return res.status(400).json({
      error_message: (e as Error).message,
      error_code: 400,
    });
  }
};

export const generateDashboard = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  try {
    const {
      userId,
      rolePrompt,
      assignmentId,
      assignmentToolId,
      stageId,
      taskDescription,
      config,
    } = await prepareGptRequest(req, { questionUnstructuredOnly: true });

    const assignment = await fetchAssignmentById(assignmentId || 0);

    if (!assignmentId || !assignment) {
      throw new Error('Invalid assignment ID');
    }

    if (!stageId) {
      throw new Error('Invalid assignment stage ID');
    }

    const rubrics = (await fetchRubricsByAssignmentId(assignmentId)) || '';

    const assignmentStages =
      await fetchAssignmentStagesWithToolsByAssignmentId(assignmentId);

    const readingStage = assignmentStages.find(s => s.stage_type === 'reading');
    let annotations: { text: string; color: string; note: string }[] = [];
    if (readingStage) {
      const latestReadingSubmission = (
        await fetchLatestSubmissionByStageIdStudentId(readingStage.id, userId)
      )?.content as AssignmentReadingContent;
      const latestAnnotations = latestReadingSubmission?.annotations || [];
      annotations = latestAnnotations.map(a => ({
        text: a.text,
        color: a.color,
        note: a.note,
      }));
    }

    const languageStage = assignmentStages.find(
      s => s.stage_type === 'language_preparation',
    );
    let generatedVocabs: string[] = [];
    if (languageStage) {
      const generateLogs = await fetchStructuredGptLogsByUserIdToolId(
        userId,
        languageStage.id,
      );
      generatedVocabs = generateLogs.flatMap(log =>
        (safeJsonParse(log.gpt_answer) as VocabGenerateResult).items.map(
          item => item.text,
        ),
      );
    }

    const outlineStage = assignmentStages.find(
      s => s.stage_type === 'outlining',
    );
    let outline = '';
    if (outlineStage) {
      const outlineSubmission = (
        await fetchLatestSubmissionByStageIdStudentId(outlineStage.id, userId)
      )?.content as AssignmentOutliningContent;
      outline = outlineSubmission?.outline || '';
    }

    const draftingStage = assignmentStages.find(
      s => s.stage_type === 'drafting',
    );
    let essayDraft = '';
    let essayDraftTitle = '';
    if (draftingStage) {
      const draftingSubmission = (
        await fetchLatestSubmissionByStageIdStudentId(draftingStage.id, userId)
      )?.content as AssignmentDraftingContent;
      essayDraft = draftingSubmission?.essay || '';
      essayDraftTitle = draftingSubmission?.title || '';
    }

    const revisingStage = assignmentStages.find(
      s => s.stage_type === 'revising',
    );
    let revisedEssay = '';
    let revisedEssayTitle = '';
    if (revisingStage) {
      const revisingSubmission = (
        await fetchLatestSubmissionByStageIdStudentId(revisingStage.id, userId)
      )?.content as AssignmentRevisingContent;
      revisedEssay = revisingSubmission?.essay || '';
      revisedEssayTitle = revisingSubmission?.title || '';
    }

    const checklist = safeJsonParse(assignment.checklist || '[]') || [];

    const gptLogs = (await fetchGptLogsByAssignmentId(assignmentId))
      .filter(log => log.user_question !== 'DASHBOARD_GENERATE')
      .map(log => ({
        user_question: log.user_question,
        gpt_answer: log.gpt_answer,
      }));

    try {
      const userAskTime = Date.now();
      const chatRes = await fetchDashboardbGenerationResponse(
        rolePrompt,
        taskDescription || '',
        JSON.stringify(rubrics),
        annotations,
        generatedVocabs,
        outline,
        essayDraft,
        essayDraftTitle,
        revisedEssay,
        revisedEssayTitle,
        checklist,
        gptLogs,
        config,
      );

      if (!chatRes.response.choices[0]) {
        throw new Error('Invalid response from ChatGPT');
      }
      const gptAnswer = chatRes.response.choices[0].message.parsed;
      if (!gptAnswer) {
        throw new Error(
          'No response content from ChatGPT.\nResponse: ' +
            JSON.stringify(chatRes),
        );
      }

      const gptLog = await saveNewGptLog(
        userId,
        assignmentToolId,
        'DASHBOARD_GENERATE',
        JSON.stringify(gptAnswer),
        JSON.stringify(chatRes.wholeprompt),
        userAskTime,
        Date.now(),
        true,
      );

      await saveNewTraceData(
        userId,
        assignmentId || null,
        stageId,
        'DASHBOARD_GENERATE',
        JSON.stringify({
          answer: gptAnswer,
        }),
      );

      return res.json({
        usage_data: {
          annotations,
          generatedVocabs,
          checklist,
        },
        gpt_log: gptLog,
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({
        error_message: 'ChatGPT error: ' + getErrorMessage(e),
        error_code: 500,
      });
    }
  } catch (e) {
    return res.status(400).json({
      error_message: (e as Error).message,
      error_code: 400,
    });
  }
};
