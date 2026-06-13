'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Bot, User, AlertCircle } from 'lucide-react';
import { useUser } from '@/firebase';

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
const INPUT_AREA  = 'flex gap-2 items-end p-3 border-t border-gray-200 bg-white';
const SEND_BTN_ON  = 'w-9 h-9 rounded-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center flex-shrink-0 transition-colors';
const SEND_BTN_OFF = 'w-9 h-9 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 cursor-not-allowed';

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
}

// ── Componente ────────────────────────────────────────
export default function AgentChat({
  agentSlug,
  agentName = 'Asistente',
  agentColor = '#1a1a1a',
  placeholder = 'Escribí tu consulta...',
  className = '',
  height = 'h-[520px]',
}: AgentChatProps) {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
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
        body: JSON.stringify({ agentSlug, message: text, sessionId }),
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
  }, [input, isLoading, sessionId, agentSlug, getToken]);

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
          <button
            onClick={resetSession}
            className="text-white/60 hover:text-white text-xs transition-colors"
            title="Nueva conversación"
          >
            Nueva conversación
          </button>
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
              {msg.content.split('\n').map((line, j) => {
                const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                return (
                  <p
                    key={j}
                    className={j > 0 ? 'mt-1' : ''}
                    dangerouslySetInnerHTML={{ __html: boldLine }}
                  />
                );
              })}
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
      <div className={INPUT_AREA}>
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
  );
}
