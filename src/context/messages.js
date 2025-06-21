// src/context/messages.js
import chalk from 'chalk';

export const ERROR_INVALID_CONTEXT_TYPE = (type) => chalk.red(`Error: Tipo de contexto '${type}' no válido.`);

export const INFO_CONTEXT_SET_SUCCESS = (type, filePath) => chalk.green(`Contexto ${type} establecido exitosamente en ${filePath}.`);
export const INFO_CONTEXT_WILL_LOAD_IF_ENABLED = chalk.yellow(`Este contenido se cargará si --enable-context está activo.`);

export const INFO_CONTEXT_CLEARED_SUCCESS = (type, filePath) => chalk.green(`Contexto ${type} limpiado exitosamente de ${filePath}.`);
export const INFO_CONTEXT_WONT_LOAD = chalk.yellow(`Este contenido NO se cargará si --enable-context está activo.`);
export const INFO_NO_CONTEXT_TO_CLEAR = (type, filePath) => chalk.yellow(`No hay contexto ${type} para limpiar en ${filePath}.`);

// For promptForLocalContext
export const PROMPT_HEADER_LOCAL_CONTEXT = chalk.yellow('\n--- CONTEXTO DE PROYECTO LOCAL ---');

export const MSG_FORCE_NEW_CONTEXT_PROMPT_INTRO = 'Has solicitado forzar un nuevo contexto local. El contexto existente será sobrescrito.\n';
export const MSG_FORCE_NEW_CONTEXT_PROMPT_EXAMPLE = 'Cuéntame qué haremos. Por ejemplo: "Voy a programar en Node.js con MySQL y React una aplicación de escritorio para consultas a Telegram mediante el bot textcontextbot."\n';
export const MSG_FORCE_NEW_CONTEXT_PROMPT_QUESTION = '¿Tu nuevo contexto de proyecto (o deja vacío para borrar el existente)? ';

export const MSG_AUTO_PROMPT_CONTEXT_INTRO = 'Parece que no tienes un contexto de proyecto local definido para este directorio.\n';
export const MSG_AUTO_PROMPT_CONTEXT_EXPLANATION = 'Este contexto es como la "explicación de qué harás aquí".\n';
export const MSG_AUTO_PROMPT_CONTEXT_EXAMPLE = 'Cuéntame qué haremos. Por ejemplo: "Voy a programar en Node.js con MySQL y React una aplicación de escritorio para consultas a Telegram mediante el bot textcontextbot."\n';
export const MSG_AUTO_PROMPT_CONTEXT_QUESTION = '¿Tu contexto de proyecto (o deja vacío para omitir y continuar con tu pregunta inicial)? ';

export const DEBUG_SUMMARIZING_CONTEXT = chalk.blue('DEBUG: Solicitando a Gemini que resuma el contexto inicial...');
export const INFO_GEMINI_PROPOSED_CONTEXT_HEADER = chalk.yellow(`\nGemini propone este contexto:`);
export const INFO_GEMINI_PROPOSED_CONTEXT_BODY = (context) => chalk.cyan(`"${context}"`);
export const PROMPT_CONFIRM_GEMINI_CONTEXT = chalk.green('¿Es correcto? (Y/n) ');
export const INFO_ENTER_OWN_CONTEXT = chalk.yellow('Por favor, ingresa tu propio contexto o deja vacío:');
export const PROMPT_USER_CONTEXT_INPUT = chalk.green('Tu contexto: ');

export const WARN_GEMINI_PROPOSAL_FAILED = chalk.yellow('Advertencia: No se pudo generar una propuesta de contexto con Gemini. Por favor, ingresa el contexto manualmente.');
export const ERROR_GEMINI_PROPOSAL = (message) => chalk.red('Error de Gemini para propuesta de contexto:') + message;
export const PROMPT_USER_CONTEXT_MANUAL_INPUT = chalk.green('Tu contexto de proyecto (o deja vacío para omitir/borrar): ');

export const INFO_LOCAL_CONTEXT_EXISTING_CLEARED = chalk.yellow('Contexto local existente borrado.');

// Context parts text
export const CONTEXT_USER_PREFIX_LOCAL = 'CONTEXTO LOCAL: ';
export const CONTEXT_USER_PREFIX_GENERAL = 'CONTEXTO GENERAL: ';
export const CONTEXT_MODEL_UNDERSTOOD = 'Entendido.';
