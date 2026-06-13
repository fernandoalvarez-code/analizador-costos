// Agente IA — configuración completa
export interface Agent {
  id: string;
  name: string;                          // "Técnico", "Comercial", "Vendedor"
  slug: string;                          // "tecnico", "comercial", "vendedor"
  description: string;                   // Texto corto para mostrar al usuario
  systemPrompt: string;                  // Instrucciones base del agente
  tone: 'formal' | 'tecnico' | 'cercano';
  color: string;                         // Color hex para la UI, ej: "#2563eb"
  icon: string;                          // Nombre de icono Lucide, ej: "Wrench"
  knowledgeCategories: string[];         // IDs de categorías que puede consultar
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;                     // email del admin que lo creó
}

export type AgentInput = Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>;

// Entrada de base de conocimiento
export interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;                      // ej: "catalogo", "precios", "faq", "politicas"
  content: string;                       // Texto plano extraído (de PDF o manual)
  sourceType: 'pdf' | 'manual' | 'web';
  sourceFileName?: string;               // Nombre del PDF si aplica
  tags: string[];                        // Para búsqueda, ej: ["fresado", "aluminio", "iso-n"]
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export type KnowledgeEntryInput = Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>;

// Mensaje individual en una sesión de chat
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Sesión de chat completa
export interface ChatSession {
  id: string;
  agentId: string;
  agentSlug: string;
  userId: string;                        // Firebase Auth UID
  userEmail: string;
  messages: ChatMessage[];
  contextUsed: string[];                 // IDs de KnowledgeEntry que el agente consultó
  createdAt: Date;
  updatedAt: Date;
}

export type ChatSessionInput = Omit<ChatSession, 'id' | 'createdAt' | 'updatedAt'>;

// Para el panel admin — stats rápidos
export interface AgentStats {
  agentId: string;
  totalSessions: number;
  totalMessages: number;
  lastUsedAt: Date | null;
}
