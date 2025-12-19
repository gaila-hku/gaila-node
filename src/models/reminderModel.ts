import pool from 'config/db';
import { StudentReminder } from 'types/db/reminder';

export const fetchRemindersByStudentId = async (
  studentId: number,
  limit: number,
  page: number,
): Promise<StudentReminder[]> => {
  const [rows] = await pool.query(
    `SELECT * FROM student_reminders WHERE student_id = ? LIMIT ? OFFSET ?`,
    [studentId, limit, (page - 1) * limit],
  );
  return rows as StudentReminder[];
};

export const fetchReminderCountByStudentId = async (
  studentId: number,
  limit: number,
  page: number,
): Promise<number> => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) FROM student_reminders WHERE student_id = ? ORDER BY reminded_at DESC LIMIT ? OFFSET ?`,
    [studentId, limit, (page - 1) * limit],
  );
  const results = rows as { 'COUNT(*)': number }[];
  return results.length > 0 ? results[0]['COUNT(*)'] : 0;
};

export const fetchRemindersByAssignmentIdStudentId = async (
  assignmentId: number,
  studentId: number,
): Promise<StudentReminder[]> => {
  const [rows] = await pool.query(
    `SELECT * FROM student_reminders WHERE student_id = ? AND assignment_id = ? ORDER BY reminded_at DESC `,
    [studentId, assignmentId],
  );
  return rows as StudentReminder[];
};

export const saveNewReminder = async (
  assignmentId: number,
  studentId: number,
  teacherId: number,
  reminderType: 'writing' | 'ai' | 'dashboard' | 'copying',
): Promise<StudentReminder> => {
  const remindedAt = Date.now();

  const [insertRows] = await pool.query(
    `INSERT INTO student_reminders (assignment_id, student_id, teacher_id, reminder_type, reminded_at)
     VALUES (?, ?, ?, ?, ?)`,
    [assignmentId, studentId, teacherId, reminderType, remindedAt],
  );
  const insertId = (insertRows as any).insertId;
  return {
    id: insertId,
    assignment_id: assignmentId,
    student_id: studentId,
    teacher_id: teacherId,
    reminder_type: reminderType,
    reminded_at: remindedAt,
  };
};
