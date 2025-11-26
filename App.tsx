
import React, { useState, useEffect } from 'react';
import { Message, AppSettings, Document, KnowledgeGraph, TextChunk, ChatSession } from './types';
import { SettingsView } from './components/SettingsView';
import { KnowledgeBaseView } from './components/KnowledgeBaseView';
import { ChatView } from './components/ChatView';
import { GraphView } from './components/GraphView';
import { processDocument, retrieveContext, generateCompletion, rebuildGraphFromChunks, generateChatTitle } from './services/llmTools';
import { dbService } from './services/db';
import { processFile } from './services/fileProcessor';
import { MessageSquare, Database, Settings, Menu, X, Hexagon, FileText, Quote, Loader2, AlertTriangle, PlusCircle, History, Trash2, BrainCircuit } from 'lucide-react';

const DEFAULT_SETTINGS: AppSettings = {
  provider: 'ollama',
  openaiKey: '',
  openrouterKey: '',
  ollamaUrl: 'http://localhost:11434',
  modelName: '',
  systemPrompt: 'You are Nexus, a sophisticated AI assistant.',
  strictMode: false,
  embeddingProvider: 'local',
  embeddingModel: 'nomic-embed-text',
  ragConfig: {
    chunkSize: 300,
    chunkOverlap: 50,
    topK: 5
  }
};

const TABS = {
  CHAT: 'chat',
  KNOWLEDGE: 'knowledge',
  GRAPH: 'graph',
  SETTINGS: 'settings'
};

interface NodeModalData {
    title: string;
    content: string;
    type: 'doc' | 'chunk' | 'entity' | 'query';
    score?: number;
    parentTitle?: string;
}

interface ConfirmModalData {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
}

function App() {
  // State
  const [activeTab, setActiveTab] = useState(TABS.CHAT);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [chunks, setChunks] = useState<TextChunk[]>([]);
  const [graphData, setGraphData] = useState<KnowledgeGraph>({ nodes: [], links: [] });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingNode, setViewingNode] = useState<NodeModalData | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalData | null>(null);

  // --- Initial Data Loading (IndexedDB) ---
  useEffect(() => {
    const loadData = async () => {
        try {
            // Load Settings
            const savedSettings = await dbService.getSettings();
            if (savedSettings) setSettings(savedSettings);

            // Load Documents
            const docs = await dbService.getAllDocuments();
            setDocuments(docs);

            // Load Sessions
            const savedSessions = await dbService.getAllSessions();
            setSessions(savedSessions);
            
            // Auto-select latest session or create new one if none
            if (savedSessions.length > 0) {
                // Select latest
                await loadSession(savedSessions[0].id);
            } else {
                // No sessions, create a fresh state
                handleNewChat();
            }

            // Load Chunks (Vector Store in Memory)
            const savedChunks = await dbService.getAllChunks();
            setChunks(savedChunks);

            // Rebuild Graph Visuals
            if (docs.length > 0 && savedChunks.length > 0) {
                const graph = rebuildGraphFromChunks(docs, savedChunks);
                setGraphData(graph);
            }
        } catch (e) {
            console.error("Error loading data from DB:", e);
            setError("خطا در بارگذاری دیتابیس.");
        }
    };
    loadData();
  }, []);

  // --- Session Management ---

  const loadSession = async (sessionId: string) => {
      try {
          const msgs = await dbService.getMessagesForSession(sessionId);
          setCurrentSessionId(sessionId);
          setMessages(msgs);
          setActiveTab(TABS.CHAT);
          if (window.innerWidth < 768) setIsSidebarOpen(false);
      } catch (e) {
          console.error("Failed to load session", e);
      }
  };

  const handleNewChat = () => {
      setCurrentSessionId(null);
      setMessages([]);
      setActiveTab(TABS.CHAT);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleDeleteSession = async (sessionIdToDelete: string, e: React.MouseEvent) => {
      // Critical: Stop click from bubbling to the parent div which selects the session
      e.stopPropagation();
      e.preventDefault();

      setConfirmModal({
        isOpen: true,
        title: 'حذف گفتگو',
        message: 'آیا از حذف این گفتگو مطمئن هستید؟ این عملیات غیرقابل بازگشت است.',
        onConfirm: async () => {
            try {
                await dbService.deleteSession(sessionIdToDelete);
                
                setSessions(prev => {
                    const newSessions = prev.filter(s => s.id !== sessionIdToDelete);
                    return newSessions;
                });
                
                // If we deleted the active session, switch to new chat
                if (currentSessionId === sessionIdToDelete) {
                    handleNewChat();
                }
                setConfirmModal(null);
            } catch (err) {
                console.error("Error deleting session:", err);
                setError("خطا در حذف گفتگو");
                setConfirmModal(null);
            }
        }
      });
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await dbService.saveSettings(newSettings);
  };

  // --- Chat Actions ---

  const handleSendMessage = async (text: string) => {
    let sessionId = currentSessionId;
    let isNewSession = false;

    // 1. Create Session if not exists
    if (!sessionId) {
        sessionId = crypto.randomUUID();
        isNewSession = true;
        const newSession: ChatSession = {
            id: sessionId,
            title: text.substring(0, 30) + '...', // Temporary title
            createdAt: Date.now(),
            updatedAt: Date.now(),
            preview: text.substring(0, 50)
        };
        await dbService.createSession(newSession);
        setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(sessionId);
    } else {
        // Update existing session preview
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
            const updatedSession = { ...session, updatedAt: Date.now(), preview: text.substring(0, 50) };
            await dbService.updateSession(updatedSession);
            setSessions(prev => {
                 const others = prev.filter(s => s.id !== sessionId);
                 return [updatedSession, ...others].sort((a,b) => b.updatedAt - a.updatedAt);
            });
        }
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      sessionId: sessionId,
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMsg]);
    dbService.addMessage(userMsg);

    setIsLoading(true);
    setError(null);

    try {
      // 2. Retrieval
      const context = await retrieveContext(text, chunks, settings, documents);
      
      // 3. Generation
      const responseText = await generateCompletion([...messages, userMsg], settings, context);
      
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        sessionId: sessionId,
        role: 'assistant',
        content: responseText,
        retrievedContext: context,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, assistantMsg]);
      dbService.addMessage(assistantMsg);

      // 4. Auto-Title Generation (Only for new sessions after first exchange)
      if (isNewSession) {
          // Non-blocking title generation
          generateChatTitle(text, responseText, settings).then(async (newTitle) => {
              if (sessionId) {
                  // Re-fetch to ensure we have latest state
                  const latestSessions = await dbService.getAllSessions();
                  const currentS = latestSessions.find(x => x.id === sessionId);
                  
                  if (currentS) {
                      const updated = { ...currentS, title: newTitle };
                      await dbService.updateSession(updated);
                      setSessions(prev => prev.map(x => x.id === sessionId ? updated : x));
                  }
              }
          });
      }

    } catch (e: any) {
      setError(e.message);
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        sessionId: sessionId!, // Safe non-null assertion as session is created above
        role: 'assistant',
        content: 'متاسفانه خطایی رخ داد: ' + e.message,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
      dbService.addMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDocument = async (input: { title?: string, content?: string, file?: File }) => {
    setError(null);
    let docTitle = input.title || 'Untitled';
    let docContent = input.content || '';

    if (input.file) {
        setIsLoading(true);
        try {
            const processed = await processFile(input.file);
            docTitle = processed.title;
            docContent = processed.content;
        } catch (e: any) {
            setError(e.message);
            setIsLoading(false);
            return;
        }
    }

    if (!docContent.trim()) {
        setError("محتوای سند خالی است.");
        setIsLoading(false);
        return;
    }

    const newDoc: Document = {
        id: crypto.randomUUID(),
        title: docTitle,
        content: docContent,
        createdAt: Date.now(),
        status: 'indexing'
    };

    setDocuments(prev => [...prev, newDoc]);
    setActiveTab(TABS.KNOWLEDGE);
    setIsLoading(true);

    try {
        const newChunks = await processDocument(newDoc, settings);
        
        const readyDoc = { ...newDoc, status: 'ready' } as Document;
        await dbService.addDocument(readyDoc);
        await dbService.addChunks(newChunks);

        setDocuments(prev => prev.map(d => d.id === newDoc.id ? readyDoc : d));
        
        const allChunks = [...chunks, ...newChunks];
        setChunks(allChunks);
        
        const updatedGraph = rebuildGraphFromChunks([...documents, readyDoc], allChunks);
        setGraphData(updatedGraph);

    } catch (e: any) {
        console.error("Indexing failed:", e);
        setError(e.message || "خطا در ایندکس کردن سند");
        const errorDoc = { ...newDoc, status: 'error' } as Document;
        setDocuments(prev => prev.map(d => d.id === newDoc.id ? errorDoc : d));
    } finally {
        setIsLoading(false);
    }
  };

  const handleRemoveDocument = async (id: string) => {
    setConfirmModal({
        isOpen: true,
        title: 'حذف سند',
        message: 'آیا از حذف این سند و تمامی داده‌های وکتور آن مطمئن هستید؟',
        onConfirm: async () => {
            try {
                await dbService.deleteDocument(id);

                setDocuments(prevDocs => {
                    const newDocs = prevDocs.filter(d => d.id !== id);
                    
                    // Nested update to ensure graph rebuild has access to FRESH docs and chunks
                    setChunks(prevChunks => {
                        const newChunks = prevChunks.filter(c => c.docId !== id);
                        
                        // Rebuild graph
                        const updatedGraph = rebuildGraphFromChunks(newDocs, newChunks);
                        setGraphData(updatedGraph);
                        
                        return newChunks;
                    });

                    return newDocs;
                });
                setConfirmModal(null);

            } catch (e: any) {
                console.error("Delete failed:", e);
                setError("خطا در حذف سند: " + e.message);
                setConfirmModal(null);
            }
        }
    });
  };

  const handleUpdateDocument = async (updatedDoc: Document) => {
      // For updates, we just do it silently or reuse the confirm modal if needed, 
      // but typically updates don't need confirm if it's an edit action.
      // However, since handleUpdate calls handleRemoveDocument, we need to bypass confirmation or refactor.
      // Refactoring handleUpdateDocument to be direct:
      
      try {
          setIsLoading(true);
          // 1. Delete old data directly
          await dbService.deleteDocument(updatedDoc.id);
          
          // 2. Add as new
          await handleAddDocument({ title: updatedDoc.title, content: updatedDoc.content });
          
          // Note: handleAddDocument handles UI state updates
      } catch (e: any) {
          setError("خطا در ویرایش سند: " + e.message);
          setIsLoading(false);
      }
  }

  const handleViewDocument = (id: string, type: string = 'doc') => {
      let nodeData: NodeModalData | null = null;
      if (type === 'chunk') {
          const chunk = chunks.find(c => c.id === id);
          if (chunk) {
              const parentDoc = documents.find(d => d.id === chunk.docId);
              nodeData = {
                  title: `قطعه متن (Chunk)`,
                  content: chunk.text,
                  type: 'chunk',
                  parentTitle: parentDoc?.title || 'سند ناشناس'
              };
          }
      } else if (type === 'doc') {
          const doc = documents.find(d => d.id === id);
          if (doc) {
              nodeData = {
                  title: doc.title,
                  content: doc.content,
                  type: 'doc'
              };
          }
      } else if (type === 'entity') {
           nodeData = {
               title: 'موجودیت (Entity)',
               content: `این گره نشان‌دهنده مفهوم «${id.replace('ent_', '')}» است.`,
               type: 'entity'
           };
      }
      if (nodeData) setViewingNode(nodeData);
  };

  const handleNavClick = (tab: string) => {
    setActiveTab(tab);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden" dir="rtl">
      
      {/* Mobile Sidebar Toggle */}
      <button 
        className="md:hidden fixed top-4 right-4 z-50 p-2 bg-slate-800 rounded-lg text-white shadow-lg"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 right-0 z-40 w-72 bg-slate-900 border-l border-slate-800 transform transition-transform duration-300 ease-in-out flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
        md:relative md:translate-x-0 shadow-2xl md:shadow-none
      `}>
        {/* Sidebar Header */}
        <div className="p-5 border-b border-slate-800 flex items-center gap-3 bg-slate-950/30">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Hexagon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">نکسوس RAG</h1>
            <p className="text-[10px] text-slate-400 font-mono">v3.3 • Chat AI</p>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="p-3 space-y-1">
           <div className="mb-4">
             <button 
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-900/20 transition-all font-medium text-sm group"
             >
                <PlusCircle className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                <span>گفتگوی جدید</span>
             </button>
           </div>

          <SidebarItem 
            icon={<Database className="w-4 h-4" />} 
            label="پایگاه دانش" 
            isActive={activeTab === TABS.KNOWLEDGE} 
            onClick={() => handleNavClick(TABS.KNOWLEDGE)} 
            badge={documents.length}
          />
          <SidebarItem 
            icon={<BrainCircuit className="w-4 h-4" />} 
            label="گراف دانش" 
            isActive={activeTab === TABS.GRAPH} 
            onClick={() => handleNavClick(TABS.GRAPH)} 
          />
           <SidebarItem 
              icon={<Settings className="w-4 h-4" />} 
              label="تنظیمات" 
              isActive={activeTab === TABS.SETTINGS} 
              onClick={() => handleNavClick(TABS.SETTINGS)} 
            />
        </nav>

        {/* Chat History Section */}
        <div className="flex-1 overflow-hidden flex flex-col border-t border-slate-800 mt-2">
            <div className="px-4 py-3 flex items-center gap-2 text-slate-400 bg-slate-900/50">
                <History className="w-4 h-4" />
                <span className="text-xs font-semibold">تاریخچه گفتگوها</span>
            </div>
            
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
                {sessions.length === 0 ? (
                    <div className="text-center py-8 opacity-40 px-4">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-xs">هنوز گفتگویی انجام نشده است.</p>
                    </div>
                ) : (
                    sessions.map(session => (
                        <div 
                            key={session.id}
                            onClick={() => loadSession(session.id)}
                            className={`group relative flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all border border-transparent ${
                                currentSessionId === session.id && activeTab === TABS.CHAT
                                ? 'bg-slate-800 text-white border-slate-700 shadow-sm'
                                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                            }`}
                        >
                            <div className="flex flex-col min-w-0 flex-1 pl-6">
                                <h4 className="text-sm font-medium truncate w-full leading-relaxed" dir="auto">{session.title}</h4>
                                <span className="text-[10px] opacity-60 truncate font-mono mt-0.5" dir="ltr">
                                    {new Date(session.updatedAt).toLocaleDateString('fa-IR')}
                                </span>
                            </div>
                            
                            {/* Delete Button */}
                            <button 
                                onClick={(e) => handleDeleteSession(session.id, e)}
                                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all z-20 opacity-60 hover:opacity-100"
                                title="حذف گفتگو"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* Status Footer */}
        <div className="p-3 bg-slate-950/50 text-[10px] border-t border-slate-800 flex justify-between items-center">
             <div className="flex flex-col gap-1">
                 <span className="text-slate-500">ارائه‌دهنده:</span>
                 <span className="font-mono text-indigo-400 capitalize">{settings.provider}</span>
             </div>
             {isLoading ? (
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
             ) : (
                <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : 'bg-emerald-500'}`} />
             )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative flex flex-col bg-slate-950/50 backdrop-blur-sm">
        
        {/* Global Error Banner */}
        {error && (
            <div className="bg-red-600 text-white p-3 text-sm flex flex-col md:flex-row items-center justify-between shadow-lg z-50 animate-fade-in gap-3 px-4">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span className="font-medium">{error}</span>
                </div>
                <button onClick={() => setError(null)} className="hover:bg-white/20 p-1 rounded transition-colors">
                    <X size={16} />
                </button>
            </div>
        )}

        {/* Confirmation Modal */}
        {confirmModal && confirmModal.isOpen && (
            <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 max-w-sm w-full">
                    <h3 className="text-lg font-bold text-white mb-2">{confirmModal.title}</h3>
                    <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                        {confirmModal.message}
                    </p>
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => setConfirmModal(null)}
                            className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors text-sm"
                        >
                            انصراف
                        </button>
                        <button 
                            onClick={confirmModal.onConfirm}
                            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors text-sm font-medium shadow-lg shadow-red-900/20"
                        >
                            حذف شود
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Node Citation Modal */}
        {viewingNode && (
            <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                    <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                                viewingNode.type === 'chunk' ? 'bg-amber-500/10 text-amber-500' : 
                                viewingNode.type === 'doc' ? 'bg-blue-500/10 text-blue-500' : 'bg-slate-700 text-slate-300'
                            }`}>
                                {viewingNode.type === 'chunk' ? <Quote className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-100 text-sm">
                                    {viewingNode.type === 'chunk' ? 'استناد به قطعه متن (Citation)' : 'مشاهده سند'}
                                </h3>
                                {viewingNode.parentTitle && (
                                    <p className="text-xs text-slate-400 flex items-center gap-1">
                                        از سند: <span className="text-slate-300">{viewingNode.parentTitle}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                        <button 
                            onClick={() => setViewingNode(null)}
                            className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-950/30">
                        <div className="prose prose-invert max-w-none">
                            <p className="whitespace-pre-wrap leading-loose text-slate-300 text-sm md:text-base border-r-2 border-slate-700 pr-4 mr-1">
                                {viewingNode.content}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === TABS.KNOWLEDGE && (
          <KnowledgeBaseView 
            documents={documents} 
            onAddDocument={handleAddDocument} 
            onRemoveDocument={handleRemoveDocument}
            onUpdateDocument={handleUpdateDocument}
          />
        )}
        
        {activeTab === TABS.GRAPH && (
          <div className="w-full h-full bg-slate-950 relative">
             <div className="absolute top-4 right-4 z-10 pointer-events-none">
                 <h2 className="text-2xl font-bold text-slate-100 drop-shadow-md">گراف دانش</h2>
             </div>
             <GraphView 
                graphData={graphData} 
                onNodeClick={(id, type) => handleViewDocument(id, type)} 
             />
          </div>
        )}
        
        {activeTab === TABS.CHAT && (
          <ChatView 
            messages={messages} 
            settings={settings} 
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            onViewDocument={handleViewDocument}
            documents={documents}
          />
        )}
        
        {activeTab === TABS.SETTINGS && (
          <div className="h-full overflow-y-auto">
             <SettingsView settings={settings} onSave={handleSaveSettings} />
          </div>
        )}
      </main>
    </div>
  );
}

const SidebarItem = ({ icon, label, isActive, onClick, badge }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all duration-200 ${
      isActive 
        ? 'bg-slate-800 text-white font-medium shadow-sm' 
        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
    }`}
  >
    <div className="flex items-center gap-3">
      {icon}
      <span className="text-sm">{label}</span>
    </div>
    {badge !== undefined && badge > 0 && (
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
        isActive ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-500'
      }`}>
        {badge}
      </span>
    )}
  </button>
);

export default App;
