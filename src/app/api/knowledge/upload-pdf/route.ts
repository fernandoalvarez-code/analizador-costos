import { NextRequest, NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/auth/admin-app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export const maxDuration = 60; // PDF processing puede tardar

export async function POST(req: NextRequest) {
  // Auth — solo @secocut.com
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

  // Leer el form data
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const category = (formData.get('category') as string) || 'catalogo';
  const tags = ((formData.get('tags') as string) || '').split(',').map(t => t.trim()).filter(Boolean);

  if (!file || file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Se requiere un archivo PDF' }, { status: 400 });
  }

  // Extraer texto del PDF usando pdf-parse
  let pdfParse: (buffer: Buffer) => Promise<{ text: string; numpages: number }>;
  try {
    pdfParse = (await import('pdf-parse')).default;
  } catch {
    return NextResponse.json({ error: 'pdf-parse no instalado' }, { status: 500 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { text, numpages } = await pdfParse(buffer);

  if (!text || text.trim().length < 50) {
    return NextResponse.json({ error: 'No se pudo extraer texto del PDF' }, { status: 400 });
  }

  // Fragmentar el texto en chunks de ~1500 chars respetando párrafos
  const chunks = splitIntoChunks(text, 1500);

  // Guardar cada chunk como entrada de conocimiento
  const adminApp = await initializeAdminApp();
  const db = getFirestore(adminApp);
  const batch = db.batch();
  const entriesRef = db.collection('knowledge_entries');

  const createdIds: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i].trim();
    if (chunk.length < 50) continue; // saltar chunks muy cortos
    const ref = entriesRef.doc();
    batch.set(ref, {
      title: `${file.name} — parte ${i + 1} de ${chunks.length}`,
      category,
      content: chunk,
      sourceType: 'pdf',
      sourceFileName: file.name,
      tags: [...tags, 'pdf', file.name.replace('.pdf', '').toLowerCase().replace(/\s+/g, '-')],
      isActive: true,
      createdBy: userEmail,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    createdIds.push(ref.id);
  }

  await batch.commit();

  return NextResponse.json({
    success: true,
    fileName: file.name,
    pages: numpages,
    chunks: createdIds.length,
    message: `PDF procesado: ${createdIds.length} entradas creadas en la base de conocimiento`,
  });
}

function splitIntoChunks(text: string, maxChars: number): string[] {
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

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
