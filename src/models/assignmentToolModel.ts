import pool from 'config/db';
import { AssignmentTool } from 'types/assignment';

export const fetchRolePromptByAssignmentToolId = async (
  assignmentToolId: number,
): Promise<string | null> => {
  const [rows] = await pool.query(
    `SELECT default_role_prompt, custom_role_prompt 
    FROM assignment_tools tools
    JOIN chatbot_templates ON tools.chatbot_template_id = chatbot_templates.id
    WHERE tools.id = ?`,
    [assignmentToolId],
  );
  const result = rows as {
    default_role_prompt: string;
    custom_role_prompt: string;
  }[];
  return result.length > 0
    ? result[0].custom_role_prompt || result[0].default_role_prompt
    : null;
};

export const fetchAssignmentToolByAssignmentToolId = async (
  assignmentToolId: number,
): Promise<AssignmentTool | null> => {
  const [rows] = await pool.query(
    `SELECT * FROM assignment_tools WHERE id = ?`,
    [assignmentToolId],
  );
  const result = rows as AssignmentTool[];
  return result.length > 0 ? result[0] : null;
};

export const saveNewAssignmentTool = async (
  assignmentId: number | null,
  stageId: number | null,
  key: string,
  enabled: boolean,
): Promise<void> => {
  const [templateRows] = await pool.query(
    `SELECT * FROM chatbot_templates WHERE name = ?`,
    [key],
  );
  const templateResults = templateRows as { id: number }[];
  if (templateResults.length > 0) {
    await pool.query(
      `INSERT INTO assignment_tools (assignment_id, assignment_stage_id, chatbot_template_id, tool_key, enabled) VALUES (?, ?, ?, ?, ?)`,
      [assignmentId, stageId, templateResults[0].id, key, enabled],
    );
  } else {
    await pool.query(
      `INSERT INTO assignment_tools (assignment_id, assignment_stage_id, tool_key, enabled) VALUES (?, ?, ?, ?)`,
      [assignmentId, stageId, key, enabled],
    );
  }
};
