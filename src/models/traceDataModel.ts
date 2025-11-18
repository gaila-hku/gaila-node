import { ResultSetHeader } from 'mysql2';

import pool from 'config/db';
import { TraceData } from 'types/trace-data';

export const saveNewTraceData = async (
  userId: number,
  assignmentId: number | null,
  stageId: number | null,
  action: string,
  content: string | null,
): Promise<TraceData> => {
  const savedAt = Date.now();

  const [rows] = await pool.query(
    'INSERT INTO trace_data (user_id, assignment_id, stage_id, saved_at, action, content) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, assignmentId, stageId, savedAt, action, content],
  );
  const insertResult = rows as ResultSetHeader;
  const traceDataId = insertResult.insertId;
  return {
    id: traceDataId,
    user_id: userId,
    assignment_id: assignmentId,
    stage_id: stageId,
    saved_at: savedAt,
    action,
    content,
  };
};

export const fetchPasteTextLogsByUserId = async (
  userId: number,
): Promise<TraceData[]> => {
  const [rows] = await pool.query(
    'SELECT * FROM trace_data WHERE user_id = ? AND action = "paste_text" ORDER BY saved_at DESC',
    [userId],
  );
  return rows as TraceData[];
};
