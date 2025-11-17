import { Response } from 'express';
import { isArray, isObject, isString } from 'lodash-es';
import { fetchLatestGradesBySubmissionIds } from 'models/assignmentGradingModel';
import {
  fetchAssignementEnrollmentsById,
  fetchAssignmentById,
  fetchAssignmentsByStudentId,
  fetchAssignmentsByTeacherId,
  fetchAssignmentsCountByStudentId,
  fetchAssignmentsCountByTeacherId,
  saveNewAssignment,
  updateExistingAssignment,
} from 'models/assignmentModel';
import { fetchAssignmentStagesWithToolsByAssignmentId } from 'models/assignmentStageModel';
import { fetchLatestSubmissionsByAssignmentIdStudentId } from 'models/assignmentSubmissionModel';
import { fetchClassesByIds } from 'models/classModel';
import { fetchUsersByIds } from 'models/userModel';

import { Assignment, AssignmentView } from 'types/assignment';
import { Class, ClassOption } from 'types/class';
import { AuthorizedRequest } from 'types/request';
import { User, UserOption } from 'types/user';

const parseQueryNumber = (v: any): number | undefined => {
  if (typeof v === 'string') return parseInt(v, 10);
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string')
    return parseInt(v[0], 10);
  return undefined;
};

export const getAssignmentListing = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  const parsedLimit = parseQueryNumber(req.query.limit);
  const parsedPage = parseQueryNumber(req.query.page);

  const limit = parsedLimit !== undefined ? parsedLimit : 10;
  const page = parsedPage !== undefined ? parsedPage : 1;

  const filter = req.query.filter ? JSON.parse(req.query.filter as string) : {};
  const sort = req.query.sort;
  const sortOrder = req.query.sort_order;

  if (isNaN(limit) || isNaN(page) || limit <= 0 || page <= 0) {
    return res.status(400).json({
      error_message: 'Invalid pagination parameters',
      error_code: 400,
    });
  }

  if (!!sort && !isString(sort)) {
    return res.status(400).json({
      error_message: 'Invalid sort value',
      error_code: 400,
    });
  }

  if (!!sortOrder && sortOrder !== 'asc' && sortOrder !== 'desc') {
    return res.status(400).json({
      error_message: 'Invalid sort order',
      error_code: 400,
    });
  }

  const resObj = { page, limit, value: [] as Assignment[] };

  if (req.user?.role === 'student') {
    resObj.value = await fetchAssignmentsByStudentId(
      req.user.id,
      limit,
      page,
      filter,
      sort,
      sortOrder as 'asc' | 'desc',
    );
  } else if (req.user?.role === 'teacher' || req.user?.role === 'admin') {
    resObj.value = await fetchAssignmentsByTeacherId(
      req.user.id,
      limit,
      page,
      filter,
      sort,
      sortOrder as 'asc' | 'desc',
    );
  } else {
    return res.status(403).json({
      error_message: 'Access forbidden: insufficient rights',
      error_code: 403,
    });
  }
  if (parseQueryNumber(req.query.skipCount)) {
    return res.json(resObj);
  }

  let count = 0;
  if (req.user?.role === 'student') {
    count = await fetchAssignmentsCountByStudentId(req.user.id, filter);
  } else if (req.user?.role === 'teacher' || req.user?.role === 'admin') {
    count = await fetchAssignmentsCountByTeacherId(req.user.id, filter);
  }
  return res.json({ ...resObj, count });
};

export const getAssignmentDetails = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  const assignmentId = Number(req.query.id);
  if (isNaN(assignmentId)) {
    return res
      .status(400)
      .json({ error_message: 'Missing assignment ID', error_code: 400 });
  }

  try {
    const assignmentDetails = await fetchAssignmentById(assignmentId);
    if (!assignmentDetails) {
      return res.status(404).json({ error_message: 'Assignment not found' });
    }

    const enrollments = await fetchAssignementEnrollmentsById(assignmentId);
    if (!enrollments) {
      return res.status(500).json({
        error_message: 'Assignment enrollments not found',
        error_code: 500,
      });
    }
    const classes: ClassOption[] = [];
    const students: UserOption[] = [];
    enrollments.forEach(s => {
      if ('class_id' in s && s.class_id !== null) {
        classes.push({
          id: s.class_id,
          name: s.class_name,
          num_students: s.num_students,
        });
      } else if ('student_id' in s) {
        students.push({
          id: s.student_id,
          username: s.username,
          first_name: s.first_name,
          last_name: s.last_name,
        });
      }
    });

    const stages =
      await fetchAssignmentStagesWithToolsByAssignmentId(assignmentId);

    return res.json({
      ...assignmentDetails,
      enrolled_classes: classes,
      enrolled_students: students,
      stages,
    });
  } catch (err) {
    return res.status(500).json({
      error_message: 'Server error: ' + JSON.stringify(err),
      error_code: 500,
    });
  }
};

const assignmentValidation = async (
  assignment: any,
): Promise<[Class[], User[]]> => {
  const {
    title,
    description,
    due_date: dueDate,
    enrolled_class_ids: enrolledClassIds,
    enrolled_student_ids: enrolledStudentIds,
    stages,
  } = assignment;

  if (
    !Array.isArray(enrolledClassIds) ||
    !enrolledClassIds.every(Number.isInteger) ||
    !Array.isArray(enrolledStudentIds) ||
    !enrolledStudentIds.every(Number.isInteger) ||
    (!enrolledClassIds.length && !enrolledStudentIds.length)
  ) {
    throw new Error('Invalid class or student IDs');
  }

  const missingFields = [];
  if (!title) missingFields.push('Title');
  if (!description) missingFields.push('Description');
  if (!dueDate) missingFields.push('Due Date');
  if (missingFields.length) {
    throw new Error(
      `Missing required field${missingFields.length > 1 ? 's' : ''}: ${missingFields.join(', ')}`,
    );
  }

  if (!isArray(stages) || stages.length === 0) {
    throw new Error('Missing stages');
  }
  if (
    !stages.every(
      (stage: unknown) =>
        isObject(stage) &&
        'stage_type' in stage &&
        'enabled' in stage &&
        'tools' in stage &&
        isString(stage.stage_type) &&
        isArray(stage.tools),
    )
  ) {
    throw new Error('Invalid stage data');
  }

  const classes = enrolledClassIds.length
    ? await fetchClassesByIds(enrolledClassIds)
    : [];
  if (classes.length !== enrolledClassIds.length) {
    throw new Error('Invalid class IDs');
  }
  const students = enrolledStudentIds.length
    ? await fetchUsersByIds(enrolledStudentIds)
    : [];
  if (
    students.length !== enrolledStudentIds.length ||
    students.some(s => s.role !== 'student')
  ) {
    throw new Error('Invalid student IDs');
  }

  return [classes, students];
};

export const createAssignment = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  if (!req.body.assignment) {
    return res
      .status(400)
      .json({ error_message: 'Assignment details required', error_code: 400 });
  }

  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  const {
    title,
    description,
    type,
    instructions,
    requirements,
    due_date: dueDate,
    rubrics,
    tips,
    stages,
    enrolled_class_ids: enrolledClassIds,
    enrolled_student_ids: enrolledStudentIds,
  } = req.body.assignment;

  try {
    const [classes, students] = await assignmentValidation(req.body.assignment);

    const result = await saveNewAssignment(
      title,
      description,
      dueDate,
      type,
      instructions,
      JSON.stringify(requirements),
      JSON.stringify(rubrics),
      JSON.stringify(tips),
      stages,
      req.user.id,
      enrolledClassIds,
      enrolledStudentIds,
    );

    if (!result) {
      return res
        .status(500)
        .json({ error_message: 'Server error', error_code: 500 });
    }

    const resObj: AssignmentView = {
      ...result,
      enrolled_classes: classes,
      enrolled_students: students,
    };

    return res.status(201).json(resObj);
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

export const updateAssignment = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  if (!req.body.assignment) {
    return res
      .status(400)
      .json({ error_message: 'Assignment details required', error_code: 400 });
  }

  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  const {
    id,
    title,
    description,
    type,
    instructions,
    requirements,
    due_date: dueDate,
    rubrics,
    tips,
    stages,
    enrolled_class_ids: enrolledClassIds,
    enrolled_student_ids: enrolledStudentIds,
  } = req.body.assignment;

  if (!id) {
    return res
      .status(400)
      .json({ error_message: 'Missing assignment ID', error_code: 400 });
  }

  try {
    const [classes, students] = await assignmentValidation(req.body.assignment);

    const result = await updateExistingAssignment(
      id,
      title,
      description,
      dueDate,
      type,
      instructions,
      JSON.stringify(requirements),
      JSON.stringify(rubrics),
      JSON.stringify(tips),
      stages,
      enrolledClassIds,
      enrolledStudentIds,
    );

    if (!result) {
      return res
        .status(500)
        .json({ error_message: 'Server error', error_code: 500 });
    }

    const resObj: AssignmentView = {
      ...result,
      enrolled_classes: classes,
      enrolled_students: students,
    };

    return res.status(200).json(resObj);
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

export const getAssignmentProgressDetails = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  const assignmentId = Number(req.query.id);
  if (isNaN(assignmentId)) {
    return res
      .status(400)
      .json({ error_message: 'Missing assignment ID', error_code: 400 });
  }

  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  const assignmentDetails = await fetchAssignmentById(assignmentId);
  if (!assignmentDetails) {
    return res.status(404).json({ error_message: 'Assignment not found' });
  }

  const submissions = await fetchLatestSubmissionsByAssignmentIdStudentId(
    assignmentId,
    req.user.id,
  );
  const grades = await fetchLatestGradesBySubmissionIds(
    submissions.map(s => s.id),
  );

  const stages =
    await fetchAssignmentStagesWithToolsByAssignmentId(assignmentId);

  const isFinished = stages.every(
    stage =>
      !stage.enabled ||
      !!submissions.find(s => s.stage_id === stage.id && s.is_final),
  );
  const currentStage = isFinished
    ? stages.findIndex(s => s.enabled && s.stage_type === 'writing')
    : stages.findIndex(
        s =>
          s.enabled &&
          !submissions.find(
            submission => submission.stage_id === s.id && submission.is_final,
          ),
      );

  const resStages = stages.map(stage => {
    const submission = submissions.find(
      submission => submission.stage_id === stage.id,
    );
    return {
      ...stage,
      submission: submission || null,
      grade: submission
        ? grades.find(grade => grade.submission_id === submission.id)
        : null,
    };
  });

  return res.json({
    assignment: assignmentDetails,
    stages: resStages,
    current_stage: currentStage,
    is_finished: isFinished,
  });
};
