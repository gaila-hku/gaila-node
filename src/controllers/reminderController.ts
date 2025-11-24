import { Response } from 'express';
import {
  fetchReminderCountByStudentId,
  fetchRemindersByStudentId,
  saveNewReminder,
} from 'models/reminderModel';

import { AuthorizedRequest } from 'types/request';
import parseListingQuery from 'utils/parseListingQuery';

export const getReminderListing = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  try {
    const { limit, page } = parseListingQuery(req);

    try {
      const reminders = await fetchRemindersByStudentId(
        req.user.id,
        limit,
        page,
      );
      const resObj = {
        page,
        limit,
        value: reminders,
      };

      if (req.query.skipCount) {
        return res.json(resObj);
      }

      const count = await fetchReminderCountByStudentId(
        req.user.id,
        limit,
        page,
      );
      return res.json({ ...resObj, count });
    } catch (e) {
      return res.status(500).json({
        error_message: 'Server error: ' + (e as Error).message,
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

export const sendReminder = async (req: AuthorizedRequest, res: Response) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  const {
    assignment_id: assignmentId,
    student_id: studentId,
    reminder_type: reminderType,
  } = req.body;

  if (isNaN(assignmentId) || isNaN(studentId)) {
    return res.status(400).json({
      error_message: 'Invalid assignment ID or student ID',
      error_code: 400,
    });
  }

  if (['writing', 'ai', 'dashboard', 'copying'].indexOf(reminderType) === -1) {
    return res.status(400).json({
      error_message: 'Invalid reminder type',
      error_code: 400,
    });
  }

  const result = await saveNewReminder(
    assignmentId,
    studentId,
    req.user.id,
    reminderType,
  );
  return res.json(result);
};
