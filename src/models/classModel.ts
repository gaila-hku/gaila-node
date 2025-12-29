import { ResultSetHeader } from 'mysql2';

import pool from 'config/db';
import { ClassDetail, ClassManagementDetail, ClassOption } from 'types/class';
import { Class, ClassStudent, ClassTeacher } from 'types/db/class';

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
    `SELECT c.*,
      (
        SELECT JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'username', u.username, 'first_name', u.first_name, 'last_name', u.last_name))
        FROM class_students cs
        JOIN users u ON cs.student_id = u.id
        WHERE cs.class_id = c.id
      ) as students,
      (
        SELECT JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'username', u.username, 'first_name', u.first_name, 'last_name', u.last_name))
        FROM class_teachers ct
        JOIN users u ON ct.teacher_id = u.id
        WHERE ct.class_id = c.id
      ) as teachers,
      (
        SELECT JSON_ARRAYAGG(JSON_OBJECT('id', a.id, 'title', a.title, 'description', a.description, 'start_date', a.start_date, 'due_date', a.due_date, 'type', a.type))
        FROM assignment_targets at
        JOIN assignments a ON at.assignment_id = a.id
        WHERE at.class_id = c.id
      ) as assignments
    FROM classes c
    WHERE c.id = ?`,
    [id],
  );
  const result = classRows as ClassDetail[];
  return result.length > 0
    ? {
        ...result[0],
        students: result[0].students || [],
        teachers: result[0].teachers || [],
        assignments: result[0].assignments || [],
      }
    : null;
};

export const fetchClassesByIds = async (ids: number[]): Promise<Class[]> => {
  const [rows] = await pool.query(`SELECT * FROM classes WHERE id IN (?)`, [
    ids,
  ]);
  return rows as Class[];
};

export const fetchClassListing = async (
  limit: number,
  page: number,
  filter: string,
): Promise<ClassManagementDetail[]> => {
  const filterPattern = `%${filter || ''}%`;
  const [classRows] = await pool.query(
    `SELECT 
        c.id,
        c.class_key,
        c.name,
        c.description,
        (
            SELECT JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'username', u.username, 'first_name', u.first_name, 'last_name', u.last_name))
            FROM class_students cs
            JOIN users u ON cs.student_id = u.id
            WHERE cs.class_id = c.id
        ) AS students,
        (
            SELECT JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'username', u.username, 'first_name', u.first_name, 'last_name', u.last_name))
            FROM class_teachers ct
            JOIN users u ON ct.teacher_id = u.id
            WHERE ct.class_id = c.id
        ) AS teachers
    FROM classes c
    WHERE (? = '' OR c.name LIKE ? OR c.description LIKE ?)
    LIMIT ? OFFSET ?`,
    [filter || '', filterPattern, filterPattern, limit, (page - 1) * limit],
  );
  const classResults = classRows as ClassManagementDetail[];
  return classResults.map(item => ({
    ...item,
    students: item.students || [],
    teachers: item.teachers || [],
  }));
};

export const fetchClassesCount = async (filter: string): Promise<number> => {
  if (!filter) {
    const [rows] = await pool.query(`SELECT COUNT(*) FROM classes`);
    const result = rows as { 'COUNT(*)': number }[];
    return result.length > 0 ? result[0]['COUNT(*)'] : 0;
  }
  const likeFilter = `%${filter}%`;
  const [rows] = await pool.query(
    `SELECT COUNT(*)
    FROM classes
    WHERE name LIKE ? OR description LIKE ?`,
    [likeFilter, likeFilter],
  );
  const result = rows as { 'COUNT(*)': number }[];
  return result.length > 0 ? result[0]['COUNT(*)'] : 0;
};

export const fetchClassByKey = async (key: string): Promise<Class | null> => {
  const [rows] = await pool.query('SELECT * FROM classes WHERE class_key = ?', [
    key,
  ]);
  const result = rows as Class[];
  return result.length > 0 ? result[0] : null;
};

export const createNewClass = async (
  name: string,
  class_key: string,
  description: string,
): Promise<Class> => {
  const [rows] = await pool.query(
    'INSERT INTO classes (name, class_key, description) VALUES (?, ?, ?)',
    [name, class_key, description],
  );
  const insertId = (rows as ResultSetHeader).insertId;
  return {
    id: insertId,
    name,
    class_key,
    description,
  } as Class;
};

export const updateExistingClass = async (
  id: number,
  name?: string,
  class_key?: string,
  description?: string,
  teachers?: number[],
  students?: number[],
): Promise<ClassManagementDetail> => {
  const updateParams = [];
  const placeholders = [];
  if (name) {
    updateParams.push(name);
    placeholders.push('name = ?');
  }
  if (class_key) {
    updateParams.push(class_key);
    placeholders.push('class_key = ?');
  }
  if (description) {
    updateParams.push(description);
    placeholders.push('description = ?');
  }
  updateParams.push(id);
  await pool.query(
    `UPDATE classes SET ${placeholders.join(', ')} WHERE id = ?`,
    updateParams,
  );

  let finalTeachers: ClassDetail['teachers'] = [];
  if (teachers) {
    const [enrolledTeachersRows] = await pool.query(
      'SELECT * FROM class_teachers WHERE class_id = ?',
      [id],
    );
    const enrolledTeachers = enrolledTeachersRows as ClassTeacher[];
    const enrolledTeacherIds = enrolledTeachers.map(s => s.teacher_id);
    const pendingEnrollTeacherIds = teachers.filter(
      id => !enrolledTeacherIds.includes(id),
    );
    const pendingRemoveTeachers = enrolledTeachers.filter(
      et => !teachers.includes(et.teacher_id),
    );
    for (const teacherId of pendingEnrollTeacherIds) {
      await pool.query(
        'INSERT INTO class_teachers (class_id, teacher_id) VALUES (?, ?)',
        [id, teacherId],
      );
    }
    for (const rt of pendingRemoveTeachers) {
      await pool.query('DELETE FROM class_teachers WHERE id = ?', [rt.id]);
    }
    const [finalTeacherRows] = await pool.query(
      `SELECT u.id as id, u.username as username, u.first_name as first_name, u.last_name as last_name
      FROM class_teachers ct
      JOIN users u ON ct.teacher_id = u.id
      WHERE class_id = ?`,
      [id],
    );
    finalTeachers = finalTeacherRows as ClassDetail['teachers'];
  }

  let finalStudents: ClassDetail['students'] = [];
  if (students) {
    const [enrolledStudentRows] = await pool.query(
      'SELECT * FROM class_students WHERE class_id = ?',
      [id],
    );
    const enrolledStudents = enrolledStudentRows as ClassStudent[];
    const enrolledStudentIds = enrolledStudents.map(s => s.student_id);
    const pendingEnrollStudentIds = students.filter(
      id => !enrolledStudentIds.includes(id),
    );
    const pendingRemoveStudents = enrolledStudents.filter(
      es => !students.includes(es.student_id),
    );
    for (const studentId of pendingEnrollStudentIds) {
      await pool.query(
        'INSERT INTO class_students (class_id, student_id) VALUES (?, ?)',
        [id, studentId],
      );
    }
    for (const rs of pendingRemoveStudents) {
      await pool.query('DELETE FROM class_students WHERE id = ?', [rs.id]);
    }
    const [finalStudentRows] = await pool.query(
      `SELECT u.id as id, u.username as username, u.first_name as first_name, u.last_name as last_name
      FROM class_students cs
      JOIN users u ON cs.student_id = u.id
      WHERE class_id = ?`,
      [id],
    );
    finalStudents = finalStudentRows as ClassDetail['students'];
  }

  return {
    id,
    name,
    description,
    teachers: finalTeachers,
    students: finalStudents,
  } as ClassManagementDetail;
};

export const addStudentToClass = async (userId: number, classKey: string) => {
  const classItem = await fetchClassByKey(classKey);
  if (!classItem) {
    throw new Error('Class not found');
  }
  const classId = classItem.id;
  await pool.query(
    'INSERT INTO class_students (class_id, student_id) VALUES (?, ?)',
    [classId, userId],
  );
};

export const addTeacherToClass = async (userId: number, classKey: string) => {
  const classItem = await fetchClassByKey(classKey);
  if (!classItem) {
    throw new Error('Class not found');
  }
  const classId = classItem.id;
  await pool.query(
    'INSERT INTO class_teachers (class_id, teacher_id) VALUES (?, ?)',
    [classId, userId],
  );
};
