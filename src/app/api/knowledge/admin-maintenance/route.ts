// TEMPORAL: endpoint de mantenimiento para retag + cleanup de knowledge_entries.
// BORRAR después de usar. Auth: token Firebase + dominio @secocut.com.
import { NextRequest, NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/auth/admin-app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const COMMIT_CHUNK = 400; // Firestore limita a 500 ops por batch

function slugFromFileName(fileName: string): string {
  return fileName.replace('.pdf', '').toLowerCase().replace(/\s+/g, '-');
}

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let userEmail = '';
  try {
    const adminApp = await initializeAdminApp();
    const decoded = await getAuth(adminApp).verifyIdToken(token);
    userEmail = decoded.email ?? '';
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (!userEmail.endsWith('@secocut.com')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const retag: Array<{ prefix: string; tags: string[] }> = body.retag ?? [];
  const deleteByFileName: string[] = body.deleteByFileName ?? [];
  const dryRun: boolean = body.dryRun === true;

  const adminApp = await initializeAdminApp();
  const db = getFirestore(adminApp);
  const col = db.collection('knowledge_entries');

  const result: any = { dryRun, retag: [], deleted: [] };

  // --- RETAG por prefijo de sourceFileName ---
  for (const { prefix, tags } of retag) {
    const upper = prefix + String.fromCharCode(0xffff);
    const snap = await col
      .where('sourceFileName', '>=', prefix)
      .where('sourceFileName', '<', upper)
      .get();

    let updated = 0;
    const docs = snap.docs;
    for (let i = 0; i < docs.length && !dryRun; i += COMMIT_CHUNK) {
      const batch = db.batch();
      for (const doc of docs.slice(i, i + COMMIT_CHUNK)) {
        const sourceFileName = doc.get('sourceFileName') as string;
        const newTags = Array.from(new Set([...tags, 'pdf', slugFromFileName(sourceFileName)]));
        batch.update(doc.ref, { tags: newTags, updatedAt: new Date() });
        updated++;
      }
      await batch.commit();
    }
    result.retag.push({ prefix, matched: docs.length, updated: dryRun ? 0 : updated });
  }

  // --- DELETE por sourceFileName exacto ---
  for (const fileName of deleteByFileName) {
    const snap = await col.where('sourceFileName', '==', fileName).get();
    const docs = snap.docs;
    let deleted = 0;
    for (let i = 0; i < docs.length && !dryRun; i += COMMIT_CHUNK) {
      const batch = db.batch();
      for (const doc of docs.slice(i, i + COMMIT_CHUNK)) {
        batch.delete(doc.ref);
        deleted++;
      }
      await batch.commit();
    }
    result.deleted.push({ fileName, matched: docs.length, deleted: dryRun ? 0 : deleted });
  }

  return NextResponse.json({ success: true, ...result });
}
