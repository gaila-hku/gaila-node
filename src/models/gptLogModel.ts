import { fetchStudentIdsByAssignmentId } from 'models/assignmentModel';
import { ResultSetHeader } from 'mysql2';

import pool from 'config/db';
import {
  GptLog,
  StudentRevisionExplanation,
  StudentRevisionPlan,
} from 'types/db/gpt';
import {
  StudentRevisionExplanationListingItem,
  StudentRevisionPlanListingItem,
} from 'types/external/gpt';
import {
  AgentUsageData,
  GptAnalytics,
  GptAnalyticsCountDatabaseItem,
  GptAnalyticsCountDatabaseToolItem,
} from 'types/gpt';
import {
  convertPromptAspectArray,
  convertPromptNatureArray,
} from 'utils/convertCategoryObject';

export const fetchLatestGptLogByUserIdToolId = async (
  userId: number,
  toolId: number,
  limit?: number,
): Promise<GptLog[]> => {
  const [rows] = await pool.query(
    `SELECT * FROM gpt_logs WHERE user_id = ? AND assignment_tool_id = ? AND (is_error = 0 OR is_error IS NULL) ORDER BY id DESC LIMIT ?`,
    [userId, toolId, limit || 1],
  );
  return rows as GptLog[];
};

export const fetchGptLogsByAssignmentId = async (
  assignmentId: number,
): Promise<GptLog[]> => {
  const [rows] = await pool.query(
    `SELECT * FROM gpt_logs
    INNER JOIN assignment_tools ast ON gpt_logs.assignment_tool_id = ast.id
    WHERE ast.assignment_id = ? AND (gpt_logs.is_error = 0 OR gpt_logs.is_error IS NULL)`,
    [assignmentId],
  );
  return rows as GptLog[];
};

export const saveNewGptLog = async (
  user_id: number,
  assignment_tool_id: number,
  user_question: string,
  gpt_answer: string | null,
  whole_prompt: string | null,
  user_ask_time: number,
  gpt_response_time: number,
  extra: string | null,
  is_structured: boolean,
  is_error?: boolean,
): Promise<GptLog> => {
  const [rows] = await pool.query(
    'INSERT INTO gpt_logs (user_id, assignment_tool_id, user_question, gpt_answer, whole_prompt, user_ask_time, gpt_response_time, extra, is_structured, is_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      user_id,
      assignment_tool_id,
      user_question,
      gpt_answer,
      whole_prompt,
      user_ask_time,
      gpt_response_time,
      extra,
      is_structured,
      is_error,
    ],
  );
  const insertResult = rows as ResultSetHeader;
  const gptLogId = insertResult.insertId;
  return {
    id: gptLogId,
    user_id,
    assignment_tool_id,
    user_question,
    gpt_answer,
    whole_prompt,
    user_ask_time,
    gpt_response_time,
    extra,
    is_structured,
    is_error,
  };
};

export const fetchGptLogsByUserIdToolId = async (
  userId: number,
  assignment_tool_id: number,
  limit: number,
  page: number,
  ascending?: boolean,
): Promise<GptLog[]> => {
  const offset = (page - 1) * limit;
  const [rows] = await pool.query(
    `
      SELECT * FROM gpt_logs
      WHERE user_id = ? AND assignment_tool_id = ? AND (is_error = 0 OR is_error IS NULL)
      ORDER BY user_ask_time ${ascending ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?
    `,
    [userId, assignment_tool_id, limit, offset],
  );
  return rows as GptLog[];
};

export const fetchGptUnstructuredLogsByUserIdToolId = async (
  userId: number,
  assignment_tool_id: number,
  limit: number,
  page: number,
  ascending?: boolean,
): Promise<GptLog[]> => {
  const offset = (page - 1) * limit;
  const [rows] = await pool.query(
    `
      SELECT * FROM gpt_logs
      WHERE user_id = ? AND assignment_tool_id = ? AND is_structured = 0 AND (is_error = 0 OR is_error IS NULL)
      ORDER BY user_ask_time ${ascending ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?
    `,
    [userId, assignment_tool_id, limit, offset],
  );
  return rows as GptLog[];
};

export const fetchGptUnstructuredLogsByUserIdAssignmentId = async (
  userId: number,
  assignmentId: number,
): Promise<GptLog[]> => {
  const [rows] = await pool.query(
    `
      SELECT * FROM gpt_logs
      INNER JOIN assignment_tools at ON gpt_logs.assignment_tool_id = at.id AND at.assignment_id = ?
      WHERE user_id = ? AND is_structured = 0 AND (is_error = 0 OR is_error IS NULL)
      ORDER BY user_ask_time DESC
    `,
    [assignmentId, userId],
  );
  return rows as GptLog[];
};

export const fetchLatestStructuredGptLogsByUserIdToolId = async (
  userId: number,
  assignmentToolId: number,
): Promise<GptLog | null> => {
  const [rows] = await pool.query(
    `SELECT * FROM gpt_logs WHERE user_id = ? AND assignment_tool_id = ? AND is_structured = 1 AND (is_error = 0 OR is_error IS NULL) ORDER BY user_ask_time DESC LIMIT 1`,
    [userId, assignmentToolId],
  );
  const result = rows as GptLog[];
  return result.length > 0 ? result[0] : null;
};

export const fetchStructuredGptLogsByUserIdToolId = async (
  userId: number,
  assignmentToolId: number,
): Promise<GptLog[]> => {
  const [rows] = await pool.query(
    `SELECT * FROM gpt_logs WHERE user_id = ? AND assignment_tool_id = ? AND is_structured = 1 AND (is_error = 0 OR is_error IS NULL) ORDER BY user_ask_time`,
    [userId, assignmentToolId],
  );
  return rows as GptLog[];
};

export const fetchLatestLogByUserIdAssignmentId = async (
  userId: number,
  assignmentId: number,
): Promise<GptLog | null> => {
  const [rows] = await pool.query(
    `
      SELECT log.* FROM gpt_logs log
      INNER JOIN assignment_tools at ON log.assignment_tool_id = at.id AND at.assignment_id = ?
      WHERE log.user_id = ? AND (log.is_error = 0 OR log.is_error IS NULL)
      ORDER BY log.id DESC
      LIMIT 1
    `,
    [assignmentId, userId],
  );
  const result = rows as GptLog[];
  return result.length > 0 ? result[0] : null;
};

export const savePromptCategories = async (
  gptLogIds: number[],
  nature_categories: number[],
  aspect_categories: number[],
): Promise<void> => {
  for (let i = 0; i < gptLogIds.length; i++) {
    await pool.query(
      'UPDATE gpt_logs SET prompt_nature_category = ?, prompt_aspect_category = ? WHERE id = ?',
      [nature_categories[i], aspect_categories[i], gptLogIds[i]],
    );
  }
};

export const fetchUncategorizedPromptsByAssignmentId = async (
  assignmentId: number,
): Promise<GptLog[]> => {
  const [rows] = await pool.query(
    `
      SELECT log.* FROM gpt_logs log
      INNER JOIN assignment_tools at ON log.assignment_tool_id = at.id AND at.assignment_id = ?
      WHERE log.is_structured = 0 AND (log.is_error = 0 OR log.is_error IS NULL) AND log.prompt_nature_category IS NULL AND log.prompt_aspect_category IS NULL
    `,
    [assignmentId],
  );
  return rows as GptLog[];
};

export const fetchPromptAnalyticsByAssignmentIdUserId = async (
  assignmentId: number,
  userId: number,
): Promise<GptAnalytics> => {
  const studentCount = (await fetchStudentIdsByAssignmentId(assignmentId))
    .length;

  const [countRows] = await pool.query(
    `
      SELECT COUNT(*) as prompt_count FROM gpt_logs log
      INNER JOIN assignment_tools at ON log.assignment_tool_id = at.id AND at.assignment_id = ?
      WHERE log.is_structured = 0 AND log.user_id = ? AND (log.is_error = 0 OR log.is_error IS NULL)
    `,
    [assignmentId, userId],
  );
  const countResult = countRows as { prompt_count: number }[];
  const promptCount = countResult.length > 0 ? countResult[0].prompt_count : 0;

  const [natureRows] = await pool.query(
    `
      SELECT prompt_nature_category as item_key, stage_type, COUNT(*) as count FROM gpt_logs log
      INNER JOIN assignment_tools at ON log.assignment_tool_id = at.id AND at.assignment_id = ?
      INNER JOIN assignment_stages as s ON at.assignment_stage_id = s.id
      WHERE prompt_nature_category IS NOT NULL AND log.user_id = ? AND (log.is_error = 0 OR log.is_error IS NULL)
      GROUP BY prompt_nature_category, stage_type
    `,
    [assignmentId, userId],
  );
  const natureResult = natureRows as GptAnalyticsCountDatabaseItem[];
  const [natureClassRows] = await pool.query(
    `
      SELECT prompt_nature_category as item_key, stage_type, COUNT(*) as count FROM gpt_logs log
      INNER JOIN assignment_tools at ON log.assignment_tool_id = at.id AND at.assignment_id = ?
      INNER JOIN assignment_stages as s ON at.assignment_stage_id = s.id
      WHERE prompt_nature_category IS NOT NULL AND (log.is_error = 0 OR log.is_error IS NULL)
      GROUP BY prompt_nature_category, stage_type
    `,
    [assignmentId],
  );
  const natureClassResult = natureClassRows as GptAnalyticsCountDatabaseItem[];
  const natureClassAvgResult = natureClassResult.map(item => ({
    ...item,
    count: item.count / studentCount,
  }));

  const [aspectRows] = await pool.query(
    `
      SELECT prompt_aspect_category as item_key, stage_type, COUNT(*) as count FROM gpt_logs log
      INNER JOIN assignment_tools at ON log.assignment_tool_id = at.id AND at.assignment_id = ?
      INNER JOIN assignment_stages as s ON at.assignment_stage_id = s.id
      WHERE prompt_aspect_category IS NOT NULL AND log.user_id = ? AND (log.is_error = 0 OR log.is_error IS NULL)
      GROUP BY prompt_aspect_category, stage_type
    `,
    [assignmentId, userId],
  );
  const aspectResult = aspectRows as GptAnalyticsCountDatabaseItem[];
  const [aspectClassRows] = await pool.query(
    `
      SELECT prompt_aspect_category as item_key, stage_type, COUNT(*) as count FROM gpt_logs log
      INNER JOIN assignment_tools at ON log.assignment_tool_id = at.id AND at.assignment_id = ?
      INNER JOIN assignment_stages as s ON at.assignment_stage_id = s.id
      WHERE prompt_aspect_category IS NOT NULL AND (log.is_error = 0 OR log.is_error IS NULL)
      GROUP BY prompt_aspect_category, stage_type
    `,
    [assignmentId],
  );
  const aspectClassResult = aspectClassRows as GptAnalyticsCountDatabaseItem[];
  const aspectClassAvgResult = aspectClassResult.map(item => ({
    ...item,
    count: item.count / studentCount,
  }));

  const [toolRows] = await pool.query(
    `
      SELECT tool_key as item_key, stage_type, COUNT(*) as count FROM gpt_logs log
      INNER JOIN assignment_tools at ON log.assignment_tool_id = at.id AND at.assignment_id = ?
      INNER JOIN assignment_stages as s ON at.assignment_stage_id = s.id
      WHERE log.is_structured = 1 AND log.user_id = ? AND (log.is_error = 0 OR log.is_error IS NULL)
      GROUP BY tool_key, stage_type
    `,
    [assignmentId, userId],
  );
  const toolResult = toolRows as GptAnalyticsCountDatabaseToolItem[];
  const [toolClassRows] = await pool.query(
    `
      SELECT tool_key as item_key, COUNT(*) as count FROM gpt_logs log
      INNER JOIN assignment_tools at ON log.assignment_tool_id = at.id AND at.assignment_id = ?
      WHERE log.is_structured = 1 AND (log.is_error = 0 OR log.is_error IS NULL)
      GROUP BY tool_key
    `,
    [assignmentId, userId],
  );
  const toolClassResult = toolClassRows as GptAnalyticsCountDatabaseToolItem[];
  const toolClassAvgResult = toolClassResult.map(item => ({
    ...item,
    count: item.count / studentCount,
  }));

  return {
    total_prompt_count: promptCount,
    nature_counts: convertPromptNatureArray(natureResult, natureClassAvgResult),
    aspect_counts: convertPromptAspectArray(aspectResult, aspectClassAvgResult),
    tool_counts: toolResult.map(item => ({
      key: item.item_key,
      stage_type: item.stage_type,
      count: item.count,
      class_average:
        toolClassAvgResult.find(i => i.item_key === item.item_key)?.count ?? 0,
    })),
  };
};

export const fetchAgentUsageByAssignmentIdUserId = async (
  assignmentId: number,
  userId: number,
): Promise<AgentUsageData> => {
  const [toolRows] = await pool.query(
    `
      SELECT id, tool_key FROM assignment_tools
      WHERE assignment_id = ?
    `,
    [assignmentId, userId],
  );
  const toolResult = toolRows as { id: number; tool_key: string }[];

  const [structuredRows] = await pool.query(
    `
      SELECT at.id as tool_id, COUNT(*) as count FROM gpt_logs log
      INNER JOIN assignment_tools at ON log.assignment_tool_id = at.id AND at.assignment_id = ?
      WHERE log.user_id = ? AND log.is_structured = 1 AND (log.is_error = 0 OR log.is_error IS NULL)
      GROUP BY tool_id
    `,
    [assignmentId, userId],
  );
  const structuredResult = structuredRows as {
    tool_id: number;
    count: number;
  }[];
  const [unstructuredRows] = await pool.query(
    `
      SELECT at.id as tool_id, COUNT(*) as count FROM gpt_logs log
      INNER JOIN assignment_tools at ON log.assignment_tool_id = at.id AND at.assignment_id = ?
      WHERE log.user_id = ? AND log.is_structured = 0 AND (log.is_error = 0 OR log.is_error IS NULL)
      GROUP BY tool_id
    `,
    [assignmentId, userId],
  );
  const unstructuredResult = unstructuredRows as {
    tool_id: number;
    count: number;
  }[];

  return toolResult
    .filter(
      item =>
        ![
          'teacher_grading',
          'reading_general',
          'goal_general',
          'vocab_generate',
          'language_general',
          'outlining_general',
          'drafting_general',
          'revising_general',
          'reflection_general',
          'reflection_dashboard_generate',
        ].includes(item.tool_key),
    )
    .reduce((arr, tool) => {
      const dataItemIndex = arr.findIndex(i => i.agent_type === tool.tool_key);
      if (dataItemIndex === -1) {
        arr.push({
          agent_type: tool.tool_key,
          agent_uses:
            structuredResult.find(i => i.tool_id === tool.id)?.count ?? 0,
          prompts:
            unstructuredResult.find(i => i.tool_id === tool.id)?.count ?? 0,
        });
      } else {
        arr[dataItemIndex].agent_uses +=
          structuredResult.find(i => i.tool_id === tool.id)?.count ?? 0;
        arr[dataItemIndex].prompts +=
          unstructuredResult.find(i => i.tool_id === tool.id)?.count ?? 0;
      }
      return arr;
    }, [] as AgentUsageData);
};

export const fetchGptUnstructuredLogListingByUserIdAssignmentId = async (
  userId: number,
  assignmentId: number,
  limit: number,
  page: number,
) => {
  const [rows] = await pool.query(
    `SELECT logs.*, at.tool_key
    FROM gpt_logs logs
    JOIN assignment_tools at ON logs.assignment_tool_id = at.id
    WHERE user_id = ? AND at.assignment_id = ? AND is_structured = 0 AND (is_error = 0 OR is_error IS NULL)
    ORDER BY user_ask_time DESC
    LIMIT ? OFFSET ?`,
    [userId, assignmentId, limit, (page - 1) * limit],
  );
  return rows as (GptLog & { tool_key: string })[];
};

export const fetchGptUnstructuredLogCountByUserIdAssignmentId = async (
  userId: number,
  assignmentId: number,
): Promise<number> => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) FROM gpt_logs logs
    JOIN assignment_tools at ON logs.assignment_tool_id = at.id
    WHERE user_id = ? AND at.assignment_id = ? AND is_structured = 0 AND (is_error = 0 OR is_error IS NULL)`,
    [userId, assignmentId],
  );
  const result = rows as { 'COUNT(*)': number }[];
  return result[0]['COUNT(*)'];
};

export const fetchStudentRevisionExplanationByUserIdAssignmentId = async (
  userId: number,
  assignmentId: number,
  limit: number,
  page: number,
) => {
  const [rows] = await pool.query(
    `SELECT sre.id, sre.user_id, sre.aspect_id, sre.response_type, sre.explanation, 
      ( 
        SELECT JSON_OBJECT('id', log.id, 'user_ask_time', log.user_ask_time, 'user_question', log.user_question, 'gpt_answer', log.gpt_answer, 'is_structured', log.is_structured)
        FROM gpt_logs log
        WHERE sre.gpt_log_id = log.id
      ) as gpt_log
    FROM student_revision_explanations sre
    JOIN gpt_logs gl ON sre.gpt_log_id = gl.id
    JOIN assignment_tools at ON gl.assignment_tool_id = at.id AND at.assignment_id = ?
    WHERE sre.user_id = ?
    ORDER BY user_ask_time DESC
    LIMIT ? OFFSET ?`,
    [assignmentId, userId, limit, (page - 1) * limit],
  );
  return rows as StudentRevisionExplanationListingItem[];
};

export const fetchStudentRevisionExplanationCountByUserIdAssignmentId = async (
  userId: number,
  assignmentId: number,
) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*)
    FROM student_revision_explanations sre
    JOIN gpt_logs gl ON sre.gpt_log_id = gl.id
    JOIN assignment_tools at ON gl.assignment_tool_id = at.id AND at.assignment_id = ?
    WHERE sre.user_id = ?`,
    [assignmentId, userId],
  );
  const result = rows as { 'COUNT(*)': number }[];
  return result[0]['COUNT(*)'];
};

export const fetchStudentRevisionExplanationByGptLogIdsAspectIds = async (
  gptLogIds: number[],
  aspectIds: string[],
) => {
  if (gptLogIds.length === 0 || aspectIds.length === 0) {
    return [];
  }

  if (gptLogIds.length !== aspectIds.length) {
    throw new Error('gptLogIds and aspectIds must have the same length');
  }

  const [rows] = await pool.query(
    `SELECT * from student_revision_explanations WHERE gpt_log_id IN (?) AND aspect_id IN (?)`,
    [gptLogIds, aspectIds],
  );
  return rows as StudentRevisionExplanation[];
};

export const saveStudentRevisionExplanation = async (
  userId: number,
  gptLogId: number,
  aspectId: string,
  responseType: StudentRevisionExplanation['response_type'],
  explanation: string,
): Promise<StudentRevisionExplanation> => {
  const savedAt = Date.now();
  const [insertRows] = await pool.query(
    'INSERT INTO student_revision_explanations (user_id, gpt_log_id, aspect_id, response_type, explanation, saved_at) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, gptLogId, aspectId, responseType, explanation, savedAt],
  );
  const id = (insertRows as ResultSetHeader).insertId;
  return {
    id,
    user_id: userId,
    gpt_log_id: gptLogId,
    aspect_id: aspectId,
    response_type: responseType,
    explanation: explanation,
    saved_at: savedAt,
  };
};

export const fetchStudentRevisionPlanByUserIdAssignmentId = async (
  userId: number,
  assignmentId: number,
  limit: number,
  page: number,
) => {
  const [rows] = await pool.query(
    `SELECT srp.id, srp.user_id, srp.aspect_id, srp.response_type, srp.plan, 
      ( 
        SELECT JSON_OBJECT('id', log.id, 'user_ask_time', log.user_ask_time, 'user_question', log.user_question, 'gpt_answer', log.gpt_answer, 'is_structured', log.is_structured)
        FROM gpt_logs log
        WHERE srp.gpt_log_id = log.id
      ) as gpt_log
    FROM student_revision_plans srp
    JOIN gpt_logs gl ON srp.gpt_log_id = gl.id
    JOIN assignment_tools at ON gl.assignment_tool_id = at.id AND at.assignment_id = ?
    WHERE srp.user_id = ?
    ORDER BY user_ask_time DESC
    LIMIT ? OFFSET ?`,
    [assignmentId, userId, limit, (page - 1) * limit],
  );
  return rows as StudentRevisionPlanListingItem[];
};

export const fetchStudentRevisionPlanCountByUserIdAssignmentId = async (
  userId: number,
  assignmentId: number,
) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*)
    FROM student_revision_plans srp
    JOIN gpt_logs gl ON srp.gpt_log_id = gl.id
    JOIN assignment_tools at ON gl.assignment_tool_id = at.id AND at.assignment_id = ?
    WHERE srp.user_id = ?`,
    [assignmentId, userId],
  );
  const result = rows as { 'COUNT(*)': number }[];
  return result[0]['COUNT(*)'];
};

export const fetchStudentRevisionPlanByGptLogIdsAspectIds = async (
  gptLogIds: number[],
  aspectIds: string[],
) => {
  if (gptLogIds.length === 0 || aspectIds.length === 0) {
    return [];
  }

  if (gptLogIds.length !== aspectIds.length) {
    throw new Error('gptLogIds and aspectIds must have the same length');
  }

  const [rows] = await pool.query(
    `SELECT * from student_revision_plans WHERE gpt_log_id IN (?) AND aspect_id IN (?)`,
    [gptLogIds, aspectIds],
  );
  return rows as StudentRevisionPlan[];
};

export const saveStudentRevisionPlan = async (
  userId: number,
  gptLogId: number,
  aspectId: string,
  responseType: StudentRevisionPlan['response_type'],
  plan: string,
): Promise<StudentRevisionPlan> => {
  const savedAt = Date.now();
  const [insertRows] = await pool.query(
    'INSERT INTO student_revision_plans (user_id, gpt_log_id, aspect_id, response_type, plan, saved_at) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, gptLogId, aspectId, responseType, plan, savedAt],
  );
  const id = (insertRows as ResultSetHeader).insertId;
  return {
    id,
    user_id: userId,
    gpt_log_id: gptLogId,
    aspect_id: aspectId,
    response_type: responseType,
    plan: plan,
    saved_at: savedAt,
  };
};
