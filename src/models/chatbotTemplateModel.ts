import { isString } from 'lodash-es';

import pool from 'config/db';
import { ChatbotTemplate } from 'types/db/assignment';
import { StudentReminder } from 'types/db/reminder';

export const fetchTemplates = async (): Promise<ChatbotTemplate[]> => {
  const [rows] = await pool.query(`SELECT * FROM chatbot_templates`);
  return rows as ChatbotTemplate[];
};

export const updateTemplate = async (
  templateId: number,
  description: string,
  rolePrompt: string,
  config: string,
): Promise<ChatbotTemplate | null> => {
  const updateParams = [];
  const placeholders = [];
  if (isString(description)) {
    updateParams.push(description);
    placeholders.push('description = ?');
  }
  if (isString(rolePrompt)) {
    updateParams.push(rolePrompt);
    placeholders.push('default_role_prompt = ?');
  }
  if (config) {
    updateParams.push(config);
    placeholders.push('default_config = ?');
  }
  await pool.query(
    `UPDATE chatbot_templates SET ${placeholders.join(', ')} WHERE id = ?`,
    updateParams,
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
