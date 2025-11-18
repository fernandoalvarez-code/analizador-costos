'use server';

import { getAuth } from 'firebase-admin/auth';
import { initializeAdminApp } from './admin-app';

interface SetCustomClaimsParams {
  uid: string;
  claims: Record<string, any>;
}

/**
 * A server action to set custom claims on a Firebase user.
 * This should be called from the client after a trusted action (e.g., by an admin).
 */
export async function setCustomUserClaims(params: SetCustomClaimsParams) {
  const { uid, claims } = params;

  try {
    // Ensure the admin app is initialized
    await initializeAdminApp();

    // Set custom claims
    await getAuth().setCustomUserClaims(uid, claims);

    return { success: true, message: `Custom claims set for user ${uid}` };
  } catch (error: any) {
    console.error('Error setting custom claims:', error);
    // In a real app, you might want to return a more user-friendly error
    return { success: false, message: error.message };
  }
}
