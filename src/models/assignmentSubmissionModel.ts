import { ResultSetHeader } from 'mysql2';

import pool from 'config/db';
import {
  AssignmentRecentSubmissionListingItem,
  AssignmentSubmissionDetail,
  AssignmentSubmissionListingItem,
} from 'types/assignment';
import { AssignmentSubmission } from 'types/db/assignment';

export const fetchLatestSubmissionsByAssignmentIdStudentId = async (
  assignmentId: number,
  studentId: number,
): Promise<AssignmentSubmission[]> => {
  const [rows] = await pool.query(
    `
    SELECT s.*
    FROM assignment_submissions s
    INNER JOIN (
      SELECT stage_id, max(submitted_at) as max_submitted_at
      FROM assignment_submissions
      WHERE assignment_id = ? AND student_id = ?
      GROUP BY stage_id
    ) latest_submissions
      ON latest_submissions.stage_id = s.stage_id
      AND latest_submissions.max_submitted_at = s.submitted_at
    INNER JOIN (
      SELECT id as stage_id
      FROM assignment_stages
      WHERE assignment_id = ? AND enabled = 1
    ) stages on stages.stage_id = s.stage_id
    `,
    [assignmentId, studentId, assignmentId],
  );
  return rows as AssignmentSubmission[];
};

export const fetchLatestSubmissionByStageIdStudentId = async (
  stageId: number,
  studentId: number,
): Promise<AssignmentSubmission | null> => {
  const [rows] = await pool.query(
    `
    SELECT s.*
    FROM assignment_submissions s
    INNER JOIN (
      SELECT stage_id, max(submitted_at) as max_submitted_at
      FROM assignment_submissions
      WHERE stage_id = ? AND student_id = ?
    ) latest_submissions
      ON latest_submissions.stage_id = s.stage_id
      AND latest_submissions.max_submitted_at = s.submitted_at
    INNER JOIN (
      SELECT id as stage_id
      FROM assignment_stages
      WHERE enabled = 1
    ) stages on stages.stage_id = s.stage_id
    `,
    [stageId, studentId],
  );
  const result = rows as AssignmentSubmission[];
  return result.length > 0 ? result[0] : null;
};

export const saveNewAssignmentSubmission = async (
  assignmentId: number,
  stageId: number,
  studentId: number,
  content: string,
  isFinal: boolean,
): Promise<AssignmentSubmission> => {
  const [insertRows] = await pool.query(
    'INSERT INTO assignment_submissions (assignment_id, stage_id, student_id, content, submitted_at, is_final) VALUES (?, ?, ?, ?, ?, ?)',
    [assignmentId, stageId, studentId, content, Date.now(), isFinal],
  );
  const insertResult = insertRows as ResultSetHeader;
  const submissionId = insertResult.insertId;
  return {
    id: submissionId,
    assignment_id: assignmentId,
    stage_id: stageId,
    student_id: studentId,
    content: JSON.parse(content),
    submitted_at: Date.now(),
    is_final: isFinal,
  };
};

export const fetchLatestSubmissionsByTeacherId = async (
  teacherId: number,
  limit: number,
  page: number,
  filter: string,
): Promise<AssignmentRecentSubmissionListingItem[]> => {
  const [rows] = await pool.query(
    `
    SELECT t.student_id
    FROM (
      SELECT
        s.student_id, a.title, users.username, CONCAT(users.first_name, ' ', users.last_name) as full_name
      FROM assignment_submissions s
      INNER JOIN (
        SELECT assignment_id, student_id, max(submitted_at) as max_submitted_at
        FROM assignment_submissions
        GROUP BY assignment_id, student_id
      ) latest_submissions
        ON latest_submissions.assignment_id = s.assignment_id
        AND latest_submissions.student_id = s.student_id
        AND latest_submissions.max_submitted_at = s.submitted_at
      INNER JOIN assignments a ON s.assignment_id = a.id
      INNER JOIN assignment_teachers at ON s.assignment_id = at.assignment_id AND at.teacher_id = ?
      INNER JOIN users ON s.student_id = users.id
      ORDER BY s.submitted_at DESC
    ) t
    ${filter ? `WHERE full_name LIKE '%${filter}%' OR username LIKE '%${filter}%' OR title LIKE '%${filter}%'` : ''}
    LIMIT ? OFFSET ?
    `,
    [teacherId, limit, (page - 1) * limit],
  );

  const studentIdResults = rows as { student_id: number }[];
  const studentIds = studentIdResults.map(s => s.student_id);

  if (studentIds.length === 0) {
    return [];
  }

  const studentIdPlaceholder = studentIds.map(() => '?').join(',');
  const [detailsRows] = await pool.query(
    `
    SELECT
      s.id, s.assignment_id, s.stage_id, s.student_id, s.submitted_at, s.is_final,
      a.title as title,
      stages.stage_type as stage_type,
      ag.overall_score as score,
      users.username, users.first_name, users.last_name
    FROM assignment_submissions s
    JOIN (
      SELECT assignment_id, stage_id, student_id, max(submitted_at) as max_submitted_at
      FROM assignment_submissions
      GROUP BY assignment_id, stage_id, student_id
    ) latest_submissions
      ON latest_submissions.assignment_id = s.assignment_id
      AND latest_submissions.stage_id = s.stage_id
      AND latest_submissions.student_id = s.student_id
      AND latest_submissions.max_submitted_at = s.submitted_at
    INNER JOIN assignments a ON s.assignment_id = a.id
    INNER JOIN (
      SELECT *
      FROM assignment_stages
      WHERE enabled = 1
    ) stages on stages.id = s.stage_id
    INNER JOIN assignment_teachers at ON s.assignment_id = at.assignment_id AND at.teacher_id = ?
    INNER JOIN users ON s.student_id = users.id AND s.student_id IN (${studentIdPlaceholder})
    LEFT JOIN assignment_grades ag ON ag.submission_id = s.id
    `,
    [teacherId, ...studentIds],
  );
  return detailsRows as AssignmentRecentSubmissionListingItem[];
};

export const fetchLatestSubmissionsCountByTeacherId = async (
  teacherId: number,
  filter: string,
): Promise<number | null> => {
  const [rows] = await pool.query(
    `
    SELECT COUNT(*) FROM (
      SELECT
        s.id, s.assignment_id, s.stage_id, s.student_id, s.submitted_at, s.is_final,
        a.title as title,
        users.username, users.first_name, users.last_name, CONCAT(users.first_name, ' ', users.last_name) as full_name
      FROM assignment_submissions s
      INNER JOIN (
        SELECT assignment_id, stage_id, student_id, max(submitted_at) as max_submitted_at
        FROM assignment_submissions
        GROUP BY assignment_id, stage_id, student_id
      ) latest_submissions
        ON latest_submissions.assignment_id = s.assignment_id
        AND latest_submissions.stage_id = s.stage_id
        AND latest_submissions.student_id = s.student_id
        AND latest_submissions.max_submitted_at = s.submitted_at
      INNER JOIN assignments a ON s.assignment_id = a.id
      INNER JOIN users ON s.student_id = users.id
    ) t
    ${filter ? `WHERE full_name LIKE '%${filter}%' OR username LIKE '%${filter}%' OR title LIKE '%${filter}%'` : ''}
    `,
    [teacherId],
  );
  const result = rows as { 'COUNT(*)': number }[];
  return result.length > 0 ? result[0]['COUNT(*)'] : null;
};

export const fetchLatestSubmissionsByAssignmentIdTeacherId = async (
  assignmentId: number,
  teacherId: number,
  limit: number,
  page: number,
  filter: string,
): Promise<AssignmentSubmissionListingItem[]> => {
  const [rows] = await pool.query(
    `
    SELECT t.student_id
    FROM (
      SELECT
        s.student_id, users.username, CONCAT(users.first_name, ' ', users.last_name) as full_name
      FROM assignment_submissions s
      INNER JOIN (
        SELECT student_id, max(submitted_at) as max_submitted_at
        FROM assignment_submissions
        WHERE assignment_id = ?
        GROUP BY student_id
      ) latest_submissions
        ON latest_submissions.student_id = s.student_id
        AND latest_submissions.max_submitted_at = s.submitted_at
      INNER JOIN assignment_teachers at ON s.assignment_id = at.assignment_id AND at.teacher_id = ?
      INNER JOIN users ON s.student_id = users.id
      ORDER BY s.submitted_at DESC
    ) t
    ${filter ? `WHERE full_name LIKE '%${filter}%' OR username LIKE '%${filter}%'` : ''}
    LIMIT ? OFFSET ?
    `,
    [assignmentId, teacherId, limit, (page - 1) * limit],
  );

  const studentIdResults = rows as { student_id: number }[];
  const studentIds = studentIdResults.map(s => s.student_id);

  if (studentIds.length === 0) {
    return [];
  }

  const studentIdPlaceholder = studentIds.map(() => '?').join(',');
  const [detailsRows] = await pool.query(
    `
    SELECT
      s.id, s.assignment_id, s.stage_id, s.student_id, s.submitted_at, s.is_final,
      stages.stage_type as stage_type,
      ag.overall_score as score,
      users.username, users.first_name, users.last_name, CONCAT(users.first_name, ' ', users.last_name) as full_name
    FROM assignment_submissions s
    INNER JOIN (
      SELECT stage_id, student_id, max(submitted_at) as max_submitted_at
      FROM assignment_submissions
      WHERE assignment_id = ?
      GROUP BY stage_id, student_id
    ) latest_submissions
      ON latest_submissions.stage_id = s.stage_id
      AND latest_submissions.student_id = s.student_id
      AND latest_submissions.max_submitted_at = s.submitted_at
    INNER JOIN (
      SELECT *
      FROM assignment_stages
      WHERE assignment_id = ? AND enabled = 1
    ) stages on stages.id = s.stage_id
    INNER JOIN assignment_teachers at ON s.assignment_id = at.assignment_id AND at.teacher_id = ?
    INNER JOIN users ON s.student_id = users.id AND s.student_id IN (${studentIdPlaceholder})
    LEFT JOIN assignment_grades ag ON ag.submission_id = s.id
    ORDER BY s.submitted_at DESC
    `,
    [assignmentId, assignmentId, teacherId, ...studentIds],
  );
  return detailsRows as AssignmentSubmissionListingItem[];
};

export const fetchLatestSubmissionsCountByAssignmentIdTeacherId = async (
  assignmentId: number,
  teacherId: number,
  filter: string,
): Promise<number | null> => {
  const [rows] = await pool.query(
    `
    SELECT COUNT(*) FROM (
      SELECT s.id, s.assignment_id, s.stage_id, s.student_id, s.submitted_at, users.username, users.first_name, users.last_name, CONCAT(users.first_name, ' ', users.last_name) as full_name
      FROM assignment_submissions s
      INNER JOIN (
        SELECT stage_id, student_id, max(submitted_at) as max_submitted_at
        FROM assignment_submissions
        WHERE assignment_id = ? AND is_final = 1
        GROUP BY stage_id, student_id
      ) latest_submissions
        ON latest_submissions.stage_id = s.stage_id
        AND latest_submissions.student_id = s.student_id
        AND latest_submissions.max_submitted_at = s.submitted_at
      INNER JOIN (
        SELECT id as stage_id
        FROM assignment_stages
        WHERE assignment_id = ? AND enabled = 1
      ) stages on stages.stage_id = s.stage_id
      INNER JOIN assignment_teachers at ON s.assignment_id = at.assignment_id AND at.teacher_id = ?
      INNER JOIN users ON s.student_id = users.id
    ) t
    ${filter ? `WHERE full_name LIKE '%${filter}%' OR username LIKE '%${filter}%'` : ''}
    `,
    [assignmentId, assignmentId, teacherId],
  );
  const result = rows as { 'COUNT(*)': number }[];
  return result.length > 0 ? result[0]['COUNT(*)'] : null;
};

export const fetchSubmissionsByAssignmentIdAndStudentId = async (
  assignmentId: number,
  studentId: number,
): Promise<AssignmentSubmissionDetail[]> => {
  const [rows] = await pool.query(
    `
      SELECT s.*,
        a.title, a.description, a.start_date, a.due_date, a.type, a.rubrics, a.config,
        stages.stage_type, stages.order_index,
        users.username, users.first_name, users.last_name,
        ag.overall_score, ag.overall_feedback, ag.rubrics_breakdown, ag.graded_at, ag.graded_by
      FROM assignment_submissions s
      INNER JOIN (
        SELECT stage_id, student_id, max(submitted_at) as max_submitted_at
        FROM assignment_submissions
        WHERE assignment_id = ?
        GROUP BY stage_id, student_id
      ) latest_submissions
        ON latest_submissions.stage_id = s.stage_id
        AND latest_submissions.student_id = s.student_id
        AND latest_submissions.max_submitted_at = s.submitted_at 
      JOIN assignments a ON s.assignment_id = a.id
      JOIN assignment_stages stages ON s.stage_id = stages.id
      JOIN users ON s.student_id = users.id
      LEFT JOIN assignment_grades ag ON s.id = ag.submission_id
      WHERE s.assignment_id = ? AND s.student_id = ?
    `,
    [assignmentId, assignmentId, studentId],
  );
  return rows as AssignmentSubmissionDetail[];
};

export const fetchLatestEssaySubmissionByAssignmentIdStudentId = async (
  assignmentId: number,
  studentId: number,
): Promise<AssignmentSubmission | null> => {
  const [rows] = await pool.query(
    `
    SELECT s.*
    FROM assignment_submissions s
    INNER JOIN (
      SELECT stage_id, max(submitted_at) as max_submitted_at
      FROM assignment_submissions
      WHERE assignment_id = ? AND student_id = ?
      GROUP BY stage_id
    ) latest_submissions
      ON latest_submissions.stage_id = s.stage_id
      AND latest_submissions.max_submitted_at = s.submitted_at
    INNER JOIN (
      SELECT id as stage_id
      FROM assignment_stages
      WHERE stage_type = 'writing'
    ) stages on stages.stage_id = s.stage_id
    `,
    [assignmentId, studentId],
  );
  const result = rows as AssignmentSubmission[];
  return result.length > 0 ? result[0] : null;
};
