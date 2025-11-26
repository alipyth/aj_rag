
// @ts-ignore
import * as pdfjsLibModule from 'pdfjs-dist';
// @ts-ignore
import mammoth from 'mammoth';

// Fix for ESM import of pdfjs-dist: Handle default export or named exports
const pdfjsLib = (pdfjsLibModule as any).default || pdfjsLibModule;

// Set worker source for PDF.js to the matching version on jsDelivr (standard script format)
if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
} else {
    console.warn("Nexus RAG: Could not configure PDF.js worker. PDF parsing might fail.");
}

export interface ProcessedFile {
    title: string;
    content: string;
}

export const processFile = async (file: File): Promise<ProcessedFile> => {
    const fileType = file.type;
    const fileName = file.name;
    const title = fileName.replace(/\.[^/.]+$/, ""); // Remove extension

    try {
        if (fileType === 'application/pdf') {
            const content = await readPdfFile(file);
            return { title, content };
        } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const content = await readDocxFile(file);
            return { title, content };
        } else if (fileType === 'text/plain' || fileType === 'text/markdown' || fileName.endsWith('.md') || fileName.endsWith('.txt')) {
            const content = await readTextFile(file);
            return { title, content };
        } else {
            throw new Error(`فرمت فایل پشتیبانی نمی‌شود: ${fileType}. فقط PDF, DOCX, TXT و MD مجاز هستند.`);
        }
    } catch (error: any) {
        console.error("File processing error:", error);
        throw new Error(`خطا در خواندن فایل ${fileName}: ${error.message}`);
    }
};

const readTextFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
};

const readPdfFile = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    // Using the resolved pdfjsLib object
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n\n';
    }
    
    // Simple cleanup for Persian PDFs which sometimes have weird spacing
    return fullText.replace(/\s+/g, ' ').trim();
};

const readDocxFile = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    return result.value.trim();
};
