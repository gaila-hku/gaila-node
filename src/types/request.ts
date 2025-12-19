import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';

import { User } from 'types/db/user';

export interface UserPayload extends JwtPayload {
  id: number;
  username: string;
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

export interface AuthorizedRequest extends Request {
  user?: User;
}
