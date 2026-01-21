import { GptLog } from './../src/types/db/gpt';
import { TraceData } from './../src/types/db/trace-data';
import {
  Assignment,
  AssignmentGoalContent,
  AssignmentGrade,
  AssignmentStage,
  AssignmentSubmission,
  AssignmentTool,
} from './../src/types/db/assignment';
import mysql, { Pool } from 'mysql2/promise';
import dotenv from 'dotenv';

// NOTE: Deprecated type. Don't use this in other files
interface AssignmentEssayContent {
  title: string;
  outline: string;
  essay: string;
  goals: AssignmentGoalContent | null;
}

dotenv.config();

const pool: Pool = mysql.createPool({
  host: process.env.NEW_DB_HOST,
  user: process.env.NEW_DB_USER,
  password: process.env.NEW_DB_PASSWORD,
  database: process.env.NEW_DB_NAME,
  waitForConnections: true,
  connectionLimit: 1,
  queueLimit: 0,
  typeCast: function (field, next) {
    if (field.type == 'NEWDECIMAL') {
      const value = field.string();
      return value === null ? null : Number(value);
    }
    return next();
  },
});

async function migrateStage(connection: mysql.PoolConnection) {
  // 1. Create new chatbot_templates
  // TODO:

  const [assignmentRows] = await connection.query('SELECT * FROM assignments');
  const assignments = assignmentRows as Assignment[];

  for (const assignment of assignments) {
    const oldConfig: any = assignment.config || {};
    const outlineEnabled = oldConfig.outline_enabled;
    const revisingEnabled = oldConfig.revising_enabled;
    const revisionToolAskExplanation = oldConfig.revision_tool_ask_explanation;
    const reflectionQuestions = oldConfig.reflection_questions;

    const newConfig = { ...oldConfig };
    delete newConfig.outline_enabled;
    delete newConfig.revising_enabled;
    delete newConfig.revision_tool_ask_explanation;
    delete newConfig.reflection_questions;
    await connection.query('UPDATE assignments SET config = ? WHERE id = ?', [
      JSON.stringify(newConfig),
      assignment.id,
    ]);

    const [stageRows] = await connection.query(
      'SELECT * FROM assignment_stages WHERE assignment_id = ? ORDER BY order_index ASC',
      [assignment.id],
    );
    const stages = stageRows as AssignmentStage[];

    const writingStage = stages.find(stage => stage.stage_type === 'writing');
    if (!writingStage) {
      continue;
    }

    // 3. Create new stages, and update existing writing stage config, also move order_index
    const newStages: (AssignmentStage | null)[] = [];
    for (const stage of stages) {
      if (stage.stage_type === 'reflection') {
        const reflectionConfig = {
          reflection_questions: reflectionQuestions || [],
        };
        await connection.query(
          'UPDATE assignment_stages SET config = ? WHERE id = ?',
          [JSON.stringify(reflectionConfig), stage.id],
        );
      } else {
        await connection.query(
          'UPDATE assignment_stages SET config = ? WHERE id = ?',
          [JSON.stringify({}), stage.id],
        );
      }

      let isNewStagesAdded = false;
      if (stage.stage_type === 'writing') {
        const newStageTypes = [
          outlineEnabled ? 'outlining' : null,
          'drafting',
          revisingEnabled ? 'revising' : null,
        ];
        for (let i = 0; i < newStageTypes.length; i++) {
          const newStageType = newStageTypes[i];
          if (!newStageType) {
            newStages.push(null);
            continue;
          }
          const [newStageRows] = await connection.query(
            'INSERT INTO assignment_stages (assignment_id, stage_type, enabled, order_index, config) VALUES (?, ?, ?, ?, ?)',
            [
              stage.assignment_id,
              newStageType,
              stage.enabled,
              stage.order_index + i,
              JSON.stringify({}),
            ],
          );
          const newStageId = (newStageRows as mysql.ResultSetHeader).insertId;
          newStages.push({
            id: newStageId,
            assignment_id: stage.assignment_id,
            stage_type: newStageType,
            order_index: stage.order_index + i,
            enabled: stage.enabled,
            config:
              newStageType === 'revising'
                ? JSON.stringify({
                    revision_tool_ask_explanation: revisionToolAskExplanation,
                  })
                : JSON.stringify({}),
          });
        }
        isNewStagesAdded = true;
      } else if (isNewStagesAdded) {
        await connection.query(
          'UPDATE assignment_stages SET order_index = order_index + ? WHERE id = ?',
          [newStages.filter(stage => !!stage).length, stage.id],
        );
      }
    }

    // 4. Update assignment submissions
    const [submissionRows] = await connection.query(
      'SELECT * FROM assignment_submissions WHERE assignment_id = ?',
      [assignment.id],
    );
    const submissions = submissionRows as AssignmentSubmission[];
    for (const submission of submissions) {
      if (submission.stage_id !== writingStage.id) {
        continue;
      }
      const submissionContent = submission.content as AssignmentEssayContent;
      const newSubmissionIds = [];
      if ('outline' in submissionContent) {
        if (newStages[0] === null) {
          throw new Error(
            'Outline stage not created but outline content exists',
          );
        }
        const [insertRows] = await connection.query(
          'INSERT INTO assignment_submissions (assignment_id, stage_id, student_id, content, submitted_at, is_final) VALUES (?, ?, ?, ?, ?, ?)',
          [
            submission.assignment_id,
            newStages[0].id,
            submission.student_id,
            JSON.stringify({ outline: submissionContent.outline }),
            submission.submitted_at,
            submission.is_final ? 0 : null,
          ],
        );
        newSubmissionIds.push((insertRows as mysql.ResultSetHeader).insertId);
      } else {
        newSubmissionIds.push(null);
      }
      if ('essay' in submissionContent) {
        if (newStages[1] === null) {
          throw new Error(
            'Drafting stage not created but essay content exists',
          );
        }
        const [insertRows] = await connection.query(
          'INSERT INTO assignment_submissions (assignment_id, stage_id, student_id, content, submitted_at, is_final) VALUES (?, ?, ?, ?, ?, ?)',
          [
            submission.assignment_id,
            newStages[1].id,
            submission.student_id,
            JSON.stringify({
              essay: submissionContent.essay,
              title: submissionContent.title,
            }),
            submission.submitted_at,
            submission.is_final ? 0 : null,
          ],
        );
        newSubmissionIds.push((insertRows as mysql.ResultSetHeader).insertId);
        if (newStages[2] !== null && revisingEnabled) {
          const [insertRows] = await connection.query(
            'INSERT INTO assignment_submissions (assignment_id, stage_id, student_id, content, submitted_at, is_final) VALUES (?, ?, ?, ?, ?, ?)',
            [
              submission.assignment_id,
              newStages[2].id,
              submission.student_id,
              JSON.stringify({
                essay: submissionContent.essay,
                title: submissionContent.title,
              }),
              submission.submitted_at,
              submission.is_final ? 1 : null,
            ],
          );
          newSubmissionIds.push((insertRows as mysql.ResultSetHeader).insertId);
        } else {
          newSubmissionIds.push(null);
        }
      } else {
        newSubmissionIds.push(null, null);
      }

      // 5. Update assignment grading
      const [gradingRows] = await connection.query(
        'SELECT * FROM assignment_grades WHERE submission_id = ?',
        [submission.id],
      );
      const gradings = gradingRows as AssignmentGrade[];
      for (const grading of gradings) {
        const newSubmissionId = newSubmissionIds[2]
          ? newSubmissionIds[2]
          : newSubmissionIds[1];
        if (!newSubmissionId) {
          throw new Error('No new submission id found for grading update');
        }
        await connection.query(
          'UPDATE assignment_grades SET submission_id = ? WHERE id = ?',
          [newSubmissionId, grading.id],
        );
      }

      await connection.query(
        'DELETE FROM assignment_submissions WHERE id = ?',
        [submission.id],
      );
    }

    // 6. Delete writing trace data
    const [traceRows] = await connection.query(
      'SELECT * FROM trace_data WHERE assignment_id = ?',
      [assignment.id],
    );
    const traces = traceRows as TraceData[];
    for (const trace of traces) {
      if (writingStage.id !== trace.stage_id) {
        continue;
      }
      await connection.query('DELETE FROM trace_data WHERE id = ?', [trace.id]);
    }

    // 7. Delete writing tools
    const [toolRows] = await connection.query(
      'SELECT * FROM assignment_tools WHERE assignment_id = ?',
      [assignment.id],
    );
    const tools = toolRows as AssignmentTool[];
    for (const tool of tools) {
      if (tool.assignment_stage_id !== writingStage.id) {
        continue;
      }

      // 8. Delete gpt_logs
      const [gptLogRows] = await connection.query(
        'SELECT * FROM gpt_logs WHERE assignment_tool_id = ?',
        [tool.id],
      );
      for (const gptLog of gptLogRows as GptLog[]) {
        const [explanationRows] = await connection.query(
          'SELECT * FROM student_revision_explanations WHERE gpt_log_id = ?',
          [gptLog.id],
        );
        for (const explanation of explanationRows as any[]) {
          await connection.query(
            'DELETE FROM student_revision_explanations WHERE id = ?',
            [explanation.id],
          );
        }
        await connection.query('DELETE FROM gpt_logs WHERE id = ?', [
          gptLog.id,
        ]);
      }

      await connection.query('DELETE FROM assignment_tools WHERE id = ?', [
        tool.id,
      ]);
    }

    await connection.query('DELETE FROM assignment_stages WHERE id = ?', [
      writingStage.id,
    ]);
  }
}

async function main() {
  console.log('Migrating stages...');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await migrateStage(connection);
    await connection.commit();
    console.log('Migration completed successfully.');
  } catch (err) {
    await connection.rollback();
    console.error('Error during migration:', err);
    throw err;
  } finally {
    connection.release();
    await pool.end();
  }
}

main();
