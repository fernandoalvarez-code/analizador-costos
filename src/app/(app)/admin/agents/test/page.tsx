'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import { listAgents } from '@/lib/agents/firestore';
import type { Agent } from '@/lib/agents/types';
import AgentChat from '@/components/agents/AgentChat';

export default function AgentTestPage() {
  const { user } = useUser();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);

  const isAdmin = user?.email?.endsWith('@secocut.com') ?? false;

  useEffect(() => {
    listAgents(false).then((list) => {
      setAgents(list);
      if (list.length > 0) setSelected(list[0]);
    });
  }, []);

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
              onClick={() => setSelected(agent)}
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

      {selected && (
        <AgentChat
          key={selected.id}
          agentSlug={selected.slug}
          agentName={selected.name}
          agentColor={selected.color}
          height="h-[560px]"
          placeholder={`Consultá al agente ${selected.name.toLowerCase()}...`}
        />
      )}
    </div>
  );
}
