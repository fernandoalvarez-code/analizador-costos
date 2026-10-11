import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';

// Proyecto demo-*: el emulador nunca se conecta a un proyecto real.
export const RULES_TEST_PROJECT_ID = 'demo-oportunidades';

export async function createRulesTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: RULES_TEST_PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
}

/** Claims de un usuario SECOCUT con email verificado. */
export const secocutVerified = (email = 'vendedor@secocut.com') => ({ email, email_verified: true });
