import { NextRequest, NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/auth/admin-app';
import { requireSecucutUser } from '@/lib/server/auth-guards';
import { safeFetchText, UnsafeUrlError } from '@/lib/server/safe-fetch';
import { getFirestore } from 'firebase-admin/firestore';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireSecucutUser(req);
  if (!auth.ok) return auth.response;
  const userEmail = auth.user.email;

  const { url, category, tags, title } = await req.json();

  if (typeof url !== 'string' || !url.startsWith('https://')) {
    return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
  }

  // Descarga con protección contra SSRF: solo destinos públicos por https, sin seguir redirecciones.
  // Los errores de red no se devuelven tal cual (no sirven para explorar la red interna).
  let html = '';
  try {
    const result = await safeFetchText(url);
    if (result.kind === 'redirect') {
      return NextResponse.json({ error: 'La URL redirige a otra dirección. Ingresá la URL final de la página.' }, { status: 400 });
    }
    if (result.kind === 'http-error') {
      return NextResponse.json({ error: `No se pudo acceder a la URL (HTTP ${result.status}).` }, { status: 400 });
    }
    html = result.text;
  } catch (e) {
    if (e instanceof UnsafeUrlError) {
      return NextResponse.json({ error: 'URL no permitida. Solo se admiten páginas públicas por https.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'No se pudo acceder a la URL.' }, { status: 400 });
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
