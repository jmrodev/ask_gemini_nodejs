// src/args/constants.js

export const DEFAULT_MODEL = 'gemini-1.5-flash-latest';
export const HISTORY_FILE_DISPLAY = './.ask_history.json'; // Para mostrar en el usage
export const LOCAL_CONTEXT_FILE_DISPLAY = './.ask_context.local'; // Para mostrar en el usage
export const GENERAL_CONTEXT_FILE_DISPLAY = '~/.ask_context.general'; // Para mostrar en el usage

// Definir los nombres de modelos directamente con sus códigos exactos
export const MODEL_NAMES_MAP = {
  LITE: 'models/gemini-2.5-flash-lite-preview-06-17',
  FLASH: 'models/gemini-2.5-flash',
  PRO: 'models/gemini-1.5-pro',
};
