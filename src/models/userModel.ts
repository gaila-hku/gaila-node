import bcrypt from 'bcryptjs';
import { ResultSetHeader } from 'mysql2';

import pool from 'config/db';
import { ClassUser, User, UserListingItem, UserOption } from 'types/user';

export const fetchUserByUsername = async (
  username: string,
): Promise<User | null> => {
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [
    username,
  ]);
  const result = rows as User[];
  return result.length > 0 ? result[0] : null;
};

export const fetchUserById = async (id: number): Promise<User | null> => {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
  const result = rows as User[];
  return result.length > 0 ? result[0] : null;
};

export const fetchUsersByIds = async (ids: number[]): Promise<User[]> => {
  const [rows] = await pool.query(`SELECT * FROM users WHERE id IN (?)`, [ids]);
  return rows as User[];
};

export const fetchStudentsInTeachingClasses = async (
  teacherId: number,
): Promise<ClassUser[]> => {
  const [rows] = await pool.query(
    `SELECT users.*, classes.id as class_id, classes.name as class_name FROM classes
      JOIN class_students ON classes.id = class_students.class_id
      JOIN users ON class_students.student_id = users.id
      WHERE class_id IN (
        SELECT class_id FROM class_teachers WHERE teacher_id = ?
      )`,
    [teacherId],
  );

  return rows as ClassUser[];
};

export const fetchStudentOptionsInClass = async (
  classId: number,
): Promise<UserOption[]> => {
  const [rows] = await pool.query(
    `SELECT users.id as id, users.first_name as first_name, users.last_name as last_name, users.username as username 
      FROM class_students
      JOIN users ON class_students.student_id = users.id
      WHERE class_id = ?`,
    [classId],
  );

  return rows as UserOption[];
};

export const fetchUsers = async (
  limit: number,
  page: number,
  filter: string,
  sort: string | undefined,
  sortOrder: 'asc' | 'desc' | undefined,
): Promise<UserListingItem[]> => {
  const [rows] = await pool.query(`
    SELECT id, username, role, last_login, time_created, time_modified, first_name, last_name, lang
    FROM users
    WHERE (username LIKE '%${filter}%' OR first_name LIKE '%${filter}%' OR last_name LIKE '%${filter}%') AND (deleted IS NULL or deleted = 0)
    ${sort ? `ORDER BY ${sort} ${sortOrder || 'asc'}` : ''}
    LIMIT ${limit} OFFSET ${limit * (page - 1)}
    `);
  return rows as User[];
};

export const fetchUserCount = async (filter: string): Promise<number> => {
  const [rows] = await pool.query(`
    SELECT COUNT(*)
    FROM users
    WHERE (username LIKE '%${filter}%' OR first_name LIKE '%${filter}%' OR last_name LIKE '%${filter}%') AND (deleted IS NULL or deleted = 0)
    `);
  const results = rows as { 'COUNT(*)': number }[];
  return results.length > 0 ? results[0]['COUNT(*)'] : 0;
};

export const updateExistingUser = async (
  id: number,
  username: string,
  password: string,
  role: string,
  first_name: string,
  last_name: string,
  lang: string,
): Promise<User | null> => {
  const updateParams = [];
  const placeholders = [];
  if (username) {
    updateParams.push(username);
    placeholders.push('username = ?');
  }
  if (password) {
    const hashedPassword = bcrypt.hashSync(password, 10);
    updateParams.push(hashedPassword);
    placeholders.push('password = ?');
  }
  if (role) {
    updateParams.push(role);
    placeholders.push('role = ?');
  }
  if (first_name) {
    updateParams.push(first_name);
    placeholders.push('first_name = ?');
  }
  if (last_name) {
    updateParams.push(last_name);
    placeholders.push('last_name = ?');
  }
  if (lang) {
    updateParams.push(lang);
    placeholders.push('lang = ?');
  }
  updateParams.push(Date.now());
  placeholders.push('time_modified = ?');

  await pool.query(`UPDATE users SET ${placeholders.join(', ')} WHERE id = ?`, [
    ...updateParams,
    id,
  ]);

  const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
  const result = userRows as User[];
  return result.length > 0 ? result[0] : null;
};

export const createNewUser = async (
  username: string,
  password: string,
  role: User['role'],
  first_name?: string,
  last_name?: string,
  lang?: string,
): Promise<User> => {
  const hashedPassword = bcrypt.hashSync(password, 10);
  const createParams = [username, hashedPassword, role, Date.now()];
  const placeholders = ['username', 'password', 'role', 'time_created'];
  if (first_name) {
    createParams.push(first_name);
    placeholders.push('first_name');
  }
  if (last_name) {
    createParams.push(last_name);
    placeholders.push('last_name');
  }
  if (lang) {
    createParams.push(lang);
    placeholders.push('lang');
  }
  const [rows] = await pool.query(
    `INSERT INTO users (${placeholders.join(', ')}) VALUES (${placeholders.map(() => '?').join(', ')})`,
    createParams,
  );
  const insertId = (rows as ResultSetHeader).insertId;
  return {
    id: insertId,
    username,
    password,
    role,
    first_name,
    last_name,
    lang,
  };
};

export const deleteExistingUser = async (id: number): Promise<void> => {
  await pool.query('UPDATE users SET deleted = 1 WHERE id = ?', [id]);
};

export const updateUserLoginTime = async (id: number): Promise<void> => {
  await pool.query('UPDATE users SET last_login = ? WHERE id = ?', [
    Date.now(),
    id,
  ]);
};
