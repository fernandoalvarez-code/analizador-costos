'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Bot, User, AlertCircle, Paperclip, X, FileText, Plus } from 'lucide-react';
import { useUser } from '@/firebase';
import { getChatSession } from '@/lib/agents/firestore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ── Tailwind consts (nivel módulo — evita purge) ──────
const BUBBLE_BASE = 'rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[80%]';
const BUBBLE_USER = `${BUBBLE_BASE} bg-orange-500 text-white rounded-br-sm self-end`;
const BUBBLE_AI   = `${BUBBLE_BASE} bg-gray-100 text-gray-900 rounded-bl-sm self-start`;
const ROW_BASE    = 'flex gap-2 items-end';
const ROW_USER    = `${ROW_BASE} flex-row-reverse`;
const ROW_AI      = `${ROW_BASE} flex-row`;
const AVATAR_BASE = 'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium';
const AVATAR_USER = `${AVATAR_BASE} bg-orange-500 text-white`;
const AVATAR_AI   = `${AVATAR_BASE} bg-gray-900 text-white`;
const SEND_BTN_ON  ='w-9 h-9 rounded-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center flex-shrink-0 transition-colors';
const SEND_BTN_OFF = 'w-9 h-9 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 cursor-not-allowed';
const ATTACH_BTN = 'w-9 h-9 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer';
const BTN_REPORT = 'flex items-center gap-1 text-white/80 hover:text-white text-xs border border-white/30 rounded-md px-2 py-1 transition-colors';

// ── Tipos locales ─────────────────────────────────────
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AgentChatProps {
  agentSlug: string;
  agentName?: string;
  agentColor?: string;
  placeholder?: string;
  className?: string;
  height?: string;
  initialSessionId?: string | null;
}

// ── Componente ────────────────────────────────────────
export default function AgentChat({
  agentSlug,
  agentName = 'Asistente',
  agentColor = '#1a1a1a',
  placeholder = 'Escribí tu consulta...',
  className = '',
  height = 'h-[520px]',
  initialSessionId = null,
}: AgentChatProps) {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<{ base64: string; mediaType: string; preview: string } | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportHtml, setReportHtml] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Cargar una sesión existente si se pasa initialSessionId
  useEffect(() => {
    if (!initialSessionId) return;
    getChatSession(initialSessionId).then((session) => {
      if (!session) return;
      setMessages(session.messages.map((m) => ({ role: m.role, content: m.content })));
      setSessionId(initialSessionId);
    });
  }, [initialSessionId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setImage({ base64, mediaType: file.type, preview: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const getToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    try {
      const token = await user.getIdToken(true); // force refresh
      return token;
    } catch (e) {
      console.error('[AgentChat] getIdToken error:', e);
      return null;
    }
  }, [user]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    setError(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setImage(null);
    setIsLoading(true);

    try {
      const token = await getToken();
      if (!token) {
        setError('Necesitás estar logueado para usar el asistente.');
        setIsLoading(false);
        return;
      }

      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          agentSlug,
          message: text,
          sessionId,
          image: image ? { base64: image.base64, mediaType: image.mediaType } : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
      }

      const data = await res.json() as { reply: string; sessionId: string };
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setError(msg);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, sessionId, agentSlug, getToken, image]);

  const downloadReport = useCallback(async () => {
    if (messages.length === 0 || isLoading) return;

    // Paso 1: pedir informe ejecutivo al agente (estructura según el agente)
    const reportPrompt = agentSlug === 'comercial'
      ? `Generá un INFORME COMERCIAL EJECUTIVO completo basado en esta conversación.
El informe debe tener exactamente esta estructura en markdown:

# PROPUESTA COMERCIAL SECOCUT
**SECOCUT SRL — Representante exclusivo SECO Tools Argentina**
**Fecha:** ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}

---

## DATOS DEL CLIENTE
- **Cliente:** [nombre del cliente]
- **Máquina:** [máquina analizada]
- **Material:** [material a mecanizar]
- **Operación:** [turning/milling/drilling]

---

## SITUACIÓN ACTUAL
[Descripción breve del proceso actual del cliente y el problema detectado]

---

## ANÁLISIS DE COSTOS

| Concepto | Herramienta actual | Propuesta SECO |
|---|---|---|
| Código | | |
| Precio inserto (USD) | | |
| Filos | | |
| Piezas por filo | | |
| Costo herramienta/pieza (USD) | | |
| Tiempo de ciclo (min) | | |
| Costo máquina/pieza (USD) | | |
| Costo cambio/pieza (USD) | | |
| **COSTO TOTAL/PIEZA (USD)** | | |
| **AHORRO/PIEZA (USD)** | | |
| **AHORRO MENSUAL (USD)** | | |

---

## HERRAMIENTA PROPUESTA
- **Código SECO:** [código]
- **Descripción:** [descripción]
- **Parámetros propuestos:** Vc: X m/min | fn: X mm/rev | ap: X mm
- **Vida útil estimada:** X piezas por filo

---

## BENEFICIOS DE LA PROPUESTA
- [Beneficio 1 con número concreto]
- [Beneficio 2 con número concreto]
- [Beneficio 3 con número concreto]

---

## PRÓXIMOS PASOS
1. [Acción concreta 1]
2. [Acción concreta 2]
3. Prueba piloto en una máquina sin compromiso

---

*Precios sujetos a confirmación del equipo comercial de SECOCUT.*
*Cálculos basados en los datos provistos por el cliente.*`
      : `Generá un INFORME TÉCNICO EJECUTIVO en base a esta conversación.
El informe debe tener exactamente esta estructura:

**RESUMEN DE LA CONSULTA**
[Una o dos oraciones describiendo el problema o consulta]

**DIAGNÓSTICO**
[Causa raíz identificada, máximo 3 puntos]

**SOLUCIÓN RECOMENDADA**
[Herramienta/s SECO sugerida/s con criterios de selección]

**PARÁMETROS PROPUESTOS**
[Tabla con Vc, fn/fz, ap, ae — solo si aplica]

**MEJORA ESTIMADA**
[Beneficio esperado en productividad, vida de herramienta o costo]

**PRÓXIMOS PASOS**
[1-2 acciones concretas]

Sé conciso. Máximo una página A4.`;

    setIsGeneratingReport(true);

    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          agentSlug,
          message: reportPrompt,
          sessionId,
          image: null,
        }),
      });

      const data = await res.json();
      const reportText = data.reply ?? '';

      // Paso 2: convertir markdown → HTML puro (no depende del render de React)
      const { unified } = await import('unified');
      const { default: remarkParse } = await import('remark-parse');
      const { default: remarkHtml } = await import('remark-html');

      const file = await unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkHtml)
        .process(reportText);

      setReportHtml(String(file));

      // Esperar a que el DOM se actualice antes de capturar
      await new Promise((r) => setTimeout(r, 500));

      const element = document.getElementById('agente-tecnico-informe');
      if (!element) return;

      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        scrollY: 0,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`informe-tecnico-secocut-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setIsGeneratingReport(false);
    }
  }, [messages, isLoading, agentSlug, sessionId, getToken]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetSession = () => {
    setMessages([]);
    setSessionId(null);
    setError(null);
  };

  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <div className={`flex flex-col rounded-xl border border-gray-200 overflow-hidden bg-white ${height} ${className}`}>

      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ backgroundColor: agentColor }}
      >
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <Bot size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm leading-none">{agentName}</p>
          <p className="text-white/60 text-xs mt-0.5">SECOCUT · IA</p>
        </div>
        {messages.length > 0 && (
          <div className="flex items-center gap-2">
            {(agentSlug === 'tecnico' || agentSlug === 'comercial') && (
              <button onClick={downloadReport} disabled={isGeneratingReport} className={BTN_REPORT} title="Descargar informe PDF">
                <FileText size={14} />
                <span className="hidden sm:inline">{isGeneratingReport ? 'Generando...' : 'Descargar PDF'}</span>
              </button>
            )}
            <button
              onClick={resetSession}
              className="flex items-center gap-1 text-white/60 hover:text-white text-xs transition-colors"
              title="Nueva conversación"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Nueva conversación</span>
            </button>
          </div>
        )}
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">

        {messages.length === 0 && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Bot size={24} className="text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">{agentName}</p>
              <p className="text-xs text-gray-400 mt-1">
                Hacé tu consulta — estoy listo para ayudarte.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? ROW_USER : ROW_AI}>
            <div className={msg.role === 'user' ? AVATAR_USER : AVATAR_AI}>
              {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div className={msg.role === 'user' ? BUBBLE_USER : BUBBLE_AI}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h2: ({ children }) => (
                    <p className="font-semibold text-sm mt-2 mb-1">{children}</p>
                  ),
                  h3: ({ children }) => (
                    <p className="font-medium text-sm mt-1">{children}</p>
                  ),
                  p: ({ children }) => (
                    <p className="mb-1 last:mb-0">{children}</p>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold">{children}</strong>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside mt-1 mb-1 space-y-0.5">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside mt-1 mb-1 space-y-0.5">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-sm">{children}</li>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="text-xs border-collapse w-full">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-gray-100">{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th className="border border-gray-300 px-3 py-1.5 text-left font-semibold">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-gray-300 px-3 py-1.5">{children}</td>
                  ),
                  tr: ({ children }) => (
                    <tr className="even:bg-gray-50">{children}</tr>
                  ),
                  hr: () => <hr className="my-2 border-gray-200" />,
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className={ROW_AI}>
            <div className={AVATAR_AI}>
              <Bot size={14} />
            </div>
            <div className={BUBBLE_AI}>
              <Loader2 size={14} className="animate-spin text-gray-400" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-200 bg-white">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageChange}
        />
        {image && (
          <div className="relative inline-block mb-2">
            <img src={image.preview} alt="adjunto" className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
            <button
              onClick={() => setImage(null)}
              className="absolute -top-1 -right-1 w-4 h-4 bg-gray-800 rounded-full flex items-center justify-center"
            >
              <X size={10} className="text-white" />
            </button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={ATTACH_BTN}
            title="Adjuntar foto o plano"
          >
            <Paperclip size={15} className="text-gray-500" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm px-3 py-2 outline-none focus:border-orange-400 placeholder-gray-400 transition-colors"
            style={{ minHeight: '38px', maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!canSend}
            className={canSend ? SEND_BTN_ON : SEND_BTN_OFF}
            aria-label="Enviar"
          >
            <Send size={15} className="text-white" />
          </button>
        </div>
      </div>

      {/* Informe PDF oculto — se captura con html2canvas (resumen ejecutivo) */}
      <div id="agente-tecnico-informe" className="fixed -left-[9999px] top-0 w-[794px] bg-white font-sans text-sm">
        {/* Header con color de marca */}
        <div className="bg-[#1a1a1a] px-10 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">
              {agentSlug === 'comercial' ? 'PROPUESTA COMERCIAL' : 'INFORME TÉCNICO'}
            </h1>
            <p className="text-xs text-[#f97316] mt-0.5 font-medium">
              SECOCUT SRL · Representante exclusivo SECO Tools Argentina
            </p>
          </div>
          <div className="text-right text-xs text-gray-400">
            <p className="text-white font-medium">
              {new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Contenido */}
        <div
          className="px-10 py-8 text-xs text-gray-700 leading-relaxed prose prose-sm max-w-none
            [&_table]:w-full [&_table]:border-collapse [&_table]:my-3
            [&_th]:border [&_th]:border-gray-300 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:bg-gray-100 [&_th]:text-xs
            [&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-xs
            [&_tr:nth-child(even)]:bg-gray-50
            [&_h1]:text-base [&_h1]:font-black [&_h1]:text-gray-900 [&_h1]:mt-0
            [&_h2]:text-xs [&_h2]:font-bold [&_h2]:text-[#f97316] [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:border-b [&_h2]:border-orange-200 [&_h2]:pb-1
            [&_strong]:font-semibold [&_hr]:my-4 [&_hr]:border-gray-200
            [&_ul]:list-disc [&_ul]:pl-4 [&_li]:mb-1"
          dangerouslySetInnerHTML={{ __html: reportHtml }}
        />

        {/* Footer */}
        <div className="px-10 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          <span className="text-[10px] text-gray-400">SECOCUT SRL · ventas@secocut.com · www.secocut.com</span>
          <span className="text-[10px] text-gray-400">
            {new Date().toLocaleDateString('es-AR')}
          </span>
        </div>
      </div>
    </div>
  );
}
