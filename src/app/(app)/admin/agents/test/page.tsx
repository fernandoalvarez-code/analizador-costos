'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import { listAgents, listUserSessions } from '@/lib/agents/firestore';
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
      .then((list) => setSessions(list.slice(0, 5)))
      .catch((e) => {
        console.error('[test] listUserSessions:', e);
        setSessions([]);
      });
  }, [selected, user]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Acceso restringido.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
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

      {sessions.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-gray-500 mb-1">Últimas conversaciones</p>
          <div className="flex gap-2 flex-wrap">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelectedSessionId(session.id)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-colors text-left"
              >
                <span className="block text-gray-400 text-[10px]">
                  {new Date(session.updatedAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="line-clamp-1">
                  {session.messages[0]?.content?.slice(0, 50) ?? 'Conversación'}...
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <AgentChat
          key={selectedSessionId ?? selected.id}
          agentSlug={selected.slug}
          agentName={selected.name}
          agentColor={selected.color}
          height="h-[calc(100vh-280px)]"
          initialSessionId={selectedSessionId}
          placeholder={`Consultá al agente ${selected.name.toLowerCase()}...`}
        />
      )}
    </div>
  );
}
