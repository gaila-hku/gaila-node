import { isNumber } from 'lodash-es';
import { saveNewAssignmentTool } from 'models/assignmentToolModel';
import { ResultSetHeader } from 'mysql2';

import pool from 'config/db';
import {
  Assignment,
  AssignmentEnrollment,
  AssignmentStageCreatePayload,
} from 'types/assignment';
import { ClassTeacher } from 'types/class';

type AssignmentFilterType = {
  search?: string;
  type?: string;
  status?: string;
};

export const fetchAssignmentsByTeacherId = async (
  teacherId: number,
  limit: number,
  page: number,
  filter: AssignmentFilterType,
  sort: string | undefined,
  sortOrder: 'asc' | 'desc' | undefined,
): Promise<Assignment[]> => {
  const [assignmentRows] = await pool.query(
    `
    SELECT * FROM (
      SELECT
        a.*,
        CASE
          WHEN a.start_date IS NOT NULL AND UNIX_TIMESTAMP(UTC_TIMESTAMP()) * 1000 < a.start_date THEN 'upcoming'
          WHEN a.due_date IS NOT NULL AND UNIX_TIMESTAMP(UTC_TIMESTAMP()) * 1000 > a.due_date THEN 'past-due'
          ELSE 'active'
        END AS status
      FROM assignments a
      JOIN assignment_teachers at ON a.id = at.assignment_id
      WHERE at.teacher_id = ? AND title like '%${filter.search}%' ${filter.type ? `AND type = '${filter.type}'` : ''}
    ) t
      ${filter.status ? `WHERE status = '${filter.status}'` : ''}
      ${sort ? `ORDER BY ${sort} ${sortOrder || 'asc'}` : ''}
      LIMIT ? OFFSET ?`,
    [teacherId, limit, (page - 1) * limit],
  );
  return assignmentRows as Assignment[];
};

export const fetchAssignmentsCountByTeacherId = async (
  id: number,
  filter: AssignmentFilterType,
): Promise<number> => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) FROM (
      SELECT
        a.*,
        CASE
          WHEN a.start_date IS NOT NULL AND UNIX_TIMESTAMP(UTC_TIMESTAMP()) * 1000 < a.start_date THEN 'upcoming'
          WHEN a.due_date IS NOT NULL AND UNIX_TIMESTAMP(UTC_TIMESTAMP()) * 1000 > a.due_date THEN 'past-due'
          ELSE 'active'
        END AS status
      FROM assignments a
      JOIN assignment_teachers at ON a.id = at.assignment_id
      WHERE at.teacher_id = ? AND title like '%${filter.search}%' ${filter.type ? `AND type = '${filter.type}'` : ''}
    ) t
      ${filter.status ? `WHERE status = '${filter.status}'` : ''}
    `,
    [id],
  );
  const result = rows as { 'COUNT(*)': number }[];
  return result.length > 0 ? result[0]['COUNT(*)'] : 0;
};

export const fetchAssignmentsByStudentId = async (
  studentId: number,
  limit: number,
  page: number,
  filter: AssignmentFilterType,
  sort: string | undefined,
  sortOrder: 'asc' | 'desc' | undefined,
): Promise<Assignment[]> => {
  const [assignmentRows] = await pool.query(
    `SELECT * from (
      SELECT
        a.*,
        CASE
          WHEN a.start_date IS NOT NULL AND UNIX_TIMESTAMP(UTC_TIMESTAMP()) * 1000 < a.start_date THEN 'upcoming'
          WHEN a.due_date IS NOT NULL AND UNIX_TIMESTAMP(UTC_TIMESTAMP()) * 1000 > a.due_date AND COUNT(DISTINCT fs.stage_id) != COUNT(DISTINCT ast.id) THEN 'past-due'
          WHEN COUNT(DISTINCT fs.stage_id) = COUNT(DISTINCT ast.id) AND COUNT(DISTINCT g.id) = COUNT(DISTINCT fs.stage_id)
            THEN 'graded'
          WHEN COUNT(DISTINCT fs.stage_id) = COUNT(DISTINCT ast.id) THEN 'submitted'
          ELSE 'in-progress'
        END AS status
      FROM assignments a
        JOIN assignment_targets at ON a.id = at.assignment_id
        JOIN assignment_stages ast ON a.id = ast.assignment_id
        LEFT JOIN assignment_submissions fs ON ast.id = fs.stage_id AND fs.student_id = ? AND fs.is_final = 1
        LEFT JOIN assignment_grades g ON fs.id = g.submission_id
      WHERE 
        (at.student_id = ? OR at.class_id in (SELECT class_id FROM class_students WHERE student_id = ?)) 
        AND title like '%${filter.search}%' ${filter.type ? `AND type = '${filter.type}'` : ''}
      GROUP BY a.id
    ) t
      ${filter.status ? `WHERE status = '${filter.status}'` : ''}
      ${sort ? `ORDER BY ${sort} ${sortOrder || 'asc'}` : ''}
      LIMIT ? OFFSET ?
    `,
    [studentId, studentId, studentId, limit, (page - 1) * limit],
  );
  return assignmentRows as Assignment[];
};

export const fetchAssignmentsCountByStudentId = async (
  studentId: number,
  filter: AssignmentFilterType,
): Promise<number> => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) from (
      SELECT
        a.*,
        CASE
          WHEN a.start_date IS NOT NULL AND UNIX_TIMESTAMP(UTC_TIMESTAMP()) * 1000 < a.start_date THEN 'upcoming'
          WHEN a.due_date IS NOT NULL AND UNIX_TIMESTAMP(UTC_TIMESTAMP()) * 1000 > a.due_date AND COUNT(DISTINCT fs.stage_id) != COUNT(DISTINCT ast.id) THEN 'past-due'
          WHEN COUNT(DISTINCT fs.stage_id) = COUNT(DISTINCT ast.id) AND COUNT(DISTINCT g.id) = COUNT(DISTINCT fs.stage_id)
            THEN 'graded'
          WHEN COUNT(DISTINCT fs.stage_id) = COUNT(DISTINCT ast.id) THEN 'submitted'
          ELSE 'in-progress'
        END AS status
      FROM assignments a
        JOIN assignment_targets at ON a.id = at.assignment_id
        JOIN assignment_stages ast ON a.id = ast.assignment_id
        LEFT JOIN assignment_submissions fs ON ast.id = fs.stage_id AND fs.student_id = ? AND fs.is_final = 1
        LEFT JOIN assignment_grades g ON fs.id = g.submission_id
      WHERE 
        (at.student_id = ? OR at.class_id in (SELECT class_id FROM class_students WHERE student_id = ?)) 
        AND title like '%${filter.search}%' ${filter.type ? `AND type = '${filter.type}'` : ''}
      GROUP BY a.id
    ) t
      ${filter.status ? `WHERE status = '${filter.status}'` : ''}
    `,
    [studentId, studentId, studentId],
  );
  const result = rows as { 'COUNT(*)': number }[];
  return result.length > 0 ? result[0]['COUNT(*)'] : 0;
};

export const fetchAssignmentById = async (
  id: number,
): Promise<Assignment | null> => {
  const [rows] = await pool.query('SELECT * FROM assignments WHERE id = ?', [
    id,
  ]);
  const result = rows as Assignment[];
  return result.length > 0 ? result[0] : null;
};

export const fetchAssignementEnrollmentsById = async (
  id: number,
): Promise<AssignmentEnrollment[]> => {
  const [targetRows] = await pool.query(
    `SELECT at.id, at.assignment_id as assignment_id, at.class_id as class_id, at.student_id as student_id,
        grouped_classes.name as class_name, grouped_classes.num_students as num_students,
        users.username as username, users.first_name as first_name, users.last_name as last_name FROM assignment_targets at
      LEFT JOIN (
        SELECT classes.id as id, classes.name as name, COUNT(*) as num_students
        FROM classes
        JOIN class_students ON classes.id = class_students.class_id
        GROUP BY classes.id
      ) grouped_classes on grouped_classes.id = at.class_id
      LEFT JOIN users ON users.id = at.student_id
      WHERE at.assignment_id = ?`,
    [id],
  );
  const result = targetRows as AssignmentEnrollment[];
  return result;
};

export const fetchRubricsByAssignmentId = async (
  id: number,
): Promise<string | null> => {
  const [rows] = await pool.query(
    'SELECT rubrics FROM assignments WHERE id = ?',
    [id],
  );
  const result = rows as { rubrics: string }[];
  return result.length > 0 ? result[0].rubrics : null;
};

export const saveNewAssignment = async (
  title: string,
  description: string,
  dueDate: string,
  type: string,
  instructions: string,
  requirements: string,
  rubrics: string,
  tips: string,
  stages: AssignmentStageCreatePayload[],
  createdBy: number,
  enrolledClassIds: number[],
  enrolledStudentIds: number[],
): Promise<Assignment | null> => {
  const [insertRows] = await pool.query(
    'INSERT INTO assignments (title, description, due_date, type, instructions, requirements, rubrics, tips, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      title,
      description || null,
      dueDate || null,
      type || null,
      instructions || null,
      requirements,
      rubrics || null,
      tips || null,
      createdBy,
    ],
  );
  const insertResult = insertRows as ResultSetHeader;
  const assignmentId = insertResult.insertId;
  const [assignmentRows] = await pool.query(
    'SELECT * FROM assignments WHERE id = ?',
    [assignmentId],
  );
  const result = assignmentRows as Assignment[];

  for (const enrolledClassId of enrolledClassIds) {
    const [teacherRows] = await pool.query(
      'SELECT teacher_id FROM class_teachers WHERE class_id = ?',
      [enrolledClassId],
    );
    const teacherIds = (teacherRows as ClassTeacher[]).map(
      row => row.teacher_id,
    );
    for (const teacherId of teacherIds) {
      await pool.query(
        'INSERT INTO assignment_teachers (assignment_id, teacher_id) VALUES (?, ?)',
        [assignmentId, teacherId],
      );
    }
    await pool.query(
      'INSERT INTO assignment_targets (assignment_id, class_id) VALUES (?, ?)',
      [assignmentId, enrolledClassId],
    );
  }
  for (const enrolledStudentId of enrolledStudentIds) {
    await pool.query(
      'INSERT INTO assignment_targets (assignment_id, student_id) VALUES (?, ?)',
      [assignmentId, enrolledStudentId],
    );
  }

  for (const [i, stage] of stages.entries()) {
    const [insertStageRows] = await pool.query(
      'INSERT INTO assignment_stages (assignment_id, stage_type, order_index, enabled) VALUES (?, ?, ?, ?)',
      [assignmentId, stage.stage_type, i, stage.enabled],
    );
    const insertStageResult = insertStageRows as ResultSetHeader;
    const stageId = insertStageResult.insertId;

    for (const tool of stage.tools) {
      await saveNewAssignmentTool(
        assignmentId,
        stageId,
        tool.key,
        tool.enabled,
      );
    }
  }

  return result.length > 0 ? result[0] : null;
};

export const updateExistingAssignment = async (
  assignmentId: number,
  title: string,
  description: string,
  dueDate: string,
  type: string,
  instructions: string,
  requirements: string,
  rubrics: string,
  tips: string,
  stages: AssignmentStageCreatePayload[],
  newEnrolledClassIds: number[],
  newEnrolledStudentIds: number[],
): Promise<Assignment | null> => {
  const updateParams = [];
  const placeholders = [];
  if (title) {
    updateParams.push(title);
    placeholders.push('title = ?');
  }
  if (description) {
    updateParams.push(description);
    placeholders.push('description = ?');
  }
  if (dueDate) {
    updateParams.push(dueDate);
    placeholders.push('due_date = ?');
  }
  if (type) {
    updateParams.push(type);
    placeholders.push('type = ?');
  }
  if (instructions) {
    updateParams.push(instructions);
    placeholders.push('instructions = ?');
  }
  if (requirements) {
    updateParams.push(requirements);
    placeholders.push('requirements = ?');
  }
  if (rubrics) {
    updateParams.push(rubrics);
    placeholders.push('rubrics = ?');
  }
  if (tips) {
    updateParams.push(tips);
    placeholders.push('tips = ?');
  }

  await pool.query(
    `UPDATE assignments SET ${placeholders.join(', ')} WHERE id = ?`,
    [...updateParams, assignmentId],
  );
  const [assignmentRows] = await pool.query(
    'SELECT * FROM assignments WHERE id = ?',
    [assignmentId],
  );
  const result = assignmentRows as Assignment[];

  const [enrolledClassRows] = await pool.query(
    'SELECT * FROM assignment_targets WHERE assignment_id = ?',
    [assignmentId],
  );
  const enrolledClasses = enrolledClassRows as AssignmentEnrollment[];

  for (const enrolledClass of enrolledClasses) {
    if (
      ('class_id' in enrolledClass &&
        enrolledClass.class_id !== null &&
        !newEnrolledClassIds.includes(enrolledClass.class_id)) ||
      ('student_id' in enrolledClass &&
        enrolledClass.student_id !== null &&
        !newEnrolledStudentIds.includes(enrolledClass.student_id))
    ) {
      await pool.query('DELETE FROM assignment_targets WHERE id = ?', [
        enrolledClass.id,
      ]);
      const [teacherRows] = await pool.query(
        'SELECT teacher_id FROM class_teachers WHERE class_id = ?',
        [enrolledClass.id],
      );
      const teacherIds = (teacherRows as ClassTeacher[]).map(
        row => row.teacher_id,
      );
      for (const teacherId of teacherIds) {
        await pool.query(
          'DELETE FROM assignment_teachers WHERE assignment_id = ? AND teacher_id = ?',
          [assignmentId, teacherId],
        );
      }
    }
  }

  for (const enrolledClassId of newEnrolledClassIds) {
    if (
      enrolledClasses.some(
        enrolledClass =>
          'class_id' in enrolledClass &&
          enrolledClass.class_id !== null &&
          enrolledClass.class_id === enrolledClassId,
      )
    ) {
      continue;
    }
    const [teacherRows] = await pool.query(
      'SELECT teacher_id FROM class_teachers WHERE class_id = ?',
      [enrolledClassId],
    );
    const teacherIds = (teacherRows as ClassTeacher[]).map(
      row => row.teacher_id,
    );
    for (const teacherId of teacherIds) {
      await pool.query(
        'INSERT INTO assignment_teachers (assignment_id, teacher_id) VALUES (?, ?)',
        [assignmentId, teacherId],
      );
    }
    await pool.query(
      'INSERT INTO assignment_targets (assignment_id, class_id) VALUES (?, ?)',
      [assignmentId, enrolledClassId],
    );
  }

  for (const enrolledStudentId of newEnrolledStudentIds) {
    if (
      enrolledClasses.some(
        enrolledClass =>
          'student_id' in enrolledClass &&
          enrolledClass.student_id === enrolledStudentId,
      )
    ) {
      continue;
    }
    await pool.query(
      'INSERT INTO assignment_targets (assignment_id, student_id) VALUES (?, ?)',
      [assignmentId, enrolledStudentId],
    );
  }

  for (const [i, stage] of stages.entries()) {
    let stageId = 0;
    if ('id' in stage && isNumber(stage.id)) {
      await pool.query(
        'UPDATE assignment_stages SET enabled = ?, order_index = ? WHERE id = ?',
        [stage.enabled, i, stage.id],
      );
      stageId = stage.id;
    } else {
      const [insertRows] = await pool.query(
        'INSERT INTO assignment_stages (assignment_id, stage_type, order_index, enabled) VALUES (?, ?, ?, ?)',
        [assignmentId, stage.stage_type, i, stage.enabled],
      );
      const insertResult = insertRows as ResultSetHeader;
      stageId = insertResult.insertId;
    }

    for (const tool of stage.tools) {
      const [toolUpdateRows] = await pool.query(
        'UPDATE assignment_tools SET enabled = ? WHERE assignment_id = ? AND assignment_stage_id = ? AND tool_key = ?',
        [tool.enabled, assignmentId, stageId, tool.key],
      );

      const toolUpdateResult = toolUpdateRows as ResultSetHeader;
      if (toolUpdateResult.affectedRows === 0) {
        await saveNewAssignmentTool(
          assignmentId,
          stageId,
          tool.key,
          tool.enabled,
        );
      }
    }
  }

  return result.length > 0 ? result[0] : null;
};
