import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Document, TextChunk, Message, AppSettings, ChatSession } from '../types';

interface NexusDB extends DBSchema {
  documents: {
    key: string;
    value: Document;
  };
  chunks: {
    key: string;
    value: TextChunk;
    indexes: { 'by-doc': string };
  };
  sessions: {
    key: string;
    value: ChatSession;
  };
  messages: {
    key: string;
    value: Message;
    indexes: { 'by-session': string };
  };
  settings: {
    key: string;
    value: AppSettings;
  };
}

const DB_NAME = 'nexus-rag-db';
const DB_VERSION = 2; // Upgraded version

let dbPromise: Promise<IDBPDatabase<NexusDB>>;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<NexusDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('chunks')) {
          const store = db.createObjectStore('chunks', { keyPath: 'id' });
          store.createIndex('by-doc', 'docId');
        }
        
        // Version 2: Add Sessions and Update Messages
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('by-session', 'sessionId');
        } else {
           // If upgrading from v1, we might need to add the index
           const msgStore = transaction.objectStore('messages');
           if (!msgStore.indexNames.contains('by-session')) {
             msgStore.createIndex('by-session', 'sessionId');
           }
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
};

export const dbService = {
  // Documents
  async getAllDocuments(): Promise<Document[]> {
    const db = await initDB();
    return db.getAll('documents');
  },
  async addDocument(doc: Document) {
    const db = await initDB();
    return db.put('documents', doc);
  },
  async deleteDocument(id: string) {
    const db = await initDB();
    await db.delete('documents', id);
    // Delete associated chunks
    const tx = db.transaction('chunks', 'readwrite');
    const index = tx.store.index('by-doc');
    let cursor = await index.openCursor(IDBKeyRange.only(id));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  },

  // Chunks
  async getAllChunks(): Promise<TextChunk[]> {
    const db = await initDB();
    return db.getAll('chunks');
  },
  async addChunks(chunks: TextChunk[]) {
    const db = await initDB();
    const tx = db.transaction('chunks', 'readwrite');
    await Promise.all(chunks.map(chunk => tx.store.put(chunk)));
    await tx.done;
  },
  
  // Sessions
  async getAllSessions(): Promise<ChatSession[]> {
    const db = await initDB();
    // Sort by updated at desc (manual sort needed as IDB returns by key)
    const sessions = await db.getAll('sessions');
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async createSession(session: ChatSession) {
    const db = await initDB();
    return db.put('sessions', session);
  },
  async updateSession(session: ChatSession) {
    const db = await initDB();
    return db.put('sessions', session);
  },
  async deleteSession(id: string) {
    const db = await initDB();
    await db.delete('sessions', id);
    // Delete messages for this session
    const tx = db.transaction('messages', 'readwrite');
    const index = tx.store.index('by-session');
    let cursor = await index.openCursor(IDBKeyRange.only(id));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  },

  // Messages
  async getMessagesForSession(sessionId: string): Promise<Message[]> {
    const db = await initDB();
    return db.getAllFromIndex('messages', 'by-session', sessionId);
  },
  async addMessage(msg: Message) {
    const db = await initDB();
    return db.put('messages', msg);
  },
  // Deprecated global fetch
  async getAllMessages(): Promise<Message[]> {
    const db = await initDB();
    return db.getAll('messages');
  },
  async clearMessages() {
    const db = await initDB();
    return db.clear('messages');
  },

  // Settings
  async getSettings(): Promise<AppSettings | undefined> {
    const db = await initDB();
    return db.get('settings', 'app-settings');
  },
  async saveSettings(settings: AppSettings) {
    const db = await initDB();
    return db.put('settings', settings, 'app-settings');
  }
};