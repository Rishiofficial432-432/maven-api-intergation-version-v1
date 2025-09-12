import { GoogleGenAI } from '@google/genai';

export let geminiAI: GoogleGenAI | null = null;

const initializeAiClient = (apiKey: string | null) => {
    try {
        if (apiKey && apiKey.trim().length > 10) { // Simple validation
            geminiAI = new GoogleGenAI({ apiKey });
            console.log("Gemini AI Client initialized.");
        } else {
            geminiAI = null;
            if (apiKey) {
                console.warn("Attempted to initialize Gemini with an invalid or empty key. AI features disabled.");
            }
        }
    } catch (error) {
        console.error("Error initializing Gemini AI Client:", error);
        geminiAI = null;
    }
};

export const updateApiKey = (apiKey: string | null) => {
    const keyToStore = apiKey?.trim() || '';
    if (keyToStore) {
        localStorage.setItem('gemini-api-key', keyToStore);
    } else {
        localStorage.removeItem('gemini-api-key');
    }
    initializeAiClient(keyToStore);
};

// Initial load from localStorage only
const initialKey = localStorage.getItem('gemini-api-key');

if (initialKey) {
    initializeAiClient(initialKey);
} else {
    console.warn("Gemini API key not found. AI features will be disabled until a key is provided in settings.");
}