import { NextRequest, NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/auth/admin-app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { PDFParse } from 'pdf-parse';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

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
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    text = result.text;
    numpages = result.total;
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
