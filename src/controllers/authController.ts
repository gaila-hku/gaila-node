import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  fetchRefreshTokenByTokenHash,
  storeRefreshToken,
} from 'models/authModel';
import {
  fetchUserById,
  fetchUserByUsername,
  updateUserLoginTime,
} from 'models/userModel';

const generateAccessToken = (userId: number, username: string) => {
  const tokenSecret = process.env.TOKEN_SECRET;
  const tokenExpiresIn = Number(process.env.TOKEN_EXPIRES_IN);

  if (!tokenSecret || !tokenExpiresIn || isNaN(tokenExpiresIn)) {
    throw new Error('Token secrets and expiration are not configured');
  }

  return jwt.sign({ id: userId, username }, tokenSecret, {
    expiresIn: tokenExpiresIn,
  });
};

export const loginUser = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  // 1. Check if user exists
  const user = await fetchUserByUsername(username);
  if (!user) {
    return res
      .status(401)
      .json({ error_message: 'Invalid username or password' });
  }

  // 2. Compare passwords
  if (!bcrypt.compareSync(password, user.password)) {
    return res
      .status(401)
      .json({ error_message: 'Invalid username or password' });
  }

  // 3. Generate access token and refresh token
  const tokenSecret = process.env.TOKEN_SECRET;
  const tokenExpiresIn = Number(process.env.TOKEN_EXPIRES_IN);
  const refreshTokenExpiresIn = Number(process.env.REFRESH_TOKEN_EXPIRES_IN);

  if (
    !tokenSecret ||
    !tokenExpiresIn ||
    isNaN(tokenExpiresIn) ||
    !refreshTokenExpiresIn ||
    isNaN(refreshTokenExpiresIn)
  ) {
    return res.status(500).json({
      error_message: 'Token secrets and expirationn are not configured',
    });
  }

  const token = generateAccessToken(user.id, user.username);
  const refreshToken = crypto.randomBytes(64).toString('hex');

  // Hash and store refreshToken in DB
  storeRefreshToken(
    user.id,
    crypto.createHash('sha256').update(refreshToken).digest('hex'),
    Date.now() + refreshTokenExpiresIn,
  );

  await updateUserLoginTime(user.id);

  return res.status(200).json({
    token,
    expiresIn: tokenExpiresIn,
    refreshToken,
    refreshTokenExpiresIn,
    serverTime: Date.now(),
    role: user.role,
    lang: user.lang,
  });
};

export const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error_message: 'Refresh token is required' });
  }

  // Search for token in DB
  const tokenHash = crypto
    .createHash('sha256')
    .update(refreshToken)
    .digest('hex');
  const dbRefreshToken = await fetchRefreshTokenByTokenHash(tokenHash);
  if (!dbRefreshToken) {
    return res.status(401).json({ error_message: 'Invalid refresh token' });
  }

  if (dbRefreshToken.expires_at < Date.now()) {
    return res.status(401).json({ error_message: 'Refresh token has expired' });
  }

  // Fetch user to generate new access token
  const user = await fetchUserById(dbRefreshToken.user_id);
  if (!user) {
    return res.status(401).json({ error_message: 'Invalid refresh token' });
  }

  const newAccessToken = generateAccessToken(user.id, user.username);

  return res.status(200).json({
    token: newAccessToken,
    expiresIn: Number(process.env.TOKEN_EXPIRES_IN),
    refreshToken,
    refreshTokenExpiresIn: Number(process.env.REFRESH_TOKEN_EXPIRES_IN),
    serverTime: Date.now(),
    role: user.role,
    lang: user.lang,
  });
};
