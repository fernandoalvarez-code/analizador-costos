'use client';

import { useState, useEffect } from 'react';
import { Plus, Bot, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useUser } from '@/firebase';
import { listAgents, createAgent, updateAgent, deleteAgent } from '@/lib/agents/firestore';
import type { Agent, AgentInput } from '@/lib/agents/types';

// ── Tailwind consts ───────────────────────────────────
const CARD = 'rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-3';
const BTN_PRIMARY = 'flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors';
const BTN_GHOST = 'p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors';
const BTN_DANGER = 'p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors';
const INPUT = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white';
const LABEL = 'text-xs font-medium text-gray-600 mb-1 block';
const BADGE_ACTIVE = 'text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium';
const BADGE_INACTIVE = 'text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium';

const SEED_AGENTS: AgentInput[] = [
  {
    name: 'Técnico',
    slug: 'tecnico',
    description: 'Parámetros de corte, selección de herramienta y optimización de procesos.',
    systemPrompt:
      'Sos el asesor técnico de SECOCUT especializado en mecanizado industrial. ' +
      'Respondés consultas sobre velocidades de corte, avances, profundidades, ' +
      'selección de insertos, fresas, brocas y portaherramientas SECO. ' +
      'Cuando el usuario describe una operación, pedís: material (grupo ISO), ' +
      'operación (torneado/fresado/taladrado), máquina disponible y objetivo ' +
      '(productividad o calidad superficial). Con esos datos dás parámetros concretos.',
    tone: 'tecnico',
    color: '#1a1a1a',
    icon: 'Wrench',
    knowledgeCategories: ['catalogo', 'parametros', 'faq'],
    isActive: true,
    createdBy: '',
  },
  {
    name: 'Comercial',
    slug: 'comercial',
    description: 'Cotizaciones, disponibilidad de productos y pedidos.',
    systemPrompt:
      'Sos el asesor comercial de SECOCUT. Ayudás a clientes con cotizaciones, ' +
      'disponibilidad de herramientas SECO, tiempos de entrega y condiciones comerciales. ' +
      'Cuando alguien pide precio o disponibilidad, solicitás: código de producto o ' +
      'descripción, cantidad aproximada y urgencia. Explicás que los precios finales ' +
      'los confirma el equipo comercial pero podés dar orientación general.',
    tone: 'formal',
    color: '#2563eb',
    icon: 'ShoppingCart',
    knowledgeCategories: ['precios', 'catalogo', 'politicas'],
    isActive: true,
    createdBy: '',
  },
  {
    name: 'Vendedor',
    slug: 'vendedor',
    description: 'Prospección de clientes y seguimiento comercial.',
    systemPrompt:
      'Sos el asistente de prospección de SECOCUT. Ayudás al equipo de ventas a ' +
      'identificar oportunidades, preparar argumentos de valor para clientes metal- ' +
      'mecánicos y redactar mensajes de seguimiento. Conocés los diferenciales de ' +
      'SECOTOOLS: productividad, vida útil de herramienta y soporte técnico local.',
    tone: 'cercano',
    color: '#16a34a',
    icon: 'Users',
    knowledgeCategories: ['faq', 'politicas'],
    isActive: true,
    createdBy: '',
  },
];

const TONE_OPTIONS: Array<{ value: AgentInput['tone']; label: string }> = [
  { value: 'tecnico', label: 'Técnico' },
  { value: 'formal', label: 'Formal' },
  { value: 'cercano', label: 'Cercano' },
];

const KB_CATEGORIES = ['catalogo', 'parametros', 'precios', 'faq', 'politicas'];

function AgentModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<AgentInput>;
  onSave: (data: AgentInput) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<AgentInput>({
    name: '',
    slug: '',
    description: '',
    systemPrompt: '',
    tone: 'tecnico',
    color: '#1a1a1a',
    icon: 'Bot',
    knowledgeCategories: [],
    isActive: true,
    createdBy: '',
    ...initial,
  });
  const [saving, setSaving] = useState(false);

  const set = (field: keyof AgentInput, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleCategory = (cat: string) => {
    set(
      'knowledgeCategories',
      form.knowledgeCategories.includes(cat)
        ? form.knowledgeCategories.filter((c) => c !== cat)
        : [...form.knowledgeCategories, cat]
    );
  };

  const handleSave = async () => {
    if (!form.name || !form.slug || !form.systemPrompt) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4">
        <h2 className="text-base font-medium text-gray-900">
          {initial?.name ? `Editar — ${initial.name}` : 'Nuevo agente'}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Nombre</label>
            <input className={INPUT} value={form.name}
              onChange={(e) => set('name', e.target.value)} placeholder="Técnico" />
          </div>
          <div>
            <label className={LABEL}>Slug</label>
            <input className={INPUT} value={form.slug}
              onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="tecnico" />
          </div>
        </div>

        <div>
          <label className={LABEL}>Descripción corta</label>
          <input className={INPUT} value={form.description}
            onChange={(e) => set('description', e.target.value)} />
        </div>

        <div>
          <label className={LABEL}>System prompt</label>
          <textarea className={`${INPUT} min-h-[120px] resize-y`} value={form.systemPrompt}
            onChange={(e) => set('systemPrompt', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Tono</label>
            <select className={INPUT} value={form.tone}
              onChange={(e) => set('tone', e.target.value as AgentInput['tone'])}>
              {TONE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Color (hex)</label>
            <div className="flex gap-2">
              <input type="color" value={form.color}
                onChange={(e) => set('color', e.target.value)}
                className="h-9 w-12 rounded border border-gray-200 cursor-pointer" />
              <input className={INPUT} value={form.color}
                onChange={(e) => set('color', e.target.value)} />
            </div>
          </div>
        </div>

        <div>
          <label className={LABEL}>Categorías de base de conocimiento</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {KB_CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => toggleCategory(cat)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  form.knowledgeCategories.includes(cat)
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : 'border-gray-200 text-gray-600 hover:border-orange-300'
                }`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminAgentsPage() {
  const { user } = useUser();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; agent?: Agent }>({ open: false });
  const [seeding, setSeeding] = useState(false);

  const isAdmin = user?.email?.endsWith('@secocut.com') ?? false;

  const load = async () => {
    setLoading(true);
    const list = await listAgents(false);
    setAgents(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Acceso restringido a administradores SECOCUT.
      </div>
    );
  }

  const handleCreate = async (data: AgentInput) => {
    await createAgent({ ...data, createdBy: user?.email ?? '' });
    setModal({ open: false });
    await load();
  };

  const handleUpdate = async (id: string, data: AgentInput) => {
    await updateAgent(id, data);
    setModal({ open: false });
    await load();
  };

  const handleToggle = async (agent: Agent) => {
    await updateAgent(agent.id, { isActive: !agent.isActive });
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este agente? Esta acción no se puede deshacer.')) return;
    await deleteAgent(id);
    await load();
  };

  const handleSeed = async () => {
    if (!confirm('¿Crear los 3 agentes de ejemplo (Técnico, Comercial, Vendedor)?')) return;
    setSeeding(true);
    for (const a of SEED_AGENTS) {
      await createAgent({ ...a, createdBy: user?.email ?? '' });
    }
    setSeeding(false);
    await load();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Agentes IA</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {agents.length} agente{agents.length !== 1 ? 's' : ''} configurado{agents.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {agents.length === 0 && (
            <button onClick={handleSeed} disabled={seeding}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
              {seeding ? 'Creando...' : '✦ Crear agentes de ejemplo'}
            </button>
          )}
          <button onClick={() => setModal({ open: true })} className={BTN_PRIMARY}>
            <Plus size={16} /> Nuevo agente
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 text-center py-12">Cargando...</div>
      ) : agents.length === 0 ? (
        <div className="text-center py-16 flex flex-col items-center gap-3">
          <Bot size={40} className="text-gray-300" />
          <p className="text-sm text-gray-500">
            No hay agentes todavía. Creá uno o usá los agentes de ejemplo para empezar.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {agents.map((agent) => (
            <div key={agent.id} className={CARD}>
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: agent.color }}
                >
                  <Bot size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 text-sm">{agent.name}</span>
                    <span className="text-xs text-gray-400 font-mono">/{agent.slug}</span>
                    <span className={agent.isActive ? BADGE_ACTIVE : BADGE_INACTIVE}>
                      {agent.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{agent.description}</p>
                  {agent.knowledgeCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {agent.knowledgeCategories.map((cat) => (
                        <span key={cat}
                          className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handleToggle(agent)} className={BTN_GHOST}
                    title={agent.isActive ? 'Desactivar' : 'Activar'}>
                    {agent.isActive
                      ? <ToggleRight size={18} className="text-green-500" />
                      : <ToggleLeft size={18} />}
                  </button>
                  <button onClick={() => setModal({ open: true, agent })} className={BTN_GHOST}
                    title="Editar">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => handleDelete(agent.id)} className={BTN_DANGER}
                    title="Eliminar">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <AgentModal
          initial={modal.agent}
          onSave={modal.agent
            ? (data) => handleUpdate(modal.agent!.id, data)
            : handleCreate}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  );
}
