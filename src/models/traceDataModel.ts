import { ResultSetHeader } from 'mysql2';

import pool from 'config/db';
import { TraceData } from 'types/db/trace-data';
import { TimelineData } from 'types/trace-data';

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

export const fetchPasteTextLogsByUserIdAssignmentId = async (
  userId: number,
  assignmentId: number,
): Promise<TraceData[]> => {
  const [rows] = await pool.query(
    'SELECT * FROM trace_data WHERE user_id = ? AND assignment_id = ? AND action = "paste_text" ORDER BY saved_at DESC',
    [userId, assignmentId],
  );
  return rows as TraceData[];
};

export const fetchTimelineDataByUserIdAssignmentId = async (
  userId: number,
  assignmentId: number,
): Promise<TimelineData[]> => {
  const [startTimeRows] = await pool.query(
    `
      SELECT stage_type, min(saved_at) as start_time FROM trace_data
      RIGHT JOIN assignment_stages ON trace_data.stage_id = assignment_stages.id AND assignment_stages.assignment_id = ?
      WHERE trace_data.user_id = ? AND trace_data.assignment_id = ?
      GROUP BY stage_type
    `,
    [assignmentId, userId, assignmentId],
  );
  const startTimeResults = startTimeRows as {
    stage_type: string;
    start_time: number | null;
  }[];

  const [endTimeRows] = await pool.query(
    `
      SELECT stage_type, max(submitted_at) as end_time FROM assignment_submissions
      RIGHT JOIN  assignment_stages ON assignment_submissions.stage_id = assignment_stages.id AND assignment_stages.assignment_id = ?
      WHERE assignment_submissions.student_id = ? AND assignment_submissions.assignment_id = ? AND assignment_submissions.is_final = 1
      GROUP BY stage_type
    `,
    [assignmentId, userId, assignmentId],
  );
  const endTimeResults = endTimeRows as {
    stage_type: string;
    end_time: number | null;
  }[];

  const results = startTimeResults.map(item => {
    const endTime = endTimeResults.find(i => i.stage_type === item.stage_type);
    return {
      ...item,
      end_time: endTime ? endTime.end_time : null,
    };
  });

  return results;
};

export const fetchLatestDashboardLogByUserIdAssignmentId = async (
  userId: number,
  assignmentId: number,
): Promise<TraceData | null> => {
  const [rows] = await pool.query(
    `
      SELECT * FROM trace_data
      WHERE assignment_id = ? AND user_id = ?
        AND (
          action = "ENTER_DASHBOARD"
          OR action = "LEAVE_DASHBOARD"
          OR (action = "SWITCH_DASHBOARD_ASSIGNMENT" AND JSON_EXTRACT(content, '$.assignment_id') = ?)
          OR (action = "SWITCH_ESSAY_TAB" AND JSON_EXTRACT(content, '$.tab') = 'dashboard')
        )
      ORDER BY id DESC
      LIMIT 1
    `,
    [assignmentId, userId, assignmentId],
  );
  const result = rows as TraceData[];
  return result.length > 0 ? result[0] : null;
};
