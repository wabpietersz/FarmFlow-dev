import { type User } from '@farmflow/shared';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
