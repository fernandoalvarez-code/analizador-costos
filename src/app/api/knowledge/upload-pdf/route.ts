import { NextRequest, NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/auth/admin-app';
import { requireSecucutUser } from '@/lib/server/auth-guards';
import { getFirestore } from 'firebase-admin/firestore';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireSecucutUser(req);
  if (!auth.ok) return auth.response;
  const userEmail = auth.user.email;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const category = (formData.get('category') as string) || 'catalogo';
  const tags = ((formData.get('tags') as string) || '').split(',').map(t => t.trim()).filter(Boolean);
  const chunkIndex = parseInt((formData.get('chunkIndex') as string) || '0');
  const totalChunks = parseInt((formData.get('totalChunks') as string) || '1');
  const fileName = (formData.get('fileName') as string) || file?.name || 'unknown.pdf';

  if (!file) return NextResponse.json({ error: 'Se requiere archivo' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  let text = '';
  let numpages = 0;
  try {
    const result = await pdfParse(buffer);
    text = result.text;
    numpages = result.numpages;
  } catch (e) {
    return NextResponse.json({ error: 'Error al parsear PDF: ' + String(e) }, { status: 400 });
  }

  if (!text || text.trim().length < 50) {
    return NextResponse.json({
      success: true,
      chunks: 0,
      message: `Parte ${chunkIndex + 1}/${totalChunks} sin texto extraíble — omitida`
    });
  }

  const knowledgeChunks = splitIntoChunks(text, 1500);

  const adminApp = await initializeAdminApp();
  const db = getFirestore(adminApp);
  const batch = db.batch();
  const entriesRef = db.collection('knowledge_entries');

  let count = 0;
  for (let i = 0; i < knowledgeChunks.length; i++) {
    const chunk = knowledgeChunks[i].trim();
    if (chunk.length < 50) continue;
    const ref = entriesRef.doc();
    batch.set(ref, {
      title: `${fileName} — parte ${chunkIndex + 1}/${totalChunks}, fragmento ${i + 1}`,
      category,
      content: chunk,
      sourceType: 'pdf',
      sourceFileName: fileName,
      tags: [...tags, 'pdf', fileName.replace('.pdf', '').toLowerCase().replace(/\s+/g, '-')],
      isActive: true,
      createdBy: userEmail,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    count++;
  }

  await batch.commit();

  return NextResponse.json({
    success: true,
    pages: numpages,
    chunks: count,
    chunkIndex,
    totalChunks,
    message: `Parte ${chunkIndex + 1}/${totalChunks}: ${count} fragmentos guardados (${numpages} páginas)`,
  });
}

function splitIntoChunks(text: string, maxChars: number): string[] {
  const cleaned = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const paragraphs = cleaned.split('\n\n');
  const chunks: string[] = [];
  let current = '';
  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > maxChars && current.length > 0) {
      chunks.push(current);
      current = para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
