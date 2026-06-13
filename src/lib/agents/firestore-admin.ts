import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/firebase/auth/admin-app';
import type { Agent, KnowledgeEntry, ChatSession, ChatSessionInput, ChatMessage } from './types';

function toDate(val: FirebaseFirestore.Timestamp | Date | undefined): Date {
  if (!val) return new Date();
  if (val && typeof (val as FirebaseFirestore.Timestamp).toDate === 'function') {
    return (val as FirebaseFirestore.Timestamp).toDate();
  }
  return val as Date;
}

async function getDb() {
  await initializeAdminApp();
  return getFirestore();
}

export async function getAgentBySlugAdmin(slug: string): Promise<Agent | null> {
  const db = await getDb();
  const snap = await db.collection('ai_agents')
    .where('slug', '==', slug)
    .where('isActive', '==', true)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return { ...d, id: snap.docs[0].id, createdAt: toDate(d.createdAt), updatedAt: toDate(d.updatedAt) } as Agent;
}

export async function searchKnowledgeByTagsAdmin(tags: string[]): Promise<KnowledgeEntry[]> {
  const db = await getDb();
  const snap = await db.collection('knowledge_entries')
    .where('isActive', '==', true)
    .where('tags', 'array-contains-any', tags)
    .get();
  return snap.docs.map(d => ({
    ...d.data(), id: d.id,
    createdAt: toDate(d.data().createdAt),
    updatedAt: toDate(d.data().updatedAt)
  })) as KnowledgeEntry[];
}

export async function createChatSessionAdmin(data: ChatSessionInput): Promise<string> {
  const db = await getDb();
  const ref = await db.collection('chat_sessions').add({
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return ref.id;
}

export async function getChatSessionAdmin(id: string): Promise<ChatSession | null> {
  const db = await getDb();
  const snap = await db.collection('chat_sessions').doc(id).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return { ...d, id: snap.id, createdAt: toDate(d.createdAt), updatedAt: toDate(d.updatedAt) } as ChatSession;
}

export async function appendMessageAdmin(
  sessionId: string,
  message: ChatMessage,
  contextUsed?: string[]
): Promise<void> {
  const db = await getDb();
  const ref = db.collection('chat_sessions').doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Session ${sessionId} not found`);
  const current = snap.data()?.messages ?? [];
  await ref.update({
    messages: [...current, { ...message, timestamp: new Date() }],
    updatedAt: new Date(),
    ...(contextUsed ? { contextUsed } : {}),
  });
}
