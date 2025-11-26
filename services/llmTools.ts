
import { AppSettings, Message, Document, RetrievalContext, TextChunk, KnowledgeGraph, GraphNode, GraphLink } from '../types';

/**
 * Nexus GraphRAG Engine
 * Implements Text Chunking, Entity Extraction, and Vector Embedding.
 */

// --- 1. NLP & Tokenization Utilities (Kept for basic keywords) ---

const PERSIAN_STOP_WORDS = new Set([
  'از', 'به', 'با', 'در', 'بر', 'برای', 'که', 'و', 'یا', 'اگر', 'ولی', 'اما', 'تا', 'را', 'این', 'آن', 'یک', 'ها', 'های', 
  'درباره', 'مورد', 'باید', 'شاید', 'هم', 'نیز', 'پس', 'چون', 'چه', 'چرا', 'بین', 'تحت', 'روی', 'طی', 'همین', 'همان', 'دیگر', 
  'هر', 'هیچ', 'همه', 'جایی', 'چیزی', 'کسی', 'بخش', 'قسمت', 'عنوان', 'مثال', 'مانند', 'مثل', 'توسط', 'طریق',
  'است', 'هست', 'بود', 'شد', 'نیست', 'می', 'نمی', 'من', 'تو', 'او', 'ما', 'شما', 'آنها', 'استفاده', 'صورت', 'انجام',
  'دارد', 'دارند', 'داشت', 'خواهند', 'کرد', 'کنند', 'کنید', 'بکنید', 'میکنند', 'میکند', 'نماید', 'گردد'
]);

// Simple tokenizer for Keyword Extraction (Graph Visualization)
export const tokenize = (text: string): string[] => {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'<>\[\]\\|]/g, " ") 
    .replace(/[\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(t => t.length > 2)
    .filter(t => !Number(t))
    .filter(t => !PERSIAN_STOP_WORDS.has(t));
};

// --- 2. Embedding Service ---

export const checkOllamaConnection = async (url: string): Promise<boolean> => {
  try {
    // Try to fetch tags which is a lightweight endpoint
    const cleanUrl = url.replace(/\/$/, '');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${cleanUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response.ok;
  } catch (e) {
    return false;
  }
};

const fetchEmbedding = async (text: string, settings: AppSettings): Promise<number[]> => {
    // Note: We do NOT try/catch here to allow the caller to handle specific connectivity errors
    
    if (settings.embeddingProvider === 'openai') {
        if (!settings.openaiKey) throw new Error("کلید API OpenAI وارد نشده است.");
        
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.openaiKey}`
            },
            body: JSON.stringify({
                input: text,
                model: settings.embeddingModel || 'text-embedding-3-small'
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(`OpenAI Error: ${err.error?.message || response.statusText}`);
        }
        
        const data = await response.json();
        return data.data[0].embedding;

    } else if (settings.embeddingProvider === 'openrouter') {
        if (!settings.openrouterKey) throw new Error("کلید API OpenRouter وارد نشده است.");

        const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${settings.openrouterKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": window.location.origin,
                "X-Title": "Nexus RAG"
            },
            body: JSON.stringify({
                model: settings.embeddingModel || 'openai/text-embedding-3-small', // Default fallback if generic
                input: text
            })
        });

        if (!response.ok) {
             const err = await response.json().catch(() => ({}));
             throw new Error(`OpenRouter Error: ${err.error?.message || response.statusText}`);
        }

        const data = await response.json();
        // OpenRouter usually mimics OpenAI structure: { data: [{ embedding: [...] }] }
        if (data.data && data.data[0] && data.data[0].embedding) {
            return data.data[0].embedding;
        } else {
             throw new Error("فرمت پاسخ OpenRouter نامعتبر است.");
        }

    } else {
        // Local (Ollama)
        const cleanUrl = settings.ollamaUrl.replace(/\/$/, '');
        const modelName = settings.embeddingModel || 'nomic-embed-text';
        
        // Add timeout to fail fast if Ollama is not running (increased to 10s for initial load)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s for local embedding

        try {
            const response = await fetch(`${cleanUrl}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: modelName,
                    prompt: text
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                // Handle 404 (Model not found) specifically
                if (response.status === 404) {
                    throw new Error(`مدل '${modelName}' پیدا نشد. دستور زیر را در ترمینال اجرا کنید:\nollama pull ${modelName}`);
                }
                throw new Error(`خطای Ollama: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            return data.embedding;
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('زمان اتصال به Ollama تمام شد. آیا برنامه اجرا شده است؟');
            }
            // Catch CORS or Network errors (Chrome often says "Failed to fetch")
            if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
                 throw new Error('خطای اتصال (CORS): لطفاً راهنمای موجود در تنظیمات را مطالعه کنید.');
            }
            throw error;
        }
    }
};

const cosineSimilarity = (vecA: number[], vecB: number[]): Promise<number> => {
    // Made async just in case we move to WASM or worker later, but sync for now
    return new Promise(resolve => {
        if (!vecA || !vecB || vecA.length !== vecB.length) {
             resolve(0);
             return;
        }
        
        let dotProduct = 0;
        let magA = 0;
        let magB = 0;
        
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            magA += vecA[i] * vecA[i];
            magB += vecB[i] * vecB[i];
        }
        
        magA = Math.sqrt(magA);
        magB = Math.sqrt(magB);
        
        if (magA === 0 || magB === 0) resolve(0);
        else resolve(dotProduct / (magA * magB));
    });
};

// --- 3. GraphRAG Indexing ---

export const chunkText = (text: string, size: number, overlap: number): string[] => {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i += (size - overlap)) {
        const chunk = words.slice(i, i + size).join(' ');
        if (chunk.length > 5) chunks.push(chunk);
        if (i + size >= words.length) break;
    }
    return chunks;
};

// Simple NER for Graph Nodes
const extractEntities = (text: string): string[] => {
    const tokens = tokenize(text);
    const freq = new Map<string, number>();
    tokens.forEach(t => freq.set(t, (freq.get(t) || 0) + 1));
    
    return [...freq.entries()]
        .filter(([_, f]) => f > 0) 
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5) 
        .map(e => e[0]);
};

// Process SINGLE Document (Embedding)
export const processDocument = async (
    doc: Document, 
    settings: AppSettings
): Promise<TextChunk[]> => {
    const chunks: TextChunk[] = [];
    
    // Check connection once
    await fetchEmbedding("test", settings);

    const textChunks = chunkText(doc.content, settings.ragConfig.chunkSize, settings.ragConfig.chunkOverlap);
    
    for (let idx = 0; idx < textChunks.length; idx++) {
        const text = textChunks[idx];
        const chunkId = `${doc.id}_chk_${idx}`;
        
        const vector = await fetchEmbedding(text, settings);
        
        const chunkObj: TextChunk = {
            id: chunkId,
            docId: doc.id,
            text: text,
            vector: vector
        };
        chunks.push(chunkObj);
    }
    return chunks;
};

// Rebuild Graph from ALL Chunks (No API calls, just visual structure)
export const rebuildGraphFromChunks = (documents: Document[], chunks: TextChunk[]): KnowledgeGraph => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const entityMap = new Map<string, string[]>();

    documents.forEach(doc => {
        nodes.push({ id: doc.id, type: 'doc', label: doc.title, val: 20 });
    });

    chunks.forEach(chunk => {
        // Chunk Node
        nodes.push({ 
            id: chunk.id, 
            type: 'chunk', 
            label: `Part`, 
            val: 10, 
            data: { text: chunk.text.substring(0, 50) + '...', fullText: chunk.text }
        });
        
        // Link Doc -> Chunk
        links.push({ source: chunk.docId, target: chunk.id, type: 'contains' });

        // Entities
        const entities = extractEntities(chunk.text);
        entities.forEach(ent => {
            const entId = `ent_${ent}`;
            if (!nodes.find(n => n.id === entId)) {
                nodes.push({ id: entId, type: 'entity', label: ent, val: 5 });
            }
            links.push({ source: chunk.id, target: entId, type: 'mentions' });
        });
    });

    return { nodes, links };
};

// --- 4. Retrieval ---

export const retrieveContext = async (
    query: string, 
    chunks: TextChunk[], 
    settings: AppSettings,
    documents: Document[]
): Promise<RetrievalContext[]> => {
    if (!query || chunks.length === 0) return [];

    // 1. Embed Query
    const queryVec = await fetchEmbedding(query, settings);

    // 2. Score Chunks
    const scoredChunks = await Promise.all(chunks.map(async chunk => {
        let score = 0;
        if (chunk.vector && queryVec) {
            score = await cosineSimilarity(queryVec, chunk.vector);
        }
        return { chunk, score };
    }));

    // 3. Top K
    const topChunks = scoredChunks
        .filter(s => s.score > 0.25) // Higher threshold for real embeddings
        .sort((a, b) => b.score - a.score)
        .slice(0, settings.ragConfig.topK);

    return topChunks.map(item => {
        const doc = documents.find(d => d.id === item.chunk.docId);
        return {
            chunkId: item.chunk.id,
            docId: item.chunk.docId,
            docTitle: doc ? doc.title : 'سند ناشناس',
            content: item.chunk.text,
            score: item.score,
            relatedEntities: extractEntities(item.chunk.text)
        };
    });
};

// --- 5. Generation ---

export const generateCompletion = async (
  messages: Message[],
  settings: AppSettings,
  context: RetrievalContext[]
): Promise<string> => {
  
  let systemMessage = settings.systemPrompt;
  
  if (settings.strictMode) {
    systemMessage = 
      "شما یک دستیار دقیق هستید. تنها و تنها بر اساس «متن‌های بازیابی شده» زیر پاسخ دهید." +
      "اگر جواب در متن‌ها نیست، بگویید نمیدانم. از دانش خودتان استفاده نکنید.";
  }

  // Inject Context
  if (context.length > 0) {
    const contextText = context.map((c, i) => 
      `[منبع ${i+1}] (عنوان: ${c.docTitle} - امتیاز: ${Math.round(c.score*100)}%)\n${c.content}`
    ).join('\n\n');
    
    systemMessage += `\n\n### CONTEXT (قطعات بازیابی شده از پایگاه دانش):\n${contextText}\n\n` +
      `دستورالعمل: با استناد به منابع بالا به سوال کاربر پاسخ فارسی و روان بدهید.`;
  } else if (settings.strictMode) {
     systemMessage += "\n\n[هشدار: هیچ سند مرتبطی یافت نشد. لطفا اعلام کنید اطلاعاتی ندارید.]";
  }

  const payloadMessages = [
    { role: 'system', content: systemMessage },
    ...messages.map(m => ({ role: m.role, content: m.content }))
  ];

  return await callLLM(payloadMessages, settings);
};

export const generateChatTitle = async (
    firstUserMessage: string, 
    firstAiResponse: string, 
    settings: AppSettings
): Promise<string> => {
    // Highly constrained prompt for short title
    const prompt = `یک عنوان بسیار کوتاه (بین ۳ تا ۵ کلمه) برای این مکالمه بنویس.
    
    سوال کاربر: ${firstUserMessage}
    پاسخ هوش مصنوعی: ${firstAiResponse}
    
    قوانین:
    ۱. عنوان باید فارسی باشد.
    ۲. فقط خود عنوان را بنویس (بدون گیومه، بدون "عنوان:"، بدون توضیح).
    ۳. حداکثر ۵ کلمه.`;
    
    const messages = [
        { role: 'system', content: 'You are a precise title generator. Output ONLY the title, max 5 words, in Persian.' },
        { role: 'user', content: prompt }
    ];

    try {
        const title = await callLLM(messages, settings);
        // Cleanup quotes or extra whitespace
        return title.replace(/["'«»]/g, '').replace(/عنوان:/g, '').trim().substring(0, 40);
    } catch (e) {
        return firstUserMessage.substring(0, 30) + '...';
    }
};

// Shared Helper for LLM Calls
const callLLM = async (messages: any[], settings: AppSettings): Promise<string> => {
    try {
        let url = '';
        let headers: Record<string, string> = { 'Content-Type': 'application/json' };
        let body: any = {};
    
        switch (settings.provider) {
          case 'openai':
            if (!settings.openaiKey) throw new Error("کلید OpenAI وارد نشده است");
            url = 'https://api.openai.com/v1/chat/completions';
            headers['Authorization'] = `Bearer ${settings.openaiKey}`;
            body = { model: settings.modelName || 'gpt-3.5-turbo', messages: messages, temperature: 0.3 };
            break;
          case 'openrouter':
            if (!settings.openrouterKey) throw new Error("کلید OpenRouter وارد نشده است");
            url = 'https://openrouter.ai/api/v1/chat/completions';
            headers['Authorization'] = `Bearer ${settings.openrouterKey}`;
            headers['HTTP-Referer'] = window.location.origin;
            headers['X-Title'] = 'Nexus RAG';
            body = { model: settings.modelName || 'openai/gpt-3.5-turbo', messages: messages };
            break;
          case 'ollama':
            url = `${settings.ollamaUrl.replace(/\/$/, '')}/api/chat`;
            body = { model: settings.modelName || 'llama3', messages: messages, stream: false, options: { temperature: 0.3 } };
            break;
        }
    
        const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
    
        return settings.provider === 'ollama' ? data.message.content : data.choices[0].message.content;
    
      } catch (error: any) {
        console.error("LLM Error:", error);
        if (error.message && error.message.includes('Failed to fetch')) {
            throw new Error(`خطای اتصال به مدل ${settings.provider}. لطفا CORS و آدرس سرور را در تنظیمات بررسی کنید.`);
        }
        throw new Error(`خطا در هوش مصنوعی: ${error.message}`);
      }
}
