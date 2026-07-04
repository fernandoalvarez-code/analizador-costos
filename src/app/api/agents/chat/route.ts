import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeAdminApp } from '@/firebase/auth/admin-app';
import {
  getAgentBySlugAdmin as getAgentBySlug,
  searchKnowledgeByTagsAdmin as searchKnowledgeByTags,
  createChatSessionAdmin as createChatSession,
  appendMessageAdmin as appendMessage,
  getChatSessionAdmin as getChatSession,
} from '@/lib/agents/firestore-admin';
import type { ChatMessage } from '@/lib/agents/types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// Extrae keywords simples del último mensaje del usuario para buscar en KB
// Quita acentos para que stopwords y matching no dependan de tildes
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'que', 'cual', 'como', 'para', 'con', 'una', 'uno', 'los', 'las',
    'del', 'por', 'mas', 'sobre', 'hay', 'tiene', 'tengo', 'quiero',
    'puedo', 'puede', 'usar', 'the', 'and', 'for', 'are',
    'programo', 'profundo', 'necesito', 'podes',
  ]);
  return stripAccents(text.toLowerCase())
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w))
    .slice(0, 10);
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let uid: string;
  let userEmail: string;
  try {
    const adminApp = await initializeAdminApp();
    const decoded = await getAuth(adminApp).verifyIdToken(token);
    uid = decoded.uid;
    userEmail = decoded.email ?? '';
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // ── Body ──────────────────────────────────────────────
  const body = await req.json();
  const { agentSlug, message, sessionId, image } = body as {
    agentSlug: string;
    message: string;
    sessionId: string | null;
    image: { base64: string; mediaType: string } | null;
  };

  if (!agentSlug || !message) {
    return NextResponse.json({ error: 'agentSlug y message son requeridos' }, { status: 400 });
  }

  // ── Cargar agente ─────────────────────────────────────
  let agent;
  try {
    agent = await getAgentBySlug(agentSlug);
  } catch {
    return NextResponse.json({ error: 'Error al cargar agente' }, { status: 500 });
  }
  if (!agent) {
    return NextResponse.json({ error: `Agente "${agentSlug}" no encontrado` }, { status: 404 });
  }

  // ── Recuperar o crear sesión ──────────────────────────
  let currentSessionId = sessionId ?? null;
  let history: ChatMessage[] = [];

  if (currentSessionId) {
    const session = await getChatSession(currentSessionId);
    if (!session || session.userId !== uid) {
      return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });
    }
    history = session.messages;
  }

  // ── Consultar base de conocimiento ────────────────────
  const keywords = extractKeywords(message);
  let knowledgeContext = '';
  const usedEntryIds: string[] = [];

  if (keywords.length > 0) {
    try {
      const entries = await searchKnowledgeByTags(keywords);
      const relevant = entries
        .filter((e) => agent.knowledgeCategories.length === 0 || agent.knowledgeCategories.includes(e.category))
        .map((e) => {
          // Puntuar por coincidencia de keywords con tags + título (más peso al título)
          const titleLower = e.title.toLowerCase();
          const tagMatches = e.tags.filter((t) => keywords.includes(t.toLowerCase())).length;
          const titleMatches = keywords.filter((k) => titleLower.includes(k)).length;
          const score = tagMatches * 2 + titleMatches * 3;
          return { entry: e, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.entry);

      if (relevant.length > 0) {
        const top = relevant.slice(0, 4);
        knowledgeContext =
          '\n\n--- INFORMACIÓN DE REFERENCIA (base de conocimiento SECOCUT) ---\n' +
          top
            .map((e) => `[${e.category.toUpperCase()}] ${e.title}:\n${e.content}`)
            .join('\n\n') +
          '\n--- FIN INFORMACIÓN DE REFERENCIA ---\n';
        usedEntryIds.push(...top.map((e) => e.id));
      }
    } catch {
      // KB vacía o error — continuar sin contexto adicional
    }
  }

  // ── Construir system prompt ───────────────────────────
  const toneInstruction =
    agent.tone === 'tecnico'
      ? 'técnico y preciso, con terminología de mecanizado industrial.'
      : agent.tone === 'formal'
      ? 'formal y profesional.'
      : 'cercano y directo, como un colega que conoce el tema.';

  // Parte ESTABLE del system prompt (cacheable). El knowledgeContext es
  // volátil (cambia por consulta), así que va en un bloque aparte sin cache.
  const baseSystemPrompt =
    agent.systemPrompt +
    '\n\nEres el asistente de SECOCUT, representante de SECOTOOLS en Argentina. ' +
    'Respondé siempre en español rioplatense. ' +
    `Sé ${toneInstruction} ` +
    'Nunca inventes números de catálogo, precios exactos ni especificaciones que no tenés. ' +
    'Si no sabés algo específico, decí que el equipo de SECOCUT puede confirmar.';

  // ── Llamar a Claude ───────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key no configurada' }, { status: 500 });
  }

  const recentHistory = history.slice(-10);
  const userContent = image
    ? [
        { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
        { type: 'text', text: message },
      ]
    : message;

  const anthropicMessages = [
    ...recentHistory.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userContent },
  ];

  let assistantReply = '';
  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: [
          {
            type: 'text',
            text: baseSystemPrompt,
            cache_control: { type: 'ephemeral' },
          },
          ...(knowledgeContext
            ? [{ type: 'text', text: knowledgeContext }]
            : []),
        ],
        messages: anthropicMessages,
        tools: agentSlug === 'tecnico' ? [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 3,
          }
        ] : undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[agents/chat] Anthropic error:', err);
      return NextResponse.json({ error: 'Error al contactar el modelo' }, { status: 502 });
    }

    const data = await res.json();
    // El web search devuelve bloques server_tool_use / web_search_tool_result
    // intercalados con el texto, así que juntamos todos los bloques de texto.
    assistantReply = (data.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n')
      .trim();
  } catch {
    return NextResponse.json({ error: 'Error al contactar el modelo' }, { status: 502 });
  }

  // ── Persistir en Firestore ────────────────────────────
  const userMsg: ChatMessage = { role: 'user', content: message, timestamp: new Date() };
  const aiMsg: ChatMessage = { role: 'assistant', content: assistantReply, timestamp: new Date() };

  if (!currentSessionId) {
    currentSessionId = await createChatSession({
      agentId: agent.id,
      agentSlug: agent.slug,
      userId: uid,
      userEmail,
      messages: [userMsg, aiMsg],
      contextUsed: usedEntryIds,
    });
  } else {
    await appendMessage(currentSessionId, userMsg);
    await appendMessage(currentSessionId, aiMsg, usedEntryIds);
  }

  // ── Respuesta ─────────────────────────────────────────
  return NextResponse.json({
    reply: assistantReply,
    sessionId: currentSessionId,
    agentName: agent.name,
    contextUsed: usedEntryIds.length > 0,
  });
}
