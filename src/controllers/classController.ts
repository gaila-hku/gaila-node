import { Response } from 'express';
import {
  createNewClass,
  fetchClassById,
  fetchClassByKey,
  fetchClassesCount,
  fetchClassesCountByStudentId,
  fetchClassesCountByTeacherId,
  fetchClassListing,
  fetchClassListingByStudentId,
  fetchClassListingByTeacherId,
  updateExistingClass,
} from 'models/classModel';

import { Class } from 'types/db/class';
import { AuthenticatedRequest } from 'types/request';
import parseListingQuery from 'utils/parseListingQuery';
import parseQueryNumber from 'utils/parseQueryNumber';

export const getUserClasses = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { limit, page } = parseListingQuery(req);
    try {
      const resObj = { page, limit, value: [] as Class[] };

      if (req.user?.role === 'student') {
        resObj.value = await fetchClassListingByStudentId(
          req.user.id,
          limit,
          page,
        );
      } else if (
        req.user?.role === 'teacher' ||
        req.user?.role === 'teaching_assistant' ||
        req.user?.role === 'admin'
      ) {
        resObj.value = await fetchClassListingByTeacherId(
          req.user.id,
          limit,
          page,
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
        count = await fetchClassesCountByStudentId(req.user.id);
      } else if (
        req.user?.role === 'teacher' ||
        req.user?.role === 'teaching_assistant' ||
        req.user?.role === 'admin'
      ) {
        count = await fetchClassesCountByTeacherId(req.user.id);
      }
      return res.json({ ...resObj, count });
    } catch (err) {
      return res.status(500).json({
        error_message: 'Server error: ' + JSON.stringify(err),
        error_code: 500,
      });
    }
  } catch (e) {
    return res.status(400).json({
      error_message: 'Invalid query parameters: ' + (e as Error).message,
      error_code: 400,
    });
  }
};

export const getClassDetails = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const classId = Number(req.query.id);
  if (isNaN(classId)) {
    return res
      .status(400)
      .json({ error_message: 'Invalid class ID', error_code: 400 });
  }

  try {
    const classDetails = await fetchClassById(classId);
    if (!classDetails) {
      return res
        .status(404)
        .json({ error_message: 'Class not found', error_code: 404 });
    }
    return res.json(classDetails);
  } catch (err) {
    return res.status(500).json({
      error_message: 'Server error: ' + JSON.stringify(err),
      error_code: 500,
    });
  }
};

export const getAllClasses = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }
  try {
    const { limit, page, filter } = parseListingQuery(req);
    const resObj = { page, limit, value: [] as Class[] };
    resObj.value = await fetchClassListing(limit, page, filter);
    if (parseQueryNumber(req.query.skipCount)) {
      return res.json(resObj);
    }
    const count = await fetchClassesCount(filter);
    return res.json({ ...resObj, count });
  } catch (err) {
    return res.status(500).json({
      error_message: 'Server error: ' + JSON.stringify(err),
      error_code: 500,
    });
  }
};

export const createClass = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }
  const classKey = req.body.class_key;
  if (!req.body.name || !classKey) {
    return res
      .status(400)
      .json({ error_message: 'Missing name or class key', error_code: 400 });
  }
  const conflictClass = await fetchClassByKey(classKey);
  if (conflictClass && conflictClass.id !== req.body.id) {
    return res
      .status(404)
      .json({ error_message: 'Class key already exists', error_code: 404 });
  }
  try {
    const createdClass = await createNewClass(
      req.body.name,
      classKey,
      req.body.description,
    );
    return res.json(createdClass);
  } catch (err) {
    return res.status(500).json({
      error_message: 'Server error: ' + JSON.stringify(err),
      error_code: 500,
    });
  }
};

export const updateClass = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  const classId = Number(req.body.id);
  if (isNaN(classId)) {
    return res
      .status(400)
      .json({ error_message: 'Invalid class ID', error_code: 400 });
  }

  const classKey = req.body.class_key;
  if (!classKey) {
    return res
      .status(400)
      .json({ error_message: 'Missing class key', error_code: 400 });
  }

  const conflictClass = await fetchClassByKey(classKey);
  if (conflictClass && conflictClass.id !== req.body.id) {
    return res
      .status(404)
      .json({ error_message: 'Class key already exists', error_code: 404 });
  }

  try {
    const updatedClass = await updateExistingClass(
      classId,
      req.body.name,
      req.body.class_key,
      req.body.description,
      req.body.teachers,
      req.body.students,
    );
    return res.json(updatedClass);
  } catch (err) {
    return res.status(500).json({
      error_message: 'Server error: ' + JSON.stringify(err),
      error_code: 500,
    });
  }
};
