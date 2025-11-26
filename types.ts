
export type LLMProvider = 'openai' | 'openrouter' | 'ollama';
export type EmbeddingProvider = 'openai' | 'local' | 'openrouter';

export interface AppSettings {
  // Generation Settings
  provider: LLMProvider;
  openaiKey: string;
  openrouterKey: string;
  ollamaUrl: string;
  modelName: string;
  systemPrompt: string;
  strictMode: boolean;
  
  // Embedding Settings
  embeddingProvider: EmbeddingProvider;
  embeddingModel: string; // e.g., 'nomic-embed-text' or 'text-embedding-3-small'

  // Advanced RAG Settings
  ragConfig: {
    chunkSize: number;
    chunkOverlap: number;
    topK: number;
  };
}

export interface Document {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  status?: 'indexing' | 'ready' | 'error';
}

// -- GraphRAG Structures --

export interface TextChunk {
  id: string;
  docId: string;
  text: string;
  vector?: number[]; // Changed from Map to number[] for real embeddings
}

export interface Entity {
  id: string;
  name: string;
  type: 'concept' | 'person' | 'location' | 'event';
  frequency: number;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface GraphNode {
  id: string;
  type: 'doc' | 'chunk' | 'entity' | 'query';
  label: string;
  data?: any; // Reference to original object
  val?: number; // For visualization size
}

export interface GraphLink {
  source: string;
  target: string;
  type: 'contains' | 'mentions' | 'related' | 'similar_to';
  weight?: number;
}

export interface RetrievalContext {
  chunkId: string;
  docId: string;
  docTitle: string;
  content: string;
  score: number;
  relatedEntities: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  preview: string; // Last message preview
}

export interface Message {
  id: string;
  sessionId: string; // Link to ChatSession
  role: 'user' | 'assistant' | 'system';
  content: string;
  retrievedContext?: RetrievalContext[];
  timestamp: number;
  isThinking?: boolean;
}