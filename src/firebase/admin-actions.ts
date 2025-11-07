
'use client';

import { Auth, createUserWithEmailAndPassword } from 'firebase/auth';
import { Firestore, doc, setDoc } from 'firebase/firestore';

/**
 * Creates a new user in Firebase Authentication and sets their role in Firestore.
 * This function is intended to be called by an admin user.
 * It does not perform security checks; those must be handled by Firestore security rules.
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
  // Step 1: Create the user in Firebase Authentication
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  if (!user) {
    throw new Error("Failed to create user account.");
  }

  // Step 2: Create a user profile document in Firestore with the specified role.
  // The security rules should verify that the user performing this action is an admin.
  const userDocRef = doc(firestore, 'users', user.uid);
  await setDoc(userDocRef, {
    id: user.uid,
    email: user.email,
    role: role,
  });
}
