import { defaults, isString } from 'lodash-es';

import pool from 'config/db';
import { AssignmentTool, ChatbotConfig } from 'types/db/assignment';

export const fetchToolSettingsByAssignmentToolId = async (
  assignmentToolId: number,
): Promise<{ rolePrompt: string; config: ChatbotConfig } | null> => {
  const [rows] = await pool.query(
    `SELECT default_role_prompt, custom_role_prompt, default_config, custom_config
    FROM assignment_tools tools
    JOIN chatbot_templates ON tools.chatbot_template_id = chatbot_templates.id
    WHERE tools.id = ?`,
    [assignmentToolId],
  );
  const result = rows as {
    default_role_prompt: string;
    custom_role_prompt: string;
    default_config: ChatbotConfig;
    custom_config: ChatbotConfig;
  }[];
  return result.length > 0
    ? {
        rolePrompt:
          result[0].custom_role_prompt || result[0].default_role_prompt,
        config: defaults(result[0].custom_config, result[0].default_config),
      }
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

export const fetchAssignmentToolsByAssignmentId = async (
  assignmentId: number,
): Promise<AssignmentTool[]> => {
  const [rows] = await pool.query(
    `SELECT * FROM assignment_tools WHERE  assignment_id = ?`,
    [assignmentId],
  );
  return rows as AssignmentTool[];
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

export const updateAssignmentToolConfigById = async (
  assignmentToolId: number,
  rolePrompt: string | undefined,
  config: string | undefined,
): Promise<AssignmentTool | null> => {
  const updateParams = [];
  const placeholders = [];
  if (isString(rolePrompt)) {
    updateParams.push(rolePrompt);
    placeholders.push('custom_role_prompt = ?');
  }
  if (config) {
    updateParams.push(config);
    placeholders.push('custom_config = ?');
  }
  updateParams.push(assignmentToolId);
  await pool.query(
    `UPDATE assignment_tools SET ${placeholders.join(', ')} WHERE id = ?`,
    updateParams,
  );
  const [rows] = await pool.query(
    `SELECT * FROM assignment_tools WHERE id = ?`,
    [assignmentToolId],
  );
  const result = rows as AssignmentTool[];
  return result.length > 0 ? result[0] : null;
};
