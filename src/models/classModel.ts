import pool from 'config/db';
import { Assignment } from 'types/assignment';
import { Class, ClassDetail, ClassOption } from 'types/class';
import { User } from 'types/user';

export const fetchClassListingByTeacherId = async (
  id: number,
  limit: number,
  page: number,
): Promise<Class[]> => {
  const [classRows] = await pool.query(
    'SELECT classes.* FROM classes JOIN class_teachers ON classes.id = class_teachers.class_id WHERE class_teachers.teacher_id = ? LIMIT ? OFFSET ?',
    [id, limit, (page - 1) * limit],
  );
  return classRows as Class[];
};

export const fetchClassesCountByTeacherId = async (
  id: number,
): Promise<number> => {
  const [rows] = await pool.query(
    'SELECT COUNT(*) FROM classes JOIN class_teachers ON classes.id = class_teachers.class_id WHERE class_teachers.teacher_id = ?',
    [id],
  );
  const result = rows as { 'COUNT(*)': number }[];
  return result.length > 0 ? result[0]['COUNT(*)'] : 0;
};

export const fetchClassOptionsByTeacherId = async (
  id: number,
): Promise<ClassOption[]> => {
  const [classRows] = await pool.query(
    `SELECT classes.id as id, classes.name as name, COUNT(*) as num_students
      FROM classes
      JOIN class_students ON classes.id = class_students.class_id
      WHERE class_id IN (
        SELECT class_id FROM class_teachers WHERE teacher_id = ?
      )
      GROUP BY classes.id`,
    [id],
  );
  return classRows as ClassOption[];
};

export const fetchClassListingByStudentId = async (
  id: number,
  limit: number,
  page: number,
): Promise<Class[]> => {
  const [classStudentRows] = await pool.query(
    'SELECT classes.* FROM classes JOIN class_students ON classes.id = class_students.student_id WHERE student_id = ? LIMIT ? OFFSET ?',
    [id, limit, (page - 1) * limit],
  );
  return classStudentRows as Class[];
};

export const fetchClassesCountByStudentId = async (
  id: number,
): Promise<number> => {
  const [rows] = await pool.query(
    'SELECT COUNT(*) FROM classes JOIN class_students ON classes.id = class_students.student_id WHERE student_id = ?',
    [id],
  );
  const result = rows as { 'COUNT(*)': number }[];
  return result.length > 0 ? result[0]['COUNT(*)'] : 0;
};

export const fetchClassById = async (
  id: number,
): Promise<ClassDetail | null> => {
  const [classRows] = await pool.query(
    `SELECT * FROM classes c WHERE c.id = ?`,
    [id],
  );
  const result = classRows as Class[];
  const cls = result.length > 0 ? result[0] : null;
  if (!cls) {
    return null;
  }

  const res = {
    ...cls,
    teachers: [],
    students: [],
    assignments: [],
  } as ClassDetail;

  const [classTeacherRows] = await pool.query(
    `SELECT u.id as id, u.username as username, u.first_name as first_name, u.last_name as last_name
      FROM class_teachers ct
      JOIN users u ON ct.teacher_id = u.id
      WHERE class_id = ?`,
    [id],
  );
  const classTeachers = classTeacherRows as User[];
  res.teachers = classTeachers;

  const [classStudentRows] = await pool.query(
    `SELECT u.id as id, u.username as username, u.first_name as first_name, u.last_name as last_name
      FROM class_students cs
      JOIN users u ON cs.student_id = u.id
      WHERE class_id = ?`,
    [id],
  );
  const classStudents = classStudentRows as User[];
  res.students = classStudents;

  const [classAssignmentRows] = await pool.query(
    `SELECT a.id as id, a.title as title, a.description as description, a.start_date as start_date, a.due_date as due_date, a.type as type
      FROM assignment_targets at
      JOIN assignments a ON at.assignment_id = a.id
      WHERE class_id = ?`,
    [id],
  );
  const classAssignments = classAssignmentRows as Assignment[];
  res.assignments = classAssignments;
  return res;
};

export const fetchClassesByIds = async (ids: number[]): Promise<Class[]> => {
  const [rows] = await pool.query(`SELECT * FROM classes WHERE id IN (?)`, [
    ids,
  ]);
  return rows as Class[];
};
