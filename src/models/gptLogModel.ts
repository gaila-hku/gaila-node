import { ResultSetHeader } from 'mysql2';

import pool from 'config/db';
import { GptLog } from 'types/gpt';

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
): Promise<GptLog[]> => {
  const offset = (page - 1) * limit;
  const [rows] = await pool.query(
    `SELECT * FROM gpt_logs WHERE user_id = ? AND assignment_tool_id = ? AND is_structured = 0 ORDER BY user_ask_time DESC LIMIT ? OFFSET ?`,
    [userId, assignment_tool_id, limit, offset],
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
