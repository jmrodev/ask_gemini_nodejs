// src/constants.js
import path from 'path';

// File Paths
export const HISTORY_FILE_PATH = path.join(process.cwd(), '.ask_history.json');
export const LOCAL_CONTEXT_FILE_PATH = path.join(process.cwd(), '.ask_context.local');
export const GENERAL_CONTEXT_FILE_PATH = path.join(process.env.HOME, '.ask_context.general');

// Model Names
export const DEFAULT_MODEL_NAME = 'gemini-1.5-flash-latest';
export const MODEL_NAMES = {
  LITE: 'models/gemini-2.5-flash-lite-preview-06-17',
  FLASH: 'models/gemini-2.5-flash',
  PRO: 'models/gemini-1.5-pro',
};

// Environment Variables
export const API_KEY_ENV_VAR = 'GEMINI_API_KEY';

// readline Prompts & Messages
export const INTERACTIVE_MODE_PROMPT = 'Tú: ';
export const INTERACTIVE_MODE_EXIT_CMD_1 = 'exit';
export const INTERACTIVE_MODE_EXIT_CMD_2 = 'quit';
export const INTERACTIVE_MODE_BYE = '\n¡Hasta pronto!';
export const GEMINI_RESPONSE_LABEL = 'Gemini:';

// Log Messages
export const DEBUG_API_KEY_LOADED = (length) => `DEBUG: API_KEY cargada correctamente. Longitud: ${length}`;
export const DEBUG_GEN_AI_INITIALIZED = 'DEBUG: genAI inicializado.';
export const DEBUG_MODEL_INIT_ATTEMPT = (modelName, instruction) => `DEBUG: Intentando obtener el modelo de texto: ${modelName} con systemInstruction: ${instruction}`;
export const DEBUG_MODEL_INIT_SUCCESS = 'DEBUG: Modelo de texto inicializado exitosamente.';

// Error Messages
export const ERROR_API_KEY_MISSING = 'Error: La variable de entorno GEMINI_API_KEY no está definida.';
export const FATAL_ERROR_MODEL_INIT_FAILED = (message) => `ERROR FATAL: Fallo al inicializar el modelo de texto: ${message}`;
export const FATAL_ERROR_MODEL_NOT_INITIALIZED = 'ERROR FATAL: El modelo de texto no pudo ser inicializado.';
export const ERROR_READING_FILE = (message) => `Error al leer el archivo: ${message}`;
export const ERROR_PROCESSING_IMAGE = (message) => `Error al procesar la imagen: ${message}`;
export const ERROR_API_CALL = (message) => `\nError: ${message}`;


// Warning Messages
export const WARN_CONTEXT_IGNORED_WITH_SYSTEM_INSTRUCTION = 'Advertencia: El contexto local/general no se añadió al prompt porque se especificó una --system-instruction.';

// Informational Messages
export const INFO_CHAT_MODE_START = (modelName) => `Modo Chat. Modelo: ${modelName}. Escribe '${INTERACTIVE_MODE_EXIT_CMD_1}' o '${INTERACTIVE_MODE_EXIT_CMD_2}' para salir.`;
export const INFO_STREAM_MODE_ACTIVATED = 'Modo Streaming activado.';
export const INFO_LOCAL_CONTEXT_SAVED = 'Contexto local guardado. Reinicia el script para que se cargue si --enable-context está activo.';
export const INFO_LOCAL_CONTEXT_NOT_SAVED = 'Contexto local no guardado.';

// File Content Prefixes/Suffixes for Prompt Engineering
export const FILE_CONTENT_PROMPT_PREFIX = (filename) => `Basado en el contenido del siguiente archivo, responde a mi pregunta.\n\n--- INICIO DEL ARCHIVO: ${filename} ---\n\n`;
export const FILE_CONTENT_PROMPT_SUFFIX = (originalPrompt) => `\n\n--- FIN DEL ARCHIVO ---\n\nMi pregunta es: ${originalPrompt}`;

// readline interface messages
export const RL_CLOSE_MESSAGE = ''; // Typically empty, console output handled elsewhere

// Misc
export const EMPTY_STRING = '';
export const NEW_LINE = '\n';
export const SPACE = ' ';
