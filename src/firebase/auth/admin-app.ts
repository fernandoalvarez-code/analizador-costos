'use server';

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { credential } from 'firebase-admin';

// This is a server-side only file.

/**
 * Initializes the Firebase Admin SDK if it hasn't been initialized yet.
 * It attempts to use Application Default Credentials first, which is suitable for
 * environments like Cloud Functions or Google Cloud Run.
 *
 * IMPORTANT: For local development, you MUST set the GOOGLE_APPLICATION_CREDENTIALS
 * environment variable to point to your service account key file.
 * e.g., export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-file.json"
 */
export function initializeAdminApp(): App {
  // If the app is already initialized, return it.
  if (getApps().length) {
    return getApps()[0];
  }

  // If not initialized, initialize it with Application Default Credentials.
  // The SDK will automatically find the credentials from the environment.
  const app = initializeApp({
     credential: credential.applicationDefault(),
  });

  return app;
}
