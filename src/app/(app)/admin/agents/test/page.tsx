'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import { listAgents, listUserSessions, deleteChatSession } from '@/lib/agents/firestore';
import type { Agent, ChatSession } from '@/lib/agents/types';
import AgentChat from '@/components/agents/AgentChat';

export default function AgentTestPage() {
  const { user } = useUser();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const isAdmin = user?.email?.endsWith('@secocut.com') ?? false;

  useEffect(() => {
    listAgents(false).then((list) => {
      const order = ['tecnico', 'comercial', 'vendedor'];
      const sorted = list.sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
      setAgents(sorted);
      if (sorted.length > 0) setSelected(sorted[0]);
    });
  }, []);

  useEffect(() => {
    if (!selected || !user) return;
    listUserSessions(user.uid, selected.id)
      .then((list) => setSessions(list.slice(0, 8)))
      .catch((e) => {
        console.error('[test] listUserSessions:', e);
        setSessions([]);
      });
  }, [selected, user]);

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // evitar que también cargue la sesión
    if (!confirm('¿Eliminar esta conversación?')) return;
    await deleteChatSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (selectedSessionId === sessionId) {
      setSelectedSessionId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Acceso restringido.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-medium text-gray-900">Probar agentes</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Conversá con cada agente para validar su comportamiento.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {agents.map((agent) => {
          const isSelected = selected?.id === agent.id;
          const btnClass = isSelected
            ? 'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm border-gray-900 bg-gray-900 text-white'
            : 'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm border-gray-200 text-gray-600 hover:border-gray-400';
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => { setSelected(agent); setSelectedSessionId(null); }}
              className={btnClass}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: agent.color }}
              />
              {agent.name}
              {!agent.isActive && <span className="text-xs opacity-50">(inactivo)</span>}
            </button>
          );
        })}
      </div>

      {/* Layout dos columnas: historial al costado + chat grande */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Sidebar de historial */}
        <aside className="md:w-64 flex-shrink-0 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Conversaciones</p>
            <button
              onClick={() => setSelectedSessionId(null)}
              className="text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors"
            >
              + Nueva
            </button>
          </div>

          {sessions.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">Sin conversaciones previas.</p>
          ) : (
            <div className="flex flex-col gap-1 md:max-h-[calc(100vh-220px)] md:overflow-y-auto md:pr-1">
              {sessions.map((session) => {
                const active = selectedSessionId === session.id;
                return (
                  <div key={session.id} className="relative group">
                    <button
                      onClick={() => setSelectedSessionId(session.id)}
                      className={`w-full text-left px-3 py-2 pr-6 rounded-lg border transition-colors ${
                        active
                          ? 'border-orange-300 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <span className="block text-gray-400 text-[10px]">
                        {new Date(session.updatedAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="block text-xs text-gray-700 line-clamp-2">
                        {session.messages[0]?.content?.slice(0, 60) ?? 'Conversación'}
                      </span>
                    </button>
                    <button
                      onClick={(e) => deleteSession(session.id, e)}
                      className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-gray-200 hover:bg-red-100 hover:text-red-600 text-gray-400 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Eliminar conversación"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        {/* Chat — ocupa el resto del ancho */}
        <div className="flex-1 min-w-0">
          {selected && (
            <AgentChat
              key={selectedSessionId ?? selected.id}
              agentSlug={selected.slug}
              agentName={selected.name}
              agentColor={selected.color}
              height="h-[70vh] md:h-[calc(100vh-190px)]"
              initialSessionId={selectedSessionId}
              placeholder={`Consultá al agente ${selected.name.toLowerCase()}...`}
              className="w-full"
            />
          )}
        </div>
      </div>
    </div>
  );
}
