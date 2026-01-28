import { saveNewAssignmentTool } from 'models/assignmentToolModel';
import { ResultSetHeader } from 'mysql2';

import pool from 'config/db';
import {
  AssignmentEnrollment,
  AssignmentOption,
  AssignmentStageCreatePayload,
  AssignmentTeacherListingItem,
} from 'types/assignment';
import { Assignment, AssignmentStage } from 'types/db/assignment';

type AssignmentFilterType = {
  search?: string;
  type?: string;
  status?: string;
};

const getOrderClause = (
  sort: string | undefined,
  sortOrder: 'asc' | 'desc' | undefined,
): string => {
  if (!sort) return '';
  const direction = sortOrder === 'desc' ? 'DESC' : 'ASC';
  const allowedColumns = [
    'id',
    'title',
    'start_date',
    'due_date',
    'type',
    'student_count',
    'submitted_count',
    'graded_count',
    'avg_score',
    'status',
  ];
  if (!allowedColumns.includes(sort)) return '';
  return `ORDER BY ${sort} ${direction}`;
};

const TEACHER_GRADING_TOOL_KEY = 'teacher_grading';
const VOCAB_GENERATE_TOOL_KEY = 'vocab_generate';
const DASHBOARD_GENERATE_TOOL_KEY = 'reflection_dashboard_generate';

export const fetchAssignmentsByTeacherId = async (
  teacherId: number,
  limit: number,
  page: number,
  filter: AssignmentFilterType,
  sort: string | undefined,
  sortOrder: 'asc' | 'desc' | undefined,
): Promise<AssignmentTeacherListingItem[]> => {
  const [assignmentRows] = await pool.query(
    `
    SELECT * FROM (
      SELECT
        id, title, description, start_date, due_date, type, instructions, requirements, rubrics, checklist, created_by,
        COUNT(DISTINCT student_id) as student_count,
        CAST(SUM(submitted) AS UNSIGNED) AS submitted_count,
        CAST(SUM(graded) AS UNSIGNED) AS graded_count,
        CAST(AVG(score) AS DECIMAL(10, 2)) as avg_score,
        CASE
          WHEN start_date IS NOT NULL AND UNIX_TIMESTAMP(UTC_TIMESTAMP()) * 1000 < start_date THEN 'upcoming'
          WHEN due_date IS NOT NULL AND UNIX_TIMESTAMP(UTC_TIMESTAMP()) * 1000 > due_date THEN 'past-due'
          ELSE 'active'
        END AS status
      from (
        SELECT
        a.*, student_ids.student_id as student_id,
          CASE WHEN COUNT(DISTINCT fs.stage_id) = COUNT(DISTINCT ast.id) THEN 1 ELSE 0 END as submitted,
          CASE WHEN COUNT(DISTINCT fs.stage_id) = COUNT(DISTINCT ast.id) AND COUNT(DISTINCT g.submission_id) > 0 THEN 1 ELSE 0 END as graded,
          MAX(g.overall_score) as score
        FROM assignments a
        LEFT JOIN assignment_targets at ON a.id = at.assignment_id
        LEFT JOIN class_teachers ct ON at.class_id = ct.class_id
        JOIN (
          SELECT DISTINCT student_id, assignment_id from assignment_targets WHERE student_id is not null
          UNION
          SELECT DISTINCT cs.student_id, assignment_id from assignment_targets at 
          JOIN class_students cs ON cs.class_id = at.class_id
        ) student_ids ON student_ids.assignment_id = a.id
        JOIN assignment_stages ast ON a.id = ast.assignment_id
        LEFT JOIN assignment_submissions fs ON ast.id = fs.stage_id AND fs.student_id = student_ids.student_id AND fs.is_final = 1
        LEFT JOIN assignment_grades g ON fs.id = g.submission_id
        WHERE (ct.teacher_id = ? OR a.created_by = ?) AND title LIKE ? ${filter.type ? 'AND type = ?' : ''}
        GROUP BY a.id, student_ids.student_id
      ) counts
      GROUP BY counts.id
    ) t
      ${filter.status ? 'WHERE status = ?' : ''}
      ${getOrderClause(sort, sortOrder)}
      LIMIT ? OFFSET ?`,
    [
      teacherId,
      teacherId,
      `%${filter.search}%`,
      ...(filter.type ? [filter.type] : []),
      ...(filter.status ? [filter.status] : []),
      limit,
      (page - 1) * limit,
    ],
  );
  return assignmentRows as AssignmentTeacherListingItem[];
};

export const fetchAssignmentsCountByTeacherId = async (
  id: number,
  filter: AssignmentFilterType,
): Promise<number> => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) FROM (
      SELECT
        DISTINCT a.*,
        CASE
          WHEN a.start_date IS NOT NULL AND UNIX_TIMESTAMP(UTC_TIMESTAMP()) * 1000 < a.start_date THEN 'upcoming'
          WHEN a.due_date IS NOT NULL AND UNIX_TIMESTAMP(UTC_TIMESTAMP()) * 1000 > a.due_date THEN 'past-due'
          ELSE 'active'
        END AS status
      FROM assignments a
      LEFT JOIN assignment_targets at ON a.id = at.assignment_id
      LEFT JOIN class_teachers ct ON at.class_id = ct.class_id
      WHERE (ct.teacher_id = ? OR a.created_by = ?) AND title LIKE ? ${filter.type ? 'AND type = ?' : ''}
    ) t
      ${filter.status ? 'WHERE status = ?' : ''}
    `,
    [
      id,
      id,
      `%${filter.search}%`,
      ...(filter.type ? [filter.type] : []),
      ...(filter.status ? [filter.status] : []),
    ],
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
          WHEN COUNT(DISTINCT fs.stage_id) = COUNT(DISTINCT ast.id) AND COUNT(DISTINCT g.submission_id) = COUNT(DISTINCT fs.stage_id)
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
        AND title LIKE ? ${filter.type ? 'AND type = ?' : ''}
      GROUP BY a.id
    ) t
      ${filter.status ? 'WHERE status = ?' : ''}
      ${getOrderClause(sort, sortOrder)}
      LIMIT ? OFFSET ?
    `,
    [
      studentId,
      studentId,
      studentId,
      `%${filter.search}%`,
      ...(filter.type ? [filter.type] : []),
      ...(filter.status ? [filter.status] : []),
      limit,
      (page - 1) * limit,
    ],
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
          WHEN COUNT(DISTINCT fs.stage_id) = COUNT(DISTINCT ast.id) AND COUNT(DISTINCT g.submission_id) = COUNT(DISTINCT fs.stage_id)
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
        AND title LIKE ? ${filter.type ? 'AND type = ?' : ''}
      GROUP BY a.id
    ) t
      ${filter.status ? 'WHERE status = ?' : ''}
    `,
    [
      studentId,
      studentId,
      studentId,
      `%${filter.search}%`,
      ...(filter.type ? [filter.type] : []),
      ...(filter.status ? [filter.status] : []),
    ],
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
  checklist: string,
  config: string,
  stages: AssignmentStageCreatePayload[],
  createdBy: number,
  enrolledClassIds: number[],
  enrolledStudentIds: number[],
): Promise<Assignment | null> => {
  // 1. Save assignment
  const [insertRows] = await pool.query(
    'INSERT INTO assignments (title, description, due_date, type, instructions, requirements, rubrics, checklist, config, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      title,
      description || null,
      dueDate || null,
      type || null,
      instructions || null,
      requirements,
      rubrics || null,
      checklist || null,
      config || null,
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

  // 2. Add enrollments
  for (const enrolledClassId of enrolledClassIds) {
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

  // 3. Add tools
  await saveNewAssignmentTool(
    assignmentId,
    null,
    TEACHER_GRADING_TOOL_KEY,
    true,
  );
  for (const [i, stage] of stages.entries()) {
    const [insertStageRows] = await pool.query(
      'INSERT INTO assignment_stages (assignment_id, stage_type, order_index, enabled, config) VALUES (?, ?, ?, ?, ?)',
      [
        assignmentId,
        stage.stage_type,
        i,
        stage.enabled,
        JSON.stringify(stage.config),
      ],
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

    if (stage.stage_type === 'language_preparation') {
      await saveNewAssignmentTool(
        assignmentId,
        stageId,
        VOCAB_GENERATE_TOOL_KEY,
        true,
      );
    }

    if (stage.stage_type === 'reflection') {
      await saveNewAssignmentTool(
        assignmentId,
        stageId,
        DASHBOARD_GENERATE_TOOL_KEY,
        true,
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
  checklist: string,
  config: string,
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
  if (checklist) {
    updateParams.push(checklist);
    placeholders.push('checklist = ?');
  }
  if (config) {
    updateParams.push(config);
    placeholders.push('config = ?');
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

  const [stageRows] = await pool.query(
    'SELECT * FROM assignment_stages WHERE assignment_id = ?',
    [assignmentId],
  );
  const existingStages = stageRows as AssignmentStage[];

  for (const existingStage of existingStages) {
    if (!stages.some(stage => stage.stage_type === existingStage.stage_type)) {
      await pool.query(
        'UPDATE assignment_stages SET enabled = 0 WHERE id = ?',
        [existingStage.id],
      );
    }
  }

  for (const [i, stage] of stages.entries()) {
    let stageId = 0;
    const existingStage = existingStages.find(
      es => es.stage_type === stage.stage_type,
    );
    if (existingStage) {
      await pool.query(
        'UPDATE assignment_stages SET enabled = ?, order_index = ?, config = ? WHERE assignment_id = ? AND stage_type = ?',
        [
          stage.enabled,
          i,
          JSON.stringify(stage.config),
          assignmentId,
          stage.stage_type,
        ],
      );
      stageId = existingStage.id;
    } else {
      const [insertRows] = await pool.query(
        'INSERT INTO assignment_stages (assignment_id, stage_type, order_index, enabled, config) VALUES (?, ?, ?, ?, ?)',
        [
          assignmentId,
          stage.stage_type,
          i,
          stage.enabled,
          JSON.stringify(stage.config),
        ],
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

export const fetchAssignmentDescriptionById = async (
  assignmentId: number,
): Promise<string | null> => {
  const [rows] = await pool.query(
    'SELECT title, description, instructions FROM assignments WHERE id = ?',
    [assignmentId],
  );
  const result = rows as Partial<Assignment>[];
  if (result.length < 1 || !result[0].description) {
    return null;
  }
  if (result[0].instructions) {
    return `${result[0].title} \n\nDescription: ${result[0].description} \n\nInstructions: ${result[0].instructions}`;
  }
  if (result[0].description) {
    return `${result[0].title} \n\nDescription: ${result[0].description}`;
  }
  return result[0].title || null;
};

export const fetchStudentIdsByAssignmentId = async (
  assignmentId: number,
): Promise<number[]> => {
  const [classStudentsRows] = await pool.query(
    `
      SELECT DISTINCT cs.student_id as student_id
      FROM assignment_targets at
        INNER JOIN classes c ON c.id = at.class_id
        JOIN class_students cs ON c.id = cs.class_id
      WHERE assignment_id = ?
    `,
    [assignmentId],
  );
  const classStudents = classStudentsRows as { student_id: number }[];
  const classStudentIds = classStudents.map(row => row.student_id);

  const placeholder = classStudentIds.map(() => '?').join(',');
  const [studentTargetsRows] = await pool.query(
    `
      SELECT DISTINCT at.student_id as student_id
      FROM assignment_targets at
      WHERE assignment_id = ? ${placeholder.length ? `AND at.student_id NOT IN (${placeholder})` : ''}
    `,
    [assignmentId, ...classStudentIds],
  );
  const studentTargetIds = (studentTargetsRows as { student_id: number }[]).map(
    row => row.student_id,
  );
  return [...classStudentIds, ...studentTargetIds];
};

export const fetchAssignmentOptionsByStudentId = async (
  studentId: number,
): Promise<AssignmentOption[]> => {
  const [rows] = await pool.query(
    `
      SELECT DISTINCT a.id, a.title
      FROM assignments a
        JOIN assignment_targets at ON a.id = at.assignment_id
      WHERE 
        at.student_id = ? OR at.class_id in (SELECT class_id FROM class_students WHERE student_id = ?)
    `,
    [studentId, studentId],
  );

  return rows as AssignmentOption[];
};

export const fetchAssignmentOptionsByTeacherId = async (
  teacherId: number,
): Promise<AssignmentOption[]> => {
  const [rows] = await pool.query(
    `
      SELECT DISTINCT a.id, a.title
      FROM assignments a
      JOIN assignment_targets at ON a.id = at.assignment_id
      JOIN class_teachers ct ON at.class_id = ct.class_id
      WHERE ct.teacher_id = ? OR a.created_by = ?
    `,
    [teacherId, teacherId],
  );

  return rows as AssignmentOption[];
};
