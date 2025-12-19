import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { fetchUserById } from 'models/userModel';

import { User } from 'types/db/user';
import { AuthenticatedRequest, UserPayload } from 'types/request';

export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers['authorization'];
  const token = authHeader ? authHeader.split(' ')[1] : null;
  const tokenSecret = process.env.TOKEN_SECRET;
  const tokenExpiresIn = Number(process.env.TOKEN_EXPIRES_IN);

  if (!token) {
    return res
      .status(401)
      .json({ error_message: 'Access token required', error_code: 401 });
  }

  if (!tokenSecret || !tokenExpiresIn || isNaN(tokenExpiresIn)) {
    return res.status(500).json({
      error_message: 'Token secrets and expiration are not configured',
      error_code: 500,
    });
  }

  jwt.verify(token, tokenSecret, (err, payload) => {
    if (err) {
      return res
        .status(403)
        .json({ error_message: 'Invalid or expired token', error_code: 403 });
    }
    const user = payload as UserPayload;
    req.user = user;
    next();
  });
}

export function authorizeRole(roles?: User['role'][]) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ error_message: 'User not authenticated', error_code: 401 });
    }

    const user = await fetchUserById(req.user.id);
    if (!user) {
      return res
        .status(404)
        .json({ error_message: 'User not found', error_code: 404 });
    }

    const userRole = user.role;
    if (!!roles && roles.indexOf(userRole) === -1) {
      return res.status(403).json({
        error_message: 'Access forbidden: insufficient rights',
        error_code: 403,
      });
    }

    req.user = user;
    next();
  };
}
