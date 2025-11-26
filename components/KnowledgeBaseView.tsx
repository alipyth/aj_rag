
import React, { useRef } from 'react';
import { Document } from '../types';
import { Plus, Trash2, FileText, Search, Database, CheckCircle2, Cpu, Loader2, Edit2, Save, AlertCircle, UploadCloud, FileType } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';

interface KnowledgeBaseViewProps {
  documents: Document[];
  onAddDocument: (input: { title?: string, content?: string, file?: File }) => Promise<void> | void;
  onRemoveDocument: (id: string) => void;
  onUpdateDocument: (doc: Document) => void;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({
  documents,
  onAddDocument,
  onRemoveDocument,
  onUpdateDocument
}) => {
  const [isAdding, setIsAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [newTitle, setNewTitle] = React.useState('');
  const [newContent, setNewContent] = React.useState('');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isSaving, setIsSaving] = React.useState(false); // Local loading state
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEdit = (doc: Document) => {
    setNewTitle(doc.title);
    setNewContent(doc.content);
    setEditingId(doc.id);
    setIsAdding(true);
  };

  const handleSave = async () => {
    // Validation: Require EITHER (File) OR (Content). Title is optional (defaults to Untitled/Filename)
    if (!selectedFile && !newContent.trim()) return;
    
    setIsSaving(true);
    try {
        if (editingId) {
           // Update existing
           await onUpdateDocument({ 
               id: editingId,
               title: newTitle || 'بدون عنوان',
               content: newContent,
               createdAt: Date.now(),
               status: 'indexing'
           });
        } else {
           // Add new
           await onAddDocument({
               title: newTitle,
               content: newContent,
               file: selectedFile || undefined
           });
        }
        closeForm();
    } catch (error) {
        console.error("Error saving document:", error);
        // We rely on App.tsx to show global error, but we stop loading here
    } finally {
        setIsSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setSelectedFile(e.target.files[0]);
          if (!newTitle) {
              setNewTitle(e.target.files[0].name);
          }
      }
  };

  const clearInputs = () => {
    setNewTitle('');
    setNewContent('');
    setSelectedFile(null);
    setEditingId(null);
    setIsSaving(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeForm = () => {
      clearInputs();
      setIsAdding(false);
  };

  const openForm = () => {
      clearInputs();
      setIsAdding(true);
  };

  const filteredDocs = documents.filter(d => 
    d.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center justify-center">
            <Database className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">پایگاه دانش</h2>
            <div className="flex items-center gap-2 mt-0.5">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
               <p className="text-xs text-slate-400 font-medium">{documents.length} سند برداری شده</p>
            </div>
          </div>
        </div>
        {!isAdding && (
           <Button onClick={openForm} size="sm">
             <Plus className="w-4 h-4 ml-2" />
             افزودن داده
           </Button>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        
        {/* Search */}
        {documents.length > 0 && !isAdding && (
          <div className="mb-6 relative group">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
            <input
              type="text"
              placeholder="جستجو در ایندکس وکتور..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-10 pl-4 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder-slate-600"
            />
          </div>
        )}

        {/* Add/Edit Form */}
        {isAdding && (
          <div className="mb-8 bg-slate-900/80 border border-blue-500/30 rounded-2xl p-6 animate-fade-in shadow-xl shadow-black/20 backdrop-blur-md relative overflow-hidden">
             {/* Background Effects */}
             <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -ml-10 -mt-10 pointer-events-none"></div>
             
            <h3 className="text-sm font-semibold text-blue-400 mb-4 flex items-center gap-2">
              {editingId ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />} 
              {editingId ? 'ویرایش سند' : 'افزودن سند جدید'}
            </h3>
            <div className="space-y-4">
              <Input
                placeholder="عنوان سند (اختیاری اگر فایل آپلود می‌کنید)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
                disabled={isSaving}
                className="bg-slate-950 border-slate-800"
              />

              {!editingId && (
                  <div className={`border-2 border-dashed border-slate-700 hover:border-blue-500/50 bg-slate-950/50 rounded-xl p-8 transition-all group text-center cursor-pointer relative ${isSaving ? 'opacity-50 pointer-events-none' : ''}`}>
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".txt,.md,.pdf,.docx"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            disabled={isSaving}
                        />
                        {selectedFile ? (
                             <div className="flex flex-col items-center gap-2">
                                 <FileType className="w-10 h-10 text-emerald-400" />
                                 <span className="text-emerald-400 font-medium text-sm">{selectedFile.name}</span>
                                 <span className="text-slate-500 text-xs">{(selectedFile.size / 1024).toFixed(2)} KB</span>
                             </div>
                        ) : (
                             <div className="flex flex-col items-center gap-2 pointer-events-none">
                                 <div className="p-3 bg-slate-800 rounded-full group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors text-slate-400">
                                     <UploadCloud className="w-6 h-6" />
                                 </div>
                                 <p className="text-slate-300 text-sm font-medium">فایل را اینجا رها کنید یا کلیک کنید</p>
                                 <p className="text-slate-500 text-xs">PDF, Word, TXT, MD</p>
                             </div>
                        )}
                  </div>
              )}

              <div className="relative">
                 <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <div className="h-px bg-slate-800 flex-1"></div>
                    <span className="text-xs text-slate-500 bg-slate-900 px-2">یا تایپ دستی</span>
                    <div className="h-px bg-slate-800 flex-1"></div>
                 </div>
              </div>

              <textarea
                placeholder="محتوای متنی را اینجا قرار دهید..."
                className="w-full h-32 bg-slate-950 border border-slate-800 rounded-lg p-4 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none font-mono leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                disabled={!!selectedFile || isSaving}
              />

              <div className="flex gap-3 justify-end pt-2">
                <Button variant="ghost" onClick={closeForm} size="sm" disabled={isSaving}>انصراف</Button>
                <Button 
                    onClick={handleSave} 
                    size="sm" 
                    disabled={(!newContent.trim() && !selectedFile) || isSaving}
                    isLoading={isSaving}
                >
                  {editingId ? <Save className="w-3 h-3 ml-2" /> : <Cpu className="w-3 h-3 ml-2" />}
                  {editingId ? 'ذخیره تغییرات' : 'پردازش و وکتورایز'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* List */}
        {!isAdding && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDocs.map((doc) => {
            const isIndexing = doc.status === 'indexing';
            const isError = doc.status === 'error';
            
            return (
            <div key={doc.id} className={`group bg-slate-900/40 border rounded-2xl p-5 transition-all relative overflow-hidden flex flex-col justify-between
                ${isIndexing 
                    ? 'border-blue-500/30 shadow-lg shadow-blue-500/10' 
                    : isError 
                    ? 'border-red-500/30' 
                    : 'border-slate-800 hover:border-slate-600 hover:bg-slate-900/80 hover:shadow-xl hover:-translate-y-1'}
            `}>
              
              {/* Progress Bar for Indexing */}
              {isIndexing && (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-800">
                      <div className="h-full bg-blue-500 animate-progress"></div>
                  </div>
              )}

              <div>
                <div className="flex justify-between items-start mb-3 relative z-10">
                    <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl transition-colors ${
                        isIndexing ? 'bg-blue-500/10 text-blue-400 animate-pulse' : 
                        isError ? 'bg-red-500/10 text-red-400' :
                        'bg-slate-800 text-slate-400 group-hover:bg-blue-600/20 group-hover:text-blue-400'
                    }`}>
                        {isIndexing ? <Loader2 className="w-5 h-5 animate-spin" /> : 
                         isError ? <AlertCircle className="w-5 h-5" /> : 
                         <FileText className="w-5 h-5" />}
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-200 truncate max-w-[120px] text-sm">{doc.title}</h3>
                        <div className="flex items-center gap-1 mt-0.5">
                        {isIndexing ? (
                             <span className="text-[10px] text-blue-400 font-medium">در حال پردازش فایل...</span>
                        ) : isError ? (
                             <span className="text-[10px] text-red-400 font-medium">خطا در پردازش</span>
                        ) : (
                            <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span className="text-[10px] text-slate-500 font-mono">INDEXED</span>
                            </>
                        )}
                        </div>
                    </div>
                    </div>
                    {!isIndexing && (
                        <div className="flex gap-1">
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleEdit(doc); }}
                            className="text-slate-600 hover:text-blue-400 transition-colors p-2 hover:bg-blue-400/10 rounded-lg"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onRemoveDocument(doc.id); }}
                            className="text-slate-600 hover:text-red-400 transition-colors p-2 hover:bg-red-400/10 rounded-lg"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        </div>
                    )}
                </div>
                
                <p className={`text-xs text-slate-400 mb-4 line-clamp-4 leading-relaxed relative z-10 ${isIndexing ? 'opacity-50' : 'opacity-80'}`} dir="auto">
                    {doc.content}
                </p>
              </div>
              
              <div className="flex justify-between items-center text-[10px] text-slate-600 border-t border-slate-800/50 pt-3 relative z-10" dir="ltr">
                <span className="font-mono">ID: {doc.id.slice(0, 8)}</span>
                <span className="bg-slate-800 px-2 py-1 rounded-md text-slate-400">{doc.content.length} chars</span>
              </div>
            </div>
            );
          })}
          
          {filteredDocs.length === 0 && !isAdding && (
            <div className="col-span-full text-center py-24 text-slate-500">
              <div className="inline-block p-6 bg-slate-900 rounded-3xl mb-4 border border-slate-800">
                <Database className="w-10 h-10 opacity-30" />
              </div>
              <h3 className="text-lg font-medium text-slate-300 mb-1">ایندکس خالی است</h3>
              <p className="text-sm mb-6 max-w-sm mx-auto">برای ساخت پایگاه دانش خود، فایل‌های PDF یا متنی را بارگذاری کنید.</p>
              <Button variant="secondary" onClick={openForm}>
                <Plus className="w-4 h-4 ml-2" />
                افزودن اولین سند
              </Button>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};
