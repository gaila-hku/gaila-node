import { Response } from 'express';
import {
  fetchAutogradeAgentResponse,
  fetchChatResponse,
  fetchDictionaryAgentResponse,
  fetchGrammarAgentResponse,
  fetchIdeationGuidingAgentResponse,
  fetchOutlineReviewAgentResponse,
  fetchPromptClassificationResponse,
  fetchRevisionAgentResponse,
} from 'external/chat-service';
import { isArray, isNil, isNumber } from 'lodash-es';
import {
  fetchAssignmentDescriptionById,
  fetchRubricsByAssignmentId,
} from 'models/assignmentModel';
import { fetchLatestSubmissionByStageIdStudentId } from 'models/assignmentSubmissionModel';
import {
  fetchAssignmentToolByAssignmentToolId,
  fetchToolSettingsByAssignmentToolId,
} from 'models/assignmentToolModel';
import {
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

import { GptLog } from 'types/db/gpt';
import { StudentRevisionExplanationListingItem } from 'types/external/gpt';
import { AuthorizedRequest } from 'types/request';
import parseListingQuery from 'utils/parseListingQuery';
import parseQueryNumber from 'utils/parseQueryNumber';
import safeJsonParse from 'utils/safeJsonParse';

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

  if (!assignmentId) {
    throw new Error('Invalid assignment tool');
  }

  const taskDescription = await fetchAssignmentDescriptionById(assignmentId);

  const pastMessages = isStructured
    ? []
    : await fetchLatestGptLogByUserIdToolId(req.user.id, assignmentToolId, 5);

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
  stageId: number | undefined,
  config?: { essayOnly?: boolean; outlineOnly?: boolean },
) => {
  if (req.user?.role !== 'student') {
    return '';
  }
  if (req.body.essay) {
    return req.body.essay;
  }
  if (!stageId) {
    throw new Error('Essay not given and assignment stage not found');
  }
  const latestEssaySubmission = await fetchLatestSubmissionByStageIdStudentId(
    stageId,
    req.user.id,
  );
  if (!latestEssaySubmission) {
    throw new Error('Essay not given and assignment submission not found');
  }
  const submissionContent = latestEssaySubmission.content;
  if (!submissionContent) {
    return '';
  }
  if (config?.outlineOnly) {
    if ('outline' in submissionContent) {
      return submissionContent.outline;
    }
    return '';
  }
  if (config?.essayOnly) {
    if ('essay' in submissionContent) {
      return submissionContent.essay;
    }
    return '';
  }

  return JSON.stringify(submissionContent);
};

const pendingCateogryLogs: GptLog[] = [];
const CATEGORY_BATCH_SIZE = 5;

const classifyPrompt = async (
  gptlog: GptLog,
  taskDescription: string | null,
  forceBatch?: boolean,
) => {
  pendingCateogryLogs.push(gptlog);
  if (pendingCateogryLogs.length < CATEGORY_BATCH_SIZE && !forceBatch) {
    return;
  }
  const res = await fetchPromptClassificationResponse(
    taskDescription,
    pendingCateogryLogs.map(s => s.user_question),
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
    categories.length !== pendingCateogryLogs.length ||
    !categories.every(
      (s, index) =>
        s.prompt ===
        pendingCateogryLogs[index].user_question.replace(/\s\s+/g, ' '),
    ) ||
    !categories.every(
      s => isNumber(s.prompt_nature_code) && isNumber(s.writing_aspect_code),
    )
  ) {
    console.error('Response length mismatch from ChatGPT');
    return;
  }
  savePromptCategories(
    pendingCateogryLogs.map(s => s.id),
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

    const submissionContent = await prepareSubmissionContent(req, stageId);

    let rubrics: string | null = null;
    if (assignmentId) {
      rubrics = await fetchRubricsByAssignmentId(assignmentId);
    }

    try {
      const userAskTime = Date.now();
      const chatRes = await fetchChatResponse(
        question,
        rolePrompt,
        submissionContent || '',
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
        error_message: 'ChatGPT error: ' + JSON.stringify(e),
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

    const outline = await prepareSubmissionContent(req, stageId, {
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
        error_message: 'ChatGPT error: ' + JSON.stringify(e),
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

    const outline = await prepareSubmissionContent(req, stageId, {
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
        error_message: 'ChatGPT error: ' + JSON.stringify(e),
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

    try {
      const userAskTime = Date.now();
      const chatRes = await fetchDictionaryAgentResponse(
        question,
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
        error_message: 'ChatGPT error: ' + JSON.stringify(e),
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

    const submissionContent = await prepareSubmissionContent(req, stageId);

    try {
      const userAskTime = Date.now();
      const chatRes = await fetchGrammarAgentResponse(
        question,
        rolePrompt,
        submissionContent,
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
        error_message: 'ChatGPT error: ' + JSON.stringify(e),
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

    const essay = await prepareSubmissionContent(req, stageId, {
      essayOnly: true,
    });

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
        error_message: 'ChatGPT error: ' + JSON.stringify(e),
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

    const essay = await prepareSubmissionContent(req, stageId, {
      essayOnly: true,
    });

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
        error_message: 'ChatGPT error: ' + JSON.stringify(e),
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
        error_message: 'Server error: ' + JSON.stringify(err),
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

  const userId = parseQueryNumber(req.query.user_id);
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
        error_message: 'Server error: ' + JSON.stringify(err),
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
