'use server';

import { getAuth } from 'firebase-admin/auth';
import { initializeAdminApp } from './admin-app';

interface SetCustomClaimsParams {
  uid: string;
  claims: Record<string, any>;
}

// Only non-privileged roles can be set through this action.
// Admin promotion requires a separate server action with explicit admin verification.
const NON_PRIVILEGED_ROLES = new Set(['user']);

export async function setCustomUserClaims(params: SetCustomClaimsParams) {
  const { uid, claims } = params;

  if (claims.role !== undefined && !NON_PRIVILEGED_ROLES.has(claims.role)) {
    return {
      success: false,
      message: `Setting role '${claims.role}' is not allowed through this action.`,
    };
  }

  try {
    await initializeAdminApp();
    await getAuth().setCustomUserClaims(uid, claims);
    return { success: true, message: `Custom claims set for user ${uid}` };
  } catch (error: any) {
    console.error('Error setting custom claims:', error);
    return { success: false, message: error.message };
  }
}
