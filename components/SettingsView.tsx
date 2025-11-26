
import React, { useState } from 'react';
import { AppSettings, LLMProvider, EmbeddingProvider } from '../types';
import { Input } from './Input';
import { Save, Server, Key, Terminal, ShieldAlert, ShieldCheck, Cpu, Layers, ListFilter, Database, BrainCircuit, AlertTriangle, CheckCircle2, Wifi, WifiOff, XCircle, Power, TerminalSquare, Globe } from 'lucide-react';
import { Button } from './Button';
import { checkOllamaConnection } from '../services/llmTools';

interface SettingsViewProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSave }) => {
  const [formData, setFormData] = React.useState<AppSettings>(settings);
  const [isDirty, setIsDirty] = React.useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const handleChange = (field: keyof AppSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleRagChange = (field: keyof AppSettings['ragConfig'], value: number) => {
    setFormData(prev => ({
        ...prev,
        ragConfig: {
            ...prev.ragConfig,
            [field]: value
        }
    }));
    setIsDirty(true);
  };

  const handleSave = () => {
    onSave(formData);
    setIsDirty(false);
  };

  const testConnection = async () => {
      setConnectionStatus('testing');
      try {
          const ok = await checkOllamaConnection(formData.ollamaUrl);
          setConnectionStatus(ok ? 'success' : 'error');
          setTimeout(() => setConnectionStatus('idle'), 5000);
      } catch (e) {
          setConnectionStatus('error');
      }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8 animate-fade-in text-right" dir="rtl">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-2xl font-bold text-slate-100">تنظیمات سیستم نکسوس</h2>
        <p className="text-slate-400 text-sm mt-1">مدیریت مدل‌های زبانی، امبدینگ‌ها و استراتژی RAG.</p>
      </div>

      {/* Embedding Settings */}
      <div className="bg-slate-900/50 p-6 rounded-xl border border-indigo-900/30 shadow-lg shadow-indigo-900/5 space-y-6">
         <h3 className="text-lg font-semibold text-indigo-400 flex items-center gap-2">
            <BrainCircuit className="w-5 h-5" />
            تنظیمات Embedding (برداری‌سازی)
         </h3>
         
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
                onClick={() => handleChange('embeddingProvider', 'local')}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all text-center h-24 ${
                    formData.embeddingProvider === 'local' 
                    ? 'border-indigo-500 bg-indigo-500/10 text-white' 
                    : 'border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
            >
                <Database className="w-6 h-6" />
                <div>
                    <div className="font-semibold text-sm">Ollama</div>
                    <div className="text-[10px] opacity-70">Local</div>
                </div>
            </button>

            <button
                onClick={() => handleChange('embeddingProvider', 'openai')}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all text-center h-24 ${
                    formData.embeddingProvider === 'openai' 
                    ? 'border-indigo-500 bg-indigo-500/10 text-white' 
                    : 'border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
            >
                <Server className="w-6 h-6" />
                <div>
                    <div className="font-semibold text-sm">OpenAI</div>
                    <div className="text-[10px] opacity-70">Cloud</div>
                </div>
            </button>

            <button
                onClick={() => handleChange('embeddingProvider', 'openrouter')}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all text-center h-24 ${
                    formData.embeddingProvider === 'openrouter' 
                    ? 'border-indigo-500 bg-indigo-500/10 text-white' 
                    : 'border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
            >
                <Globe className="w-6 h-6" />
                <div>
                    <div className="font-semibold text-sm">OpenRouter</div>
                    <div className="text-[10px] opacity-70">Cloud</div>
                </div>
            </button>
         </div>

         <Input
            label="نام مدل امبدینگ"
            value={formData.embeddingModel}
            onChange={(e) => handleChange('embeddingModel', e.target.value)}
            placeholder={
                formData.embeddingProvider === 'local' ? "nomic-embed-text" : 
                formData.embeddingProvider === 'openrouter' ? "openai/text-embedding-3-small" : 
                "text-embedding-3-small"
            }
            className="text-left font-mono"
         />
         
         {formData.embeddingProvider === 'local' && (
            <div className="bg-amber-900/10 border border-amber-500/20 p-4 rounded-xl text-xs text-amber-100/80 space-y-3">
                <div className="flex items-center gap-2 text-amber-500 font-bold text-sm border-b border-amber-500/20 pb-2">
                    <AlertTriangle className="w-5 h-5" />
                    راهنمای اتصال به Ollama
                </div>
                
                <div className="space-y-3">
                    <div className="bg-slate-950/50 p-3 rounded-lg border border-amber-500/10">
                        <p className="font-bold text-red-400 mb-2 flex items-center gap-2 text-sm">
                           <TerminalSquare className="w-4 h-4"/> 
                           خطای ترمینال: bind: Only one usage...
                        </p>
                        <p className="opacity-90 leading-relaxed text-slate-300">
                            این خطا یعنی Ollama از قبل باز است. برای رفع آن:
                            <br/>
                            ۱. به کنار ساعت ویندوز (Taskbar) بروید.
                            <br/>
                            ۲. روی آیکون Ollama راست کلیک کنید و <strong>Quit Ollama</strong> را بزنید.
                            <br/>
                            ۳. سپس دستور زیر را در ترمینال اجرا کنید.
                        </p>
                    </div>

                    <div className="bg-slate-950/50 p-3 rounded-lg border border-amber-500/10">
                        <p className="font-bold text-red-400 mb-2 flex items-center gap-2 text-sm">
                           <WifiOff className="w-4 h-4"/> 
                           خطای برنامه: Failed to fetch
                        </p>
                        <p className="opacity-90 leading-relaxed mb-2 text-slate-300">
                            مرورگر اجازه اتصال نمی‌دهد. Ollama باید حتماً با این دستور اجرا شود:
                        </p>
                        <div className="flex flex-col gap-1" dir="ltr">
                            <code className="block bg-black/40 p-2 rounded border border-white/10 font-mono text-emerald-400 select-all text-[11px]">
                                $env:OLLAMA_ORIGINS="*"; ollama serve
                            </code>
                            <span className="text-[10px] opacity-50">PowerShell (Windows)</span>
                        </div>
                    </div>
                </div>
            </div>
         )}
      </div>

      {/* Generation Settings */}
      <div className="space-y-4">
        <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
             <Cpu className="w-4 h-4" />
             مدل تولید متن (Generation Model)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(['openai', 'openrouter', 'ollama'] as LLMProvider[]).map((p) => (
            <button
              key={p}
              onClick={() => handleChange('provider', p)}
              className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                formData.provider === p
                  ? 'border-blue-500 bg-blue-500/10 text-white'
                  : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:bg-slate-800'
              }`}
            >
              {p === 'openai' && <Key className="w-6 h-6 mb-2" />}
              {p === 'openrouter' && <Globe className="w-6 h-6 mb-2" />}
              {p === 'ollama' && <Terminal className="w-6 h-6 mb-2" />}
              <span className="capitalize font-medium">{p}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Credentials */}
      <div className="space-y-6 bg-slate-900/50 p-6 rounded-xl border border-slate-800">
        
        {/* OpenAI Key */}
        {(formData.provider === 'openai' || formData.embeddingProvider === 'openai') && (
          <Input
            label="کلید API OpenAI"
            type="password"
            value={formData.openaiKey}
            onChange={(e) => handleChange('openaiKey', e.target.value)}
            placeholder="sk-..."
            className="text-left font-mono"
          />
        )}

        {/* OpenRouter Key */}
        {(formData.provider === 'openrouter' || formData.embeddingProvider === 'openrouter') && (
          <Input
            label="کلید API OpenRouter"
            type="password"
            value={formData.openrouterKey}
            onChange={(e) => handleChange('openrouterKey', e.target.value)}
            placeholder="sk-or-..."
            className="text-left font-mono"
          />
        )}

        {/* Ollama URL */}
        {(formData.provider === 'ollama' || formData.embeddingProvider === 'local') && (
          <div>
            <div className="flex items-end gap-2">
                 <div className="flex-1">
                    <Input
                        label="آدرس سرور Ollama"
                        value={formData.ollamaUrl}
                        onChange={(e) => handleChange('ollamaUrl', e.target.value)}
                        placeholder="http://localhost:11434"
                        className="text-left font-mono"
                    />
                 </div>
                 <button 
                    onClick={testConnection}
                    disabled={connectionStatus === 'testing'}
                    className={`mb-[1px] h-[42px] px-4 rounded-lg flex items-center justify-center transition-all border ${
                        connectionStatus === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 
                        connectionStatus === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                        'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                    title="تست اتصال"
                 >
                    {connectionStatus === 'testing' ? <Wifi className="w-5 h-5 animate-pulse" /> : 
                     connectionStatus === 'success' ? <CheckCircle2 className="w-5 h-5" /> : 
                     connectionStatus === 'error' ? <WifiOff className="w-5 h-5" /> :
                     <Wifi className="w-5 h-5" />}
                 </button>
            </div>
            {connectionStatus === 'error' && (
                <p className="text-red-400 text-xs mt-2 font-bold animate-pulse">
                   اتصال برقرار نشد. راهنمای بالا را بررسی کنید.
                </p>
            )}
            {connectionStatus === 'success' && (
                <p className="text-emerald-400 text-xs mt-2">اتصال با موفقیت برقرار شد.</p>
            )}
          </div>
        )}

        <Input
          label="نام مدل چت (Generation)"
          value={formData.modelName}
          onChange={(e) => handleChange('modelName', e.target.value)}
          placeholder={formData.provider === 'ollama' ? 'llama3' : 'gpt-3.5-turbo'}
          className="text-left font-mono"
        />
      </div>

      {/* RAG Settings */}
      <div className="bg-slate-900/50 p-6 rounded-xl border border-blue-900/30 shadow-lg shadow-blue-900/5 space-y-6">
         <h3 className="text-lg font-semibold text-blue-400 flex items-center gap-2">
            <Layers className="w-5 h-5" />
            تنظیمات پیشرفته RAG
         </h3>
         
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400">سایز قطعات (Chunk Size)</label>
                <input 
                    type="range" min="100" max="1000" step="50"
                    value={formData.ragConfig?.chunkSize || 300}
                    onChange={(e) => handleRagChange('chunkSize', parseInt(e.target.value))}
                    className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>100</span>
                    <span className="text-blue-400 font-bold">{formData.ragConfig?.chunkSize}</span>
                    <span>1000</span>
                </div>
             </div>

             <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400">همپوشانی (Overlap)</label>
                <input 
                    type="range" min="0" max="200" step="10"
                    value={formData.ragConfig?.chunkOverlap || 50}
                    onChange={(e) => handleRagChange('chunkOverlap', parseInt(e.target.value))}
                    className="w-full accent-blue-500"
                />
                <div className="text-center text-[10px] text-blue-400 font-mono font-bold">
                    {formData.ragConfig?.chunkOverlap}
                </div>
             </div>

             <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400">تعداد نتایج (Top K)</label>
                <select 
                    value={formData.ragConfig?.topK || 5}
                    onChange={(e) => handleRagChange('topK', parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none"
                >
                    <option value="3">3</option>
                    <option value="5">5</option>
                    <option value="10">10</option>
                </select>
             </div>
         </div>

         <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg border border-slate-800">
            <div className="flex items-center gap-3">
               {formData.strictMode ? (
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
               ) : (
                  <ShieldAlert className="w-6 h-6 text-amber-400" />
               )}
               <div>
                  <h4 className="font-medium text-slate-200">حالت سخت‌گیرانه (Strict Mode)</h4>
                  <p className="text-xs text-slate-400 mt-1">فقط پاسخگویی بر اساس اسناد</p>
               </div>
            </div>
            
            <button 
               onClick={() => handleChange('strictMode', !formData.strictMode)}
               className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.strictMode ? 'bg-emerald-500' : 'bg-slate-700'
               }`}
            >
               <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.strictMode ? '-translate-x-6' : '-translate-x-1'
               }`}/>
            </button>
         </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={!isDirty}>
          <Save className="w-4 h-4 ml-2" />
          ذخیره تنظیمات
        </Button>
      </div>
    </div>
  );
};
