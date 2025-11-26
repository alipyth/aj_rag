
import React, { useEffect, useRef, useState } from 'react';
import { Message, AppSettings, RetrievalContext, Document } from '../types';
import { Send, Bot, User, BrainCircuit, Sparkles, AlertCircle, FileText, ChevronLeft, Search, BarChart3, Share2, XCircle, GitFork } from 'lucide-react';
import { GraphView } from './GraphView';

interface ChatViewProps {
  messages: Message[];
  settings: AppSettings;
  onSendMessage: (text: string) => void;
  onViewDocument: (docId: string, type?: string) => void;
  isLoading: boolean;
  documents: Document[];
}

interface GraphModalState {
  isOpen: boolean;
  query?: string;
  context?: RetrievalContext[];
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  settings,
  onSendMessage,
  onViewDocument,
  isLoading,
  documents
}) => {
  const [input, setInput] = React.useState('');
  const [graphModal, setGraphModal] = React.useState<GraphModalState>({ isOpen: false });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
  };

  const openGraphForMessage = (queryText: string, context: RetrievalContext[]) => {
    setGraphModal({
      isOpen: true,
      query: queryText,
      context: context
    });
  };

  const getScoreBarColor = (score: number) => {
      if (score > 0.6) return 'bg-emerald-500';
      if (score > 0.3) return 'bg-amber-500';
      return 'bg-red-500';
  }

  // Find the user query corresponding to an assistant response
  const findUserQuery = (msgIndex: number): string => {
    if (msgIndex > 0 && messages[msgIndex - 1].role === 'user') {
      return messages[msgIndex - 1].content;
    }
    return 'Context Query';
  };

  // Helper to deduplicate retrieval context by Document ID
  const getUniqueContexts = (contexts: RetrievalContext[]) => {
     if (!contexts) return [];
     const grouped = new Map<string, RetrievalContext[]>();
     contexts.forEach(ctx => {
         const existing = grouped.get(ctx.docId) || [];
         grouped.set(ctx.docId, [...existing, ctx]);
     });
     return Array.from(grouped.entries()).map(([docId, items]) => {
         const bestItem = items.reduce((prev, curr) => (prev.score > curr.score ? prev : curr));
         return { ...bestItem, chunkCount: items.length };
     });
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 relative">
      
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 z-10 scroll-smooth">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-8 animate-fade-in pb-20">
            <div className="relative group cursor-default">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-900/20 z-10 relative group-hover:scale-105 transition-transform duration-500">
                <Sparkles className="w-12 h-12 text-white" />
              </div>
              <div className="absolute inset-0 bg-blue-600 blur-3xl opacity-20 animate-pulse group-hover:opacity-40 transition-opacity" />
            </div>
            
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold text-slate-100 tracking-tight">سیستم نکسوس RAG</h2>
              <p className="text-slate-400 text-base max-w-sm mx-auto leading-relaxed">
                دستیار هوشمند با قابلیت جستجو در اسناد شما. 
                <br/>
                فایل‌های خود را بارگذاری کنید و شروع به گفتگو نمایید.
              </p>
            </div>

            <div className="flex gap-4 text-xs">
              <span className="bg-slate-900/80 border border-slate-800 px-4 py-2 rounded-xl backdrop-blur-sm flex items-center gap-2 shadow-sm">
                سرویس: <strong className="text-blue-400 capitalize font-mono text-sm">{settings.provider}</strong>
              </span>
              <span className="bg-slate-900/80 border border-slate-800 px-4 py-2 rounded-xl backdrop-blur-sm flex items-center gap-2 shadow-sm">
                حالت: <strong className={settings.strictMode ? "text-emerald-400" : "text-amber-400"}>{settings.strictMode ? 'Strict' : 'Creative'}</strong>
              </span>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto w-full space-y-8 px-2">
            {messages.map((msg, idx) => (
            <div
                key={msg.id}
                className={`flex w-full gap-5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-fade-in`}
            >
                {/* Avatar */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg h-fit border border-white/5 ${
                    msg.role === 'user' 
                    ? 'bg-slate-700/50' 
                    : 'bg-gradient-to-br from-indigo-500 to-blue-600'
                }`}>
                    {msg.role === 'user' ? <User className="w-5 h-5 text-slate-300" /> : <Bot className="w-6 h-6 text-white" />}
                </div>

                {/* Message Content Wrapper */}
                <div className={`flex flex-col gap-2 max-w-[85%] sm:max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    
                    {/* User Name / Bot Name */}
                    <span className="text-[11px] text-slate-500 px-1 font-medium opacity-70">
                        {msg.role === 'user' ? 'شما' : 'هوش مصنوعی'}
                    </span>

                    {/* RAG Context (Only for Assistant) */}
                    {msg.role === 'assistant' && msg.retrievedContext && msg.retrievedContext.length > 0 && (
                    <div className="bg-slate-900/40 border border-indigo-500/20 rounded-xl p-3 w-full backdrop-blur-md mb-2 max-w-lg">
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-indigo-500/10">
                            <div className="flex items-center gap-2">
                                <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" />
                                <span className="text-xs font-bold text-indigo-200">منابع استخراج شده</span>
                            </div>
                            <span className="text-[10px] bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-full font-mono border border-indigo-500/10">
                                {getUniqueContexts(msg.retrievedContext).length} Source(s)
                            </span>
                        </div>
                        
                        <div className="space-y-1.5">
                        {getUniqueContexts(msg.retrievedContext).map((ctx) => (
                            <button
                                key={ctx.docId}
                                className="flex items-center justify-between w-full group bg-slate-950/50 hover:bg-slate-800 border border-slate-800/50 hover:border-indigo-500/30 p-2 rounded-lg transition-all text-right"
                                onClick={() => onViewDocument(ctx.docId, 'doc')}
                            >
                                <div className="flex items-center gap-2 overflow-hidden flex-1">
                                    <FileText className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 transition-colors shrink-0" />
                                    <span className="text-xs text-slate-400 group-hover:text-slate-200 truncate" dir="auto">{ctx.docTitle}</span>
                                </div>
                                <div className="w-12 h-1 bg-slate-800 rounded-full ml-2 overflow-hidden shrink-0">
                                    <div 
                                        className={`h-full ${getScoreBarColor(ctx.score)}`} 
                                        style={{ width: `${Math.min(ctx.score * 100, 100)}%` }}
                                    />
                                </div>
                            </button>
                        ))}
                        </div>
                        
                        <button 
                            onClick={() => openGraphForMessage(findUserQuery(idx), msg.retrievedContext!)}
                            className="mt-3 w-full flex items-center justify-center gap-2 text-[10px] text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 py-1.5 rounded-lg transition-all"
                        >
                            <GitFork className="w-3 h-3" />
                            مشاهده مسیر استنتاج در گراف
                        </button>
                    </div>
                    )}

                    {/* Text Bubble */}
                    <div
                        dir="auto"
                        className={`px-6 py-4 text-sm md:text-[15px] leading-8 whitespace-pre-wrap shadow-sm w-full text-right relative
                        ${msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm shadow-lg shadow-blue-900/20'
                            : 'bg-slate-800/60 border border-slate-700/50 text-slate-200 rounded-2xl rounded-tl-sm backdrop-blur-md'
                        }`}
                    >
                        {msg.content}
                    </div>
                    
                    {/* Timestamp */}
                    <span className="text-[10px] text-slate-600 font-mono mt-0.5 px-1 opacity-60" dir="ltr">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                </div>
            </div>
            ))}
        </div>
        
        {/* Loading Indicator */}
        {isLoading && (
            <div className="max-w-4xl mx-auto w-full flex justify-start animate-fade-in pl-14 px-2">
                <div className="bg-slate-800/40 border border-slate-700/30 px-5 py-4 rounded-2xl rounded-tl-sm flex items-center gap-2 backdrop-blur-sm">
                    <span className="text-xs text-slate-400 ml-2 font-medium animate-pulse">در حال نوشتن...</span>
                    <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className="p-4 md:p-6 bg-slate-950 border-t border-slate-800/50 z-20">
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto group">
          <input
            type="text"
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pr-5 pl-14 py-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-500/30 transition-all shadow-xl shadow-black/20 text-sm md:text-base"
            placeholder={messages.length === 0 ? "سوالی بپرسید تا شروع کنیم..." : "ادامه گفتگو..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            dir="auto"
            autoFocus
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-700 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-900/20"
          >
            <Send className="w-5 h-5 rotate-180" />
          </button>
        </form>
        {settings.provider === 'ollama' && (
           <div className="text-center mt-2 opacity-60 hover:opacity-100 transition-opacity">
               <span className="text-[10px] text-slate-500 font-mono flex items-center justify-center gap-1">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                 Local Ollama Active
               </span>
           </div>
        )}
      </div>

      {/* Graph Modal */}
      {graphModal.isOpen && (
        <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
           <div className="w-full h-full max-w-6xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col">
              <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-900/50">
                  <div className="flex flex-col">
                    <h3 className="text-slate-200 font-bold flex items-center gap-2">
                        <GitFork className="w-5 h-5 text-indigo-500" />
                        نقشه راه استنتاج (RAG Roadmap)
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">مسیر منطقی رسیدن از سوال شما به پاسخ نهایی با استفاده از اسناد</p>
                  </div>
                  <button onClick={() => setGraphModal({ isOpen: false })} className="text-slate-400 hover:text-white transition-colors bg-slate-800 p-2 rounded-lg">
                     <XCircle className="w-6 h-6" />
                  </button>
              </div>
              <div className="flex-1 relative">
                 <GraphView 
                    focusQuery={graphModal.query}
                    focusContext={graphModal.context}
                    onNodeClick={(id, type) => {
                       onViewDocument(id, type);
                    }} 
                 />
              </div>
           </div>
        </div>
      )}

    </div>
  );
};
