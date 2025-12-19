import { ResultSetHeader } from 'mysql2';

import pool from 'config/db';
import { AssignmentGrade } from 'types/db/assignment';

export const fetchLatestGradesBySubmissionIds = async (
  submissionIds: number[],
): Promise<AssignmentGrade[]> => {
  if (!submissionIds.length) {
    return [];
  }

  const placeholders = submissionIds.map(() => '?').join(',');

  const [rows] = await pool.query(
    `
    SELECT s.*,
      COALESCE(
        NULLIF(CONCAT(u.last_name, u.first_name), ''),
        u.username
      ) AS graded_by
    FROM assignment_grades s
    INNER JOIN (
      SELECT submission_id, max(graded_at) as max_graded_at
      FROM assignment_grades
      WHERE submission_id IN (${placeholders})
      GROUP BY submission_id
    ) latest_grades
      ON latest_grades.submission_id = s.submission_id
      AND latest_grades.max_graded_at = s.graded_at
    LEFT JOIN users u ON s.graded_by = u.id
    `,
    [...submissionIds],
  );
  return rows as AssignmentGrade[];
};

export const saveNewGrading = async (
  submission_id: number,
  overall_score: number,
  overall_feedback: string | undefined,
  rubrics_breakdown: string | undefined,
  graded_at: number | undefined,
  graded_by: number,
): Promise<AssignmentGrade> => {
  const [insertRows] = await pool.query(
    `
    INSERT INTO assignment_grades (
      submission_id, overall_score, overall_feedback, rubrics_breakdown, graded_at, graded_by
    ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      submission_id,
      overall_score,
      overall_feedback || null,
      rubrics_breakdown || null,
      graded_at || null,
      graded_by,
    ],
  );

  const insertResult = insertRows as ResultSetHeader;
  const gradeId = insertResult.insertId;
  return {
    id: gradeId,
    submission_id,
    overall_score,
    overall_feedback,
    rubrics_breakdown,
    graded_at,
    graded_by,
  };
};
