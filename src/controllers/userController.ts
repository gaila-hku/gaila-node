import { Response } from 'express';
import { isString } from 'lodash-es';
import {
  addStudentToClass,
  addTeacherToClass,
  fetchClassOptionsByTeacherId,
} from 'models/classModel';
import {
  createNewUser,
  deleteExistingUser,
  fetchStudentOptionsInClass,
  fetchUserByUsername,
  fetchUserCount,
  fetchUsers,
  updateExistingUser,
} from 'models/userModel';

import { User } from 'types/db/user';
import { AuthorizedRequest } from 'types/request';
import { UserListingItem } from 'types/user';
import parseCSVFile from 'utils/parseCSVFile';
import parseListingQuery from 'utils/parseListingQuery';
import parseQueryNumber from 'utils/parseQueryNumber';

export const getClassOptions = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  return res.json(await fetchClassOptionsByTeacherId(req.user.id));
};

export const getStudentOptions = async (
  req: AuthorizedRequest,
  res: Response,
) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }
  if (!req.query.classId) {
    return res
      .status(400)
      .json({ error_message: 'Class ID is required', error_code: 400 });
  }

  const classId = parseQueryNumber(req.query.classId);
  if (!classId || isNaN(classId)) {
    return res
      .status(400)
      .json({ error_message: 'Invalid class ID', error_code: 400 });
  }

  return res.json(await fetchStudentOptionsInClass(classId));
};

export const getUserListing = async (req: AuthorizedRequest, res: Response) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  const { limit, page, sort, sortOrder } = parseListingQuery(req);

  const filter = (req.query.filter || '') as string;

  if (!isString(filter)) {
    throw new Error('Invalid filter');
  }

  if (!!sort && !isString(sort)) {
    throw new Error('Invalid sort parameter');
  }

  if (!!sortOrder && sortOrder !== 'asc' && sortOrder !== 'desc') {
    throw new Error('Invalid sort order');
  }

  try {
    const resObj = { page, limit, value: [] as UserListingItem[] };

    resObj.value = await fetchUsers(
      limit,
      page,
      filter,
      sort,
      sortOrder as 'asc' | 'desc',
    );

    if (parseQueryNumber(req.query.skipCount)) {
      return res.json(resObj);
    }

    const count = await fetchUserCount(filter);
    return res.json({ ...resObj, count });
  } catch (err) {
    return res.status(500).json({
      error_message: 'Server error: ' + JSON.stringify(err),
      error_code: 500,
    });
  }
};

export const modifyUser = async (req: AuthorizedRequest, res: Response) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }

  const userId = parseQueryNumber(req.body.id);
  if (!userId || isNaN(userId)) {
    return res
      .status(400)
      .json({ error_message: 'Invalid user ID', error_code: 400 });
  }

  const result = updateExistingUser(
    userId,
    req.body.username,
    req.body.password,
    req.body.role,
    req.body.first_name,
    req.body.last_name,
    req.body.lang,
  );
  return res.json(result);
};

export const createUser = async (req: AuthorizedRequest, res: Response) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res
      .status(400)
      .json({ error_message: 'Missing username, password or role' });
  }

  const existingUser = await fetchUserByUsername(username);
  if (existingUser) {
    return res.status(409).json({ error_message: 'Username already exists' });
  }

  try {
    await createNewUser(
      username,
      password,
      role,
      req.body.first_name,
      req.body.last_name,
      req.body.lang,
    );
    return res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    return res
      .status(500)
      .json({ error_message: 'Failed to create user' + error });
  }
};

export const deleteUser = async (req: AuthorizedRequest, res: Response) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }
  const userId = parseQueryNumber(req.body.id);
  if (!userId || isNaN(userId)) {
    return res
      .status(400)
      .json({ error_message: 'Invalid user ID', error_code: 400 });
  }
  await deleteExistingUser(userId);
  return res.status(200).json({ message: 'User deleted successfully' });
};

export const uploadUser = async (req: AuthorizedRequest, res: Response) => {
  if (!req.user?.id) {
    return res
      .status(401)
      .json({ error_message: 'User not authenticated', error_code: 401 });
  }
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  try {
    const results = [];
    const filePath = req.file.path;
    const csvRows = await parseCSVFile(filePath);

    for (const row of csvRows) {
      const missingFields = [];
      if (!row.username) missingFields.push('username');
      if (!row.password) missingFields.push('password');
      if (!row.role) missingFields.push('role');
      if (missingFields.length > 0) {
        results.push({
          data: row,
          error: true,
          message: 'Missing fields: ' + missingFields.join(', '),
        });
        continue;
      }

      let newUser: User | null = null;
      const existingUser = await fetchUserByUsername(row.username);
      if (existingUser) {
        try {
          newUser = await updateExistingUser(
            existingUser.id,
            row.username,
            row.password,
            row.role,
            row.first_name,
            row.last_name,
            row.lang,
          );
        } catch (e) {
          results.push({
            data: row,
            error: true,
            message: 'Failed to update user: ' + e,
          });
          continue;
        }
      } else {
        try {
          newUser = await createNewUser(
            row.username,
            row.password,
            row.role,
            row.first_name,
            row.last_name,
            row.lang,
          );
        } catch (e) {
          results.push({
            data: row,
            error: true,
            message: 'Failed to create user: ' + e,
          });
          continue;
        }
      }

      if (!newUser) {
        results.push({
          data: row,
          error: true,
          message: 'Unknown error. Please try again or contact support.',
        });
        continue;
      }
      const newUserResult = {
        ...newUser,
        password: row.password,
        class: row.class,
      };
      if (!row.class) {
        results.push({
          data: newUserResult,
          error: false,
          message: 'User created successfully',
        });
        continue;
      }

      try {
        if (row.role === 'student') {
          await addStudentToClass(newUser.id, row.class);
        } else {
          await addTeacherToClass(newUser.id, row.class);
        }
        results.push({
          data: newUserResult,
          error: false,
          message: 'User added to class successfully',
        });
      } catch (e) {
        results.push({
          data: newUserResult,
          error: true,
          message: 'Failed to add user to class: ' + e,
        });
      }
    }

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({
      error_message: 'Server error: ' + JSON.stringify(err),
      error_code: 500,
    });
  }
};
