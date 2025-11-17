import { Response } from 'express';
import { isNumber, isString } from 'lodash-es';
import { saveNewGrading } from 'models/assignmentGradingModel';
import {
  fetchAssignmentStagesWithToolsByAssignmentId,
  fetchTeacherGradingToolIdByAssignmentId,
} from 'models/assignmentStageModel';
import {
  fetchLatestSubmissionsByAssignmentIdTeacherId,
  fetchLatestSubmissionsByTeacherId,
  fetchLatestSubmissionsCountByAssignmentIdTeacherId,
  fetchLatestSubmissionsCountByTeacherId,
  fetchSubmissionsByAssignmentIdAndStudentId,
  saveNewAssignmentSubmission,
} from 'models/assignmentSubmissionModel';
import { saveNewTraceData } from 'models/traceDataModel';

import {
  AssignmentRecentSubmissionListingItemResponse,
  AssignmentSubmissionListingItem,
  AssignmentSubmissionListingItemResponse,
} from 'types/assignment';
import { AuthorizedRequest } from 'types/request';
import parseQueryNumber from 'utils/parseQueryNumber';

export const submitAssignment = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  const { assignment_id, stage_id, content, is_final, is_manual } =
    req.body.submission;

  if (isNaN(assignment_id)) {
    return res
      .status(400)
      .json({ error_message: 'Missing assignment ID', error_code: 400 });
  }

  if (isNaN(stage_id)) {
    return res
      .status(400)
      .json({ error_message: 'Missing stage ID', error_code: 400 });
  }

  if (!content) {
    return res
      .status(400)
      .json({ error_message: 'Missing content', error_code: 400 });
  }

  try {
    const submission = await saveNewAssignmentSubmission(
      assignment_id,
      stage_id,
      req.user.id,
      content,
      is_final || false,
    );

    saveNewTraceData(
      req.user.id,
      assignment_id,
      stage_id,
      is_manual ? 'SAVE' : 'AUTO_SAVE',
      content,
    );

    return res.status(200).json(submission);
  } catch (e: unknown) {
    if (e instanceof Error) {
      return res
        .status(400)
        .json({ error_message: e.message, error_code: 400 });
    }
    return res
      .status(500)
      .json({ error_message: 'Server error', error_code: 500 });
  }
};

const convertSubmissionToResponse = (
  listingItems: AssignmentSubmissionListingItem[],
): AssignmentSubmissionListingItemResponse[] => {
  return listingItems.reduce((arr, item) => {
    const studentItemIndex = arr.findIndex(
      i =>
        i.student.id === item.student_id &&
        i.assignment_id === item.assignment_id,
    );
    if (studentItemIndex === -1) {
      return [
        ...arr,
        {
          assignment_id: item.assignment_id,
          ...('title' in item ? { title: item.title } : {}),
          student: {
            id: item.student_id,
            username: item.username,
            first_name: item.first_name || undefined,
            last_name: item.last_name || undefined,
          },
          submissions: [
            {
              id: item.id,
              stage_id: item.stage_id,
              stage_type: item.stage_type,
              submitted_at: item.submitted_at,
              is_final: item.is_final,
              score: item.score,
            },
          ],
        },
      ];
    }
    arr.splice(studentItemIndex, 1, {
      ...arr[studentItemIndex],
      submissions: [
        ...arr[studentItemIndex].submissions,
        {
          id: item.id,
          stage_id: item.stage_id,
          stage_type: item.stage_type,
          submitted_at: item.submitted_at,
          is_final: item.is_final,
          score: item.score,
        },
      ],
    });
    return arr;
  }, [] as AssignmentSubmissionListingItemResponse[]);
};

export const getAssignmentSubmissionListing = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  const assignmentId = parseQueryNumber(req.query.assignment_id);
  if (!isNumber(assignmentId)) {
    return res
      .status(400)
      .json({ error_message: 'Missing assignment ID', error_code: 400 });
  }

  const parsedLimit = parseQueryNumber(req.query.limit);
  const parsedPage = parseQueryNumber(req.query.page);

  const limit = parsedLimit !== undefined ? parsedLimit : 10;
  const page = parsedPage !== undefined ? parsedPage : 1;

  const filter = (req.query.filter || '') as string;

  if (isNaN(limit) || isNaN(page) || limit <= 0 || page <= 0) {
    return res.status(400).json({
      error_message: 'Invalid pagination parameters',
      error_code: 400,
    });
  }

  if (!isString(filter)) {
    return res
      .status(400)
      .json({ error_message: 'Invalid filter', error_code: 400 });
  }

  const resObj = {
    page,
    limit,
    value: [] as AssignmentSubmissionListingItemResponse[],
  };

  const listingItems = await fetchLatestSubmissionsByAssignmentIdTeacherId(
    assignmentId,
    req.user.id,
    limit,
    page,
    filter,
  );
  resObj.value = convertSubmissionToResponse(listingItems);

  if (parseQueryNumber(req.query.skipCount)) {
    return res.json(resObj);
  }

  const count = await fetchLatestSubmissionsCountByAssignmentIdTeacherId(
    assignmentId,
    req.user.id,
    filter,
  );
  return res.json({ ...resObj, count });
};

export const getRecentSubmissions = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  const parsedLimit = parseQueryNumber(req.query.limit);
  const parsedPage = parseQueryNumber(req.query.page);

  const limit = parsedLimit !== undefined ? parsedLimit : 10;
  const page = parsedPage !== undefined ? parsedPage : 1;

  const filter = (req.query.filter || '') as string;

  if (isNaN(limit) || isNaN(page) || limit <= 0 || page <= 0) {
    return res.status(400).json({
      error_message: 'Invalid pagination parameters',
      error_code: 400,
    });
  }

  if (!isString(filter)) {
    return res
      .status(400)
      .json({ error_message: 'Invalid filter', error_code: 400 });
  }

  const resObj = {
    page,
    limit,
    value: [] as AssignmentRecentSubmissionListingItemResponse[],
  };

  const listingItems = await fetchLatestSubmissionsByTeacherId(
    req.user.id,
    limit,
    page,
    filter,
  );
  resObj.value = convertSubmissionToResponse(
    listingItems,
  ) as AssignmentRecentSubmissionListingItemResponse[];

  if (parseQueryNumber(req.query.skipCount)) {
    return res.json(resObj);
  }

  const count = await fetchLatestSubmissionsCountByTeacherId(
    req.user.id,
    filter,
  );
  return res.json({ ...resObj, count });
};

export const getSubmissionDetails = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  const assignmentId = parseQueryNumber(req.query.assignment_id);
  const studentId = parseQueryNumber(req.query.student_id);
  if (!isNumber(assignmentId) || !isNumber(studentId)) {
    return res.status(400).json({
      error_message: 'Assignment ID and student ID is required',
      error_code: 400,
    });
  }

  // 1. Get submission and assignment details with grade
  const submissions = await fetchSubmissionsByAssignmentIdAndStudentId(
    assignmentId,
    studentId,
  );
  const stages =
    await fetchAssignmentStagesWithToolsByAssignmentId(assignmentId);
  const teacherGradingToolId =
    await fetchTeacherGradingToolIdByAssignmentId(assignmentId);

  if (!submissions.length) {
    return res.status(404).json({ error_message: 'No submission found' });
  }

  // 2. Calculate plagiarism score

  // 3. Get engagement details (a. last essay edit, b. last chatbot use, c. last dashboard view, d. plagiarism score)
  // 4. Get last reminders sent

  // 5. Analytics: Tools usage, ChatGPT prompt categories

  return res.json({
    assignment: {
      id: submissions[0].assignment_id,
      title: submissions[0].title,
      description: submissions[0].description,
      start_date: submissions[0].start_date,
      due_date: submissions[0].due_date,
      type: submissions[0].type,
      rubrics: submissions[0].rubrics,
    },
    stages,
    student: {
      id: submissions[0].student_id,
      username: submissions[0].username,
      first_name: submissions[0].first_name,
      last_name: submissions[0].last_name,
    },
    teacher_grading_tool_id: teacherGradingToolId,
    submissions: submissions.map(submission => ({
      id: submission.id,
      stage_id: submission.stage_id,
      stage_type: submission.stage_type,
      content: submission.content,
      submitted_at: submission.submitted_at,
      is_final: submission.is_final,
      grade: isNumber(submission.overall_score)
        ? {
            overall_score: submission.overall_score,
            overall_feedback: submission.overall_feedback,
            rubrics_breakdown: submission.rubrics_breakdown,
            graded_at: submission.graded_at,
          }
        : null,
    })),
  });
};

export const gradeAssignment = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  const submissionId = parseQueryNumber(req.body.submission_id);
  const overallScore = parseQueryNumber(req.body.overall_score);
  const overallFeedback = req.body.overall_feedback;
  const rubricsBreakdown = req.body.rubrics_breakdown;

  if (!isNumber(submissionId)) {
    return res
      .status(400)
      .json({ error_message: 'Invalid submission ID', error_code: 400 });
  }
  if (!isNumber(overallScore)) {
    return res
      .status(400)
      .json({ error_message: 'Invalid score', error_code: 400 });
  }

  const result = await saveNewGrading(
    submissionId,
    overallScore,
    overallFeedback,
    rubricsBreakdown,
    Date.now(),
    req.user.id,
  );
  return res.json(result);
};
