'use client';

import { Auth, createUserWithEmailAndPassword } from 'firebase/auth';
import { Firestore, doc, setDoc } from 'firebase/firestore';

/**
 * Creates a new user in Firebase Authentication, sets their custom claims (role),
 * and creates their profile in Firestore.
 * This function is intended to be called from the client-side by an admin user.
 * The corresponding server-side action and security rules handle the authorization.
 *
 * @param auth The Firebase Auth instance.
 * @param firestore The Firestore instance.
 * @param email The new user's email.
 * @param password The new user's password.
 * @param role The role to assign to the new user ('admin' or 'user').
 * @throws Will throw an error if user creation or document setting fails.
 */
export async function createUserWithRole(
  auth: Auth,
  firestore: Firestore,
  email: string,
  password: string,
  role: 'admin' | 'user'
): Promise<void> {
  // We can't create the user and set claims in one atomic operation from the client.
  // The best practice is to create the user, then call a server-side function
  // to set their custom claims.
  
  // Step 1 (Client-side): Create the user in Firebase Authentication.
  // This is a temporary measure. Ideally, user creation is also a server-side action.
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  if (!user) {
    throw new Error("Failed to create user account.");
  }

  try {
    // Step 2: crear el perfil en Firestore. El rol vive solo en users/{uid}.role (no hay custom claims).
    const userDocRef = doc(firestore, 'users', user.uid);
    await setDoc(userDocRef, {
      id: user.uid,
      email: user.email,
      role: role,
    });

  } catch (error) {
    // If setting claims or Firestore doc fails, we should ideally delete the created user
    // to avoid an inconsistent state. This requires admin privileges.
    console.error("Error creating the Firestore profile. Manual cleanup may be needed.", error);
    // For now, re-throw the error to notify the caller.
    throw error;
  }
}
