import pool from 'config/db';
import { ChatbotTemplate } from 'types/db/assignment';
import { StudentReminder } from 'types/db/reminder';

export const fetchTemplates = async (): Promise<ChatbotTemplate[]> => {
  const [rows] = await pool.query(`SELECT * FROM chatbot_templates`);
  return rows as ChatbotTemplate[];
};

export const updateTemplate = async (
  templateId: number,
  rolePrompt: string,
  config: string,
): Promise<ChatbotTemplate | null> => {
  await pool.query(
    `UPDATE chatbot_templates SET default_role_prompt = ?, default_config = ? WHERE id = ?`,
    [rolePrompt, config, templateId],
  );
  const [templateRows] = await pool.query(
    `SELECT * FROM chatbot_templates WHERE id = ?`,
    [templateId],
  );
  const templateResults = templateRows as ChatbotTemplate[];
  return templateResults.length > 0 ? templateResults[0] : null;
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
