import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase';
import type {
  Agent,
  AgentInput,
  KnowledgeEntry,
  KnowledgeEntryInput,
  ChatSession,
  ChatSessionInput,
  ChatMessage,
} from './types';

// Helper: convierte Timestamp de Firestore a Date
function toDate(val: Timestamp | Date | undefined): Date {
  if (!val) return new Date();
  if (val instanceof Timestamp) return val.toDate();
  return val;
}

// ── AGENTS ──────────────────────────────────────────────

export async function createAgent(data: AgentInput): Promise<string> {
  const ref = await addDoc(collection(db, 'ai_agents'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getAgent(id: string): Promise<Agent | null> {
  const snap = await getDoc(doc(db, 'ai_agents', id));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    ...d,
    id: snap.id,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  } as Agent;
}

export async function getAgentBySlug(slug: string): Promise<Agent | null> {
  const q = query(
    collection(db, 'ai_agents'),
    where('slug', '==', slug),
    where('isActive', '==', true)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return {
    ...d,
    id: snap.docs[0].id,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  } as Agent;
}

export async function listAgents(onlyActive = true): Promise<Agent[]> {
  const constraints = onlyActive ? [where('isActive', '==', true)] : [];
  const q = query(collection(db, 'ai_agents'), ...constraints, orderBy('name'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    createdAt: toDate(d.data().createdAt),
    updatedAt: toDate(d.data().updatedAt),
  })) as Agent[];
}

export async function updateAgent(id: string, data: Partial<AgentInput>): Promise<void> {
  await updateDoc(doc(db, 'ai_agents', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAgent(id: string): Promise<void> {
  await deleteDoc(doc(db, 'ai_agents', id));
}

// ── KNOWLEDGE BASE ───────────────────────────────────────

export async function createKnowledgeEntry(data: KnowledgeEntryInput): Promise<string> {
  const ref = await addDoc(collection(db, 'knowledge_entries'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listKnowledgeEntries(category?: string): Promise<KnowledgeEntry[]> {
  const constraints = [
    where('isActive', '==', true),
    ...(category ? [where('category', '==', category)] : []),
    orderBy('createdAt', 'desc'),
  ];
  const snap = await getDocs(query(collection(db, 'knowledge_entries'), ...constraints));
  return snap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    createdAt: toDate(d.data().createdAt),
    updatedAt: toDate(d.data().updatedAt),
  })) as KnowledgeEntry[];
}

export async function updateKnowledgeEntry(
  id: string,
  data: Partial<KnowledgeEntryInput>
): Promise<void> {
  await updateDoc(doc(db, 'knowledge_entries', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteKnowledgeEntry(id: string): Promise<void> {
  await deleteDoc(doc(db, 'knowledge_entries', id));
}

// Busca entradas relevantes por tags (para que el agente consulte antes de responder)
export async function searchKnowledgeByTags(tags: string[]): Promise<KnowledgeEntry[]> {
  const q = query(
    collection(db, 'knowledge_entries'),
    where('isActive', '==', true),
    where('tags', 'array-contains-any', tags)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    createdAt: toDate(d.data().createdAt),
    updatedAt: toDate(d.data().updatedAt),
  })) as KnowledgeEntry[];
}

// ── CHAT SESSIONS ────────────────────────────────────────

export async function createChatSession(data: ChatSessionInput): Promise<string> {
  const ref = await addDoc(collection(db, 'chat_sessions'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function appendMessage(
  sessionId: string,
  message: ChatMessage,
  contextUsed?: string[]
): Promise<void> {
  const sessionRef = doc(db, 'chat_sessions', sessionId);
  const snap = await getDoc(sessionRef);
  if (!snap.exists()) throw new Error(`Session ${sessionId} not found`);
  const current = snap.data().messages ?? [];
  await updateDoc(sessionRef, {
    messages: [...current, { ...message, timestamp: new Date() }],
    updatedAt: serverTimestamp(),
    ...(contextUsed ? { contextUsed } : {}),
  });
}

export async function getChatSession(id: string): Promise<ChatSession | null> {
  const snap = await getDoc(doc(db, 'chat_sessions', id));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    ...d,
    id: snap.id,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  } as ChatSession;
}

export async function listUserSessions(
  userId: string,
  agentId?: string
): Promise<ChatSession[]> {
  // Solo filtros de igualdad (sin orderBy) para no requerir índice compuesto;
  // ordenamos por updatedAt desc en JS.
  const constraints = [
    where('userId', '==', userId),
    ...(agentId ? [where('agentId', '==', agentId)] : []),
  ];
  const snap = await getDocs(query(collection(db, 'chat_sessions'), ...constraints));
  return snap.docs
    .map((d) => ({
      ...d.data(),
      id: d.id,
      createdAt: toDate(d.data().createdAt),
      updatedAt: toDate(d.data().updatedAt),
    }) as ChatSession)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  await deleteDoc(doc(db, 'chat_sessions', sessionId));
}
