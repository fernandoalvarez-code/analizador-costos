'use server';

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { credential } from 'firebase-admin';

const ADMIN_APP_NAME = 'firebase-admin-app-for-studio';

/**
 * Initializes the Firebase Admin SDK if it hasn't been initialized yet.
 * It attempts to use Application Default Credentials first, which is suitable for
 * environments like Cloud Functions or Google Cloud Run.
 *
 * IMPORTANT: For local development, you MUST set the GOOGLE_APPLICATION_CREDENTIALS
 * environment variable to point to your service account key file.
 * e.g., export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-file.json"
 */
export async function initializeAdminApp(): Promise<App> {
  // Find if the named admin app has already been initialized.
  const existingApp = getApps().find(app => app.name === ADMIN_APP_NAME);
  if (existingApp) {
    return existingApp;
  }

  // If not initialized, initialize it with a unique name and Application Default Credentials.
  // The SDK will automatically find the credentials from the environment.
  const app = initializeApp({
     credential: credential.applicationDefault(),
  }, ADMIN_APP_NAME);

  return app;
}
