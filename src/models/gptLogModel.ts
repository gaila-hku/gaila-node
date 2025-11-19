import { fetchStudentIdsByAssignmentId } from 'models/assignmentModel';
import { ResultSetHeader } from 'mysql2';

import pool from 'config/db';
import {
  GptAnalytics,
  GptAnalyticsCountDatabaseItem,
  GptAnalyticsCountDatabaseToolItem,
  GptLog,
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
    `SELECT * FROM gpt_logs WHERE user_id = ? AND assignment_tool_id = ? ORDER BY id DESC LIMIT ?`,
    [userId, toolId, limit || 1],
  );
  return rows as GptLog[];
};

export const saveNewGptLog = async (
  user_id: number,
  assignment_tool_id: number,
  user_question: string,
  gpt_answer: string,
  whole_prompt: string,
  user_ask_time: number,
  gpt_response_time: number,
  is_structured: boolean,
): Promise<GptLog> => {
  const [rows] = await pool.query(
    'INSERT INTO gpt_logs (user_id, assignment_tool_id, user_question, gpt_answer, whole_prompt, user_ask_time, gpt_response_time, is_structured) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      user_id,
      assignment_tool_id,
      user_question,
      gpt_answer,
      whole_prompt,
      user_ask_time,
      gpt_response_time,
      is_structured,
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
    is_structured,
  };
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
      WHERE user_id = ? AND assignment_tool_id = ? AND is_structured = 0
      ORDER BY user_ask_time ${ascending ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?
    `,
    [userId, assignment_tool_id, limit, offset],
  );
  return rows as GptLog[];
};

export const fetchGptUnstructuredLogsByUserId = async (
  userId: number,
): Promise<GptLog[]> => {
  const [rows] = await pool.query(
    `
      SELECT * FROM gpt_logs
      WHERE user_id = ? AND is_structured = 0
      ORDER BY user_ask_time DESC
    `,
    [userId],
  );
  return rows as GptLog[];
};

export const fetchLatestStructuredGptLogsByUserIdToolId = async (
  userId: number,
  assignmentToolId: number,
): Promise<GptLog | null> => {
  const [rows] = await pool.query(
    `SELECT * FROM gpt_logs WHERE user_id = ? AND assignment_tool_id = ? AND is_structured = 1 ORDER BY user_ask_time DESC LIMIT 1`,
    [userId, assignmentToolId],
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
      WHERE log.is_structured = 0 AND log.prompt_nature_category IS NULL AND log.prompt_aspect_category IS NULL
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
      WHERE log.is_structured = 0 AND log.user_id = ?
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
      WHERE prompt_nature_category IS NOT NULL AND log.user_id = ?
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
      WHERE prompt_nature_category IS NOT NULL
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
      WHERE prompt_aspect_category IS NOT NULL AND log.user_id = ?
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
      WHERE prompt_aspect_category IS NOT NULL
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
      WHERE log.is_structured = 1 AND log.user_id = ?
      GROUP BY tool_key, stage_type
    `,
    [assignmentId, userId],
  );
  const toolResult = toolRows as GptAnalyticsCountDatabaseToolItem[];
  const [toolClassRows] = await pool.query(
    `
      SELECT tool_key as item_key, COUNT(*) as count FROM gpt_logs log
      INNER JOIN assignment_tools at ON log.assignment_tool_id = at.id AND at.assignment_id = ?
      WHERE log.is_structured = 1
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
