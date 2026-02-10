import pool from 'config/db';
import { AssignmentStageWithTools } from 'types/assignment';
import { AssignmentStage, AssignmentTool } from 'types/db/assignment';

export const fetchAssignmentStagesWithToolsByAssignmentId = async (
  assignmentId: number,
): Promise<AssignmentStageWithTools[]> => {
  const [stageRows] = await pool.query(
    `
    SELECT id, assignment_id, stage_type, enabled, order_index, config
    FROM assignment_stages
    WHERE assignment_id = ?
    ORDER BY order_index
    `,
    [assignmentId],
  );
  const stages = stageRows as AssignmentStage[];

  if (!stages.length) {
    return [];
  }

  const stageIdPlaceholders = stages.map(() => '?').join(',');
  const [toolRows] = await pool.query(
    `
    SELECT * FROM assignment_tools
    WHERE assignment_id = ? AND assignment_stage_id IN (${stageIdPlaceholders})
    `,
    [assignmentId, ...stages.map(stage => stage.id)],
  );
  const tools = toolRows as AssignmentTool[];

  return stages.map(stage => ({
    ...stage,
    tools: tools
      .filter(tool => tool.assignment_stage_id === stage.id)
      .map(tool => ({
        id: tool.id,
        key: tool.tool_key,
        enabled: tool.enabled,
      })),
  })) as AssignmentStageWithTools[];
};

export const fetchTeacherGradingToolIdByAssignmentId = async (
  assignmentId: number,
): Promise<number | null> => {
  const [rows] = await pool.query(
    `
    SELECT id FROM assignment_tools
    WHERE assignment_id = ? AND tool_key = 'teacher_grading'
    `,
    [assignmentId],
  );
  const result = rows as { id: number }[];
  return result.length > 0 ? result[0].id : null;
};

export const fetchAssignmentStageById = async (
  stageId: number,
): Promise<AssignmentStage | null> => {
  const [rows] = await pool.query(
    `
    SELECT * FROM assignment_stages
    WHERE id = ?
    `,
    [stageId],
  );
  const result = rows as AssignmentStage[];
  return result.length > 0 ? result[0] : null;
};
