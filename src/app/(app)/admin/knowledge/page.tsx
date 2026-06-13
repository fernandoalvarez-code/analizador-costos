'use client';

import { useState, useEffect } from 'react';
import { Plus, FileText, Trash2, Tag } from 'lucide-react';
import { useUser } from '@/firebase';
import {
  listKnowledgeEntries,
  createKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
} from '@/lib/agents/firestore';
import type { KnowledgeEntry, KnowledgeEntryInput } from '@/lib/agents/types';

// ── Tailwind consts ───────────────────────────────────
const CARD = 'rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-2';
const BTN_PRIMARY = 'flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors';
const BTN_DANGER = 'p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors';
const INPUT = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white';
const LABEL = 'text-xs font-medium text-gray-600 mb-1 block';

const CATEGORIES = ['catalogo', 'parametros', 'precios', 'faq', 'politicas'];
const SOURCE_TYPES: Array<{ value: KnowledgeEntryInput['sourceType']; label: string }> = [
  { value: 'manual', label: 'Texto manual' },
  { value: 'pdf', label: 'PDF' },
  { value: 'web', label: 'Web' },
];

function EntryModal({
  onSave,
  onClose,
}: {
  onSave: (data: KnowledgeEntryInput) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<KnowledgeEntryInput>({
    title: '',
    category: 'catalogo',
    content: '',
    sourceType: 'manual',
    tags: [],
    isActive: true,
    createdBy: '',
  });
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (field: keyof KnowledgeEntryInput, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) {
      set('tags', [...form.tags, t]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => set('tags', form.tags.filter((t) => t !== tag));

  const handleSave = async () => {
    if (!form.title || !form.content) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4">
        <h2 className="text-base font-medium text-gray-900">Nueva entrada</h2>

        <div>
          <label className={LABEL}>Título</label>
          <input className={INPUT} value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Ej: Velocidades recomendadas para ISO P" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Categoría</label>
            <select className={INPUT} value={form.category}
              onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Tipo de fuente</label>
            <select className={INPUT} value={form.sourceType}
              onChange={(e) => set('sourceType', e.target.value as KnowledgeEntryInput['sourceType'])}>
              {SOURCE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={LABEL}>Contenido</label>
          <textarea className={`${INPUT} min-h-[160px] resize-y`} value={form.content}
            onChange={(e) => set('content', e.target.value)}
            placeholder="Pegá el texto del catálogo, descripción del producto, FAQ, etc." />
        </div>

        <div>
          <label className={LABEL}>Tags (para búsqueda)</label>
          <div className="flex gap-2">
            <input className={INPUT} value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              placeholder="fresado, aluminio, iso-n..." />
            <button onClick={addTag}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap">
              + Tag
            </button>
          </div>
          {form.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {form.tags.map((tag) => (
                <span key={tag}
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-orange-900">×</button>
                </span>
              ))}
            </div>
          )}
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

export default function AdminKnowledgePage() {
  const { user } = useUser();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [filterCat, setFilterCat] = useState<string>('');

  const isAdmin = user?.email?.endsWith('@secocut.com') ?? false;

  const load = async () => {
    setLoading(true);
    const list = await listKnowledgeEntries(filterCat || undefined);
    setEntries(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterCat]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Acceso restringido a administradores SECOCUT.
      </div>
    );
  }

  const handleCreate = async (data: KnowledgeEntryInput) => {
    await createKnowledgeEntry({ ...data, createdBy: user?.email ?? '' });
    setModal(false);
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta entrada?')) return;
    await deleteKnowledgeEntry(id);
    await load();
  };

  const handleToggle = async (entry: KnowledgeEntry) => {
    await updateKnowledgeEntry(entry.id, { isActive: !entry.isActive });
    await load();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Base de conocimiento</h1>
          <p className="text-sm text-gray-500 mt-0.5">{entries.length} entradas</p>
        </div>
        <button onClick={() => setModal(true)} className={BTN_PRIMARY}>
          <Plus size={16} /> Nueva entrada
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterCat('')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            !filterCat ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'
          }`}>
          Todas
        </button>
        {CATEGORIES.map((cat) => (
          <button key={cat} onClick={() => setFilterCat(cat)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filterCat === cat ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 text-center py-12">Cargando...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 flex flex-col items-center gap-3">
          <FileText size={40} className="text-gray-300" />
          <p className="text-sm text-gray-500">
            No hay entradas todavía. Agregá textos de catálogo, FAQs o instrucciones.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <div key={entry.id} className={`${CARD} ${!entry.isActive ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-3">
                <FileText size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{entry.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{entry.category}</span>
                    <span className="text-xs text-gray-400">{entry.sourceType}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{entry.content}</p>
                  {entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 items-center">
                      <Tag size={10} className="text-gray-400" />
                      {entry.tags.map((tag) => (
                        <span key={tag} className="text-xs text-gray-400">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handleToggle(entry)}
                    className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                    {entry.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => handleDelete(entry.id)} className={BTN_DANGER}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <EntryModal onSave={handleCreate} onClose={() => setModal(false)} />
      )}
    </div>
  );
}
