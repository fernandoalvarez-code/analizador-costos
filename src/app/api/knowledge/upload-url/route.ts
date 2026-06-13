import { NextRequest, NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/auth/admin-app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Auth
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

  const { url, category, tags, title } = await req.json();

  if (!url || !url.startsWith('https://')) {
    return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
  }

  // Fetchear la página
  let html = '';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SECOCUTBot/1.0)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    return NextResponse.json({ error: 'No se pudo acceder a la URL: ' + String(e) }, { status: 400 });
  }

  // Extraer texto limpio del HTML
  const text = extractTextFromHtml(html);

  if (!text || text.trim().length < 100) {
    return NextResponse.json({ error: 'No se encontró contenido útil en la URL' }, { status: 400 });
  }

  // Fragmentar en chunks
  const chunks = splitIntoChunks(text, 1500);

  const adminApp = await initializeAdminApp();
  const db = getFirestore(adminApp);
  const batch = db.batch();
  const entriesRef = db.collection('knowledge_entries');

  const pageTitle = title || extractTitle(html) || url;
  const tagList = (tags || '').split(',').map((t: string) => t.trim()).filter(Boolean);
  const urlSlug = url.replace('https://', '').replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 50);

  let count = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i].trim();
    if (chunk.length < 80) continue;
    const ref = entriesRef.doc();
    batch.set(ref, {
      title: chunks.length > 1 ? `${pageTitle} — parte ${i + 1}` : pageTitle,
      category: category || 'catalogo',
      content: chunk,
      sourceType: 'web',
      sourceUrl: url,
      tags: [...tagList, 'web', urlSlug],
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
    title: pageTitle,
    chunks: count,
    message: `URL procesada: ${count} fragmentos guardados`,
  });
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : '';
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
