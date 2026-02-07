import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { config } from '../config';
import logger from './logger';

let firebaseAuthInstance: Auth | null = null;

function initialize(): void {
  if (getApps().length > 0) {
    firebaseAuthInstance = getAuth(getApps()[0]);
    return;
  }

  if (!config.firebase.projectId || !config.firebase.clientEmail || !config.firebase.privateKey) {
    logger.warn('Firebase credentials not configured — auth endpoints will not work');
    return;
  }

  const app = initializeApp({
    credential: cert({
      projectId: config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey,
    }),
  });

  firebaseAuthInstance = getAuth(app);
  logger.info('Firebase Admin SDK initialized');
}

initialize();

export const firebaseAuth = firebaseAuthInstance as unknown as Auth;
