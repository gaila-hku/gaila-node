import { Response } from 'express';
import {
  fetchAutogradeAgentResponse,
  fetchChatResponse,
  fetchDictionaryAgentResponse,
  fetchGrammarAgentResponse,
  fetchPromptClassificationResponse,
} from 'external/chat-service';
import { isArray, isNil, isNumber } from 'lodash-es';
import {
  fetchAssignmentDescriptionById,
  fetchRubricsByAssignmentId,
} from 'models/assignmentModel';
import { fetchLatestSubmissionByStageIdStudentId } from 'models/assignmentSubmissionModel';
import {
  fetchAssignmentToolByAssignmentToolId,
  fetchRolePromptByAssignmentToolId,
} from 'models/assignmentToolModel';
import {
  fetchGptUnstructuredLogsByUserIdToolId,
  fetchLatestGptLogByUserIdToolId,
  fetchLatestStructuredGptLogsByUserIdToolId,
  fetchUncategorizedPromptsByAssignmentId,
  saveNewGptLog,
  savePromptCategories,
} from 'models/gptLogModel';
import { saveNewTraceData } from 'models/traceDataModel';

import { GptLog } from 'types/gpt';
import { AuthorizedRequest } from 'types/request';
import parseQueryNumber from 'utils/parseQueryNumber';

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

  const rolePrompt = await fetchRolePromptByAssignmentToolId(assignmentToolId);
  if (!rolePrompt) {
    throw new Error('Role prompt not found');
  }

  const assignmentTool =
    await fetchAssignmentToolByAssignmentToolId(assignmentToolId);
  if (!assignmentTool) {
    throw new Error('Assignment tool not found');
  }

  const { assignment_id: assignmentId, assignment_stage_id: stageId } =
    assignmentTool;

  if (!assignmentId) {
    throw new Error('Invalid assignment tool ID');
  }

  const pastMessages = isStructured
    ? []
    : await fetchLatestGptLogByUserIdToolId(req.user.id, assignmentToolId, 5);

  return {
    userId: req.user.id,
    question,
    assignmentToolId,
    rolePrompt,
    assignmentId,
    stageId,
    isStructured,
    pastMessages,
  };
};

const preapreGptEssay = async (
  req: AuthorizedRequest,
  stageId: number | undefined,
) => {
  let essay = req.body.essay || '';
  if (!essay && req.user?.role === 'student') {
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
    const submissionContent = latestEssaySubmission.content as any;
    if ('content' in submissionContent) {
      essay = submissionContent.content;
    } else {
      essay = JSON.stringify(submissionContent);
    }
  }

  return essay;
};

const pendingCateogryLogs: GptLog[] = [];
const CATEGORY_BATCH_SIZE = 5;

const classifyPrompt = async (
  gptlog: GptLog,
  assignmentId: number,
  forceBatch?: boolean,
) => {
  pendingCateogryLogs.push(gptlog);
  if (pendingCateogryLogs.length < CATEGORY_BATCH_SIZE && !forceBatch) {
    return;
  }
  const taskDescription = await fetchAssignmentDescriptionById(assignmentId);
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
    console.error('No response content from ChatGPT');
    return;
  }
  const categories = 'categories' in gptAnswer ? gptAnswer.categories : [];
  if (
    !isArray(categories) ||
    categories.length !== pendingCateogryLogs.length ||
    !categories.every(
      (s, index) => s.prompt === pendingCateogryLogs[index].user_question,
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
    } = await prepareGptRequest(req);

    if (!stageId) {
      throw new Error('Invalid assignment tool ID');
    }

    const essay = await preapreGptEssay(req, stageId);

    const rubrics = await fetchRubricsByAssignmentId(assignmentId);

    try {
      const userAskTime = Date.now();
      const chatRes = await fetchChatResponse(
        question,
        rolePrompt,
        essay || '',
        JSON.stringify(rubrics || ''),
        pastMessages,
      );

      if (!chatRes.response.choices[0]) {
        throw new Error('Invalid response from ChatGPT');
      }
      const gptAnswer = chatRes.response.choices[0].message.content;
      if (!gptAnswer) {
        throw new Error('No response content from ChatGPT');
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
        assignmentId,
        stageId,
        'ASK_GPT',
        JSON.stringify({
          question,
          answer: gptAnswer,
        }),
      );

      classifyPrompt(gptLog, assignmentId);

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
    } = await prepareGptRequest(req);

    if (!stageId) {
      throw new Error('Invalid assignment tool ID');
    }

    try {
      const userAskTime = Date.now();
      const chatRes = await fetchDictionaryAgentResponse(
        question,
        rolePrompt,
        pastMessages,
        isStructured,
      );

      if (!chatRes.response.choices[0]) {
        throw new Error('Invalid response from ChatGPT');
      }
      const gptAnswer = isStructured
        ? chatRes.response.choices[0].message.parsed
        : chatRes.response.choices[0].message.content;
      if (!gptAnswer) {
        throw new Error('No response content from ChatGPT');
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
        assignmentId,
        stageId,
        'ASK_GPT',
        JSON.stringify({
          question,
          answer: gptAnswer,
        }),
      );

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
    } = await prepareGptRequest(req, { questionUnstructuredOnly: true });

    if (!stageId) {
      throw new Error('Invalid assignment tool ID');
    }

    const essay = await preapreGptEssay(req, stageId);

    try {
      const userAskTime = Date.now();
      const chatRes = await fetchGrammarAgentResponse(
        question,
        rolePrompt,
        essay,
        pastMessages,
        isStructured,
      );

      if (!chatRes.response.choices[0]) {
        throw new Error('Invalid response from ChatGPT');
      }
      const gptAnswer = isStructured
        ? chatRes.response.choices[0].message.parsed
        : chatRes.response.choices[0].message.content;
      if (!gptAnswer) {
        throw new Error('No response content from ChatGPT');
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
        assignmentId,
        stageId,
        'ASK_GPT',
        JSON.stringify({
          question: finalQuestion,
          answer: gptAnswer,
        }),
      );

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
    } = await prepareGptRequest(req, { questionUnstructuredOnly: true });

    if (req.user?.role === 'student' && !stageId) {
      throw new Error('Invalid assignment tool ID');
    }

    const essay = await preapreGptEssay(req, stageId);

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
        isStructured,
      );

      if (!chatRes.response.choices[0]) {
        throw new Error('Invalid response from ChatGPT');
      }
      const gptAnswer = isStructured
        ? chatRes.response.choices[0].message.parsed
        : chatRes.response.choices[0].message.content;
      if (!gptAnswer) {
        throw new Error('No response content from ChatGPT');
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
          assignmentId,
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

export const getGptChatHistory = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  const parsedToolId = parseQueryNumber(req.query.assignment_tool_id);
  const parsedLimit = parseQueryNumber(req.query.limit);
  const parsedPage = parseQueryNumber(req.query.page);

  const limit = parsedLimit !== undefined ? parsedLimit : 10;
  const page = parsedPage !== undefined ? parsedPage : 1;

  if (isNil(parsedToolId) || isNaN(parsedToolId)) {
    return res
      .status(400)
      .json({ error_message: 'Invalid assignment tool id', error_code: 400 });
  }

  if (isNaN(limit) || isNaN(page) || limit <= 0 || page <= 0) {
    return res.status(400).json({
      error_message: 'Invalid pagination parameters',
      error_code: 400,
    });
  }

  const gptLogs = await fetchGptUnstructuredLogsByUserIdToolId(
    req.user.id,
    parsedToolId,
    limit,
    page,
  );

  return res.json({ page, limit, value: gptLogs });
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

  const toolIds = JSON.parse(req.query.assignment_tool_ids as string);
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
    for (const [index, log] of logs.entries()) {
      console.info(`Refreshing prompt ${log.user_question}`);
      await classifyPrompt(log, assignmentId, index === logs.length - 1);
    }
  }
  return res.sendStatus(200);
};
