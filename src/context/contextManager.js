// src/context/contextManager.js

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { readFileContent, writeFileContent, deleteFile } from '../lib/utils.js';

// Rutas de archivos de contexto (ahora usan process.cwd() y HOME para ser específicos)
const LOCAL_CONTEXT_FILE = path.join(process.cwd(), '.ask_context.local');
const GENERAL_CONTEXT_FILE = path.join(process.env.HOME, '.ask_context.general');

/**
 * Carga el contenido del contexto local o general y lo formatea como partes de historial para Gemini.
 * @param {string} type 'local' o 'general'
 * @returns {Array<Object>} Array de objetos de historial en formato { role: 'user', parts: [{ text: '...' }] }
 */
export function getContextHistory(type) {
  let filePath;
  let contextName;
  switch (type) {
    case 'local':
      filePath = LOCAL_CONTEXT_FILE;
      contextName = 'CONTEXTO LOCAL';
      break;
    case 'general':
      filePath = GENERAL_CONTEXT_FILE;
      contextName = 'CONTEXTO GENERAL';
      break;
    default:
      return [];
  }

  const content = readFileContent(filePath);
  if (content.trim()) {
    // Se añade una respuesta del modelo para simular que el modelo ha "entendido" el contexto.
    return [
      { role: 'user', parts: [{ text: `${contextName}: ${content.trim()}` }] },
      { role: 'model', parts: [{ text: 'Entendido.' }] },
    ];
  }
  return [];
}

/**
 * Establece el contenido del archivo de contexto especificado.
 * @param {string} type 'local' o 'general'
 * @param {string} content El texto a guardar en el archivo.
 */
export function setContextFile(type, content) {
  let filePath;
  let contextDisplayName;
  switch (type) {
    case 'local':
      filePath = LOCAL_CONTEXT_FILE;
      contextDisplayName = 'local';
      break;
    case 'general':
      filePath = GENERAL_CONTEXT_FILE;
      contextDisplayName = 'general';
      break;
    default:
      console.error(chalk.red(`Error: Tipo de contexto '${type}' no válido.`));
      return;
  }
  writeFileContent(filePath, content);
  console.log(chalk.green(`Contexto ${contextDisplayName} establecido exitosamente en ${filePath}.`));
  console.log(chalk.yellow(`Este contenido se cargará si --enable-context está activo.`));
}

/**
 * Elimina el archivo de contexto especificado.
 * @param {string} type 'local' o 'general'
 */
export function clearContextFile(type) {
  let filePath;
  let contextDisplayName;
  switch (type) {
    case 'local':
      filePath = LOCAL_CONTEXT_FILE;
      contextDisplayName = 'local';
      break;
    case 'general':
      filePath = GENERAL_CONTEXT_FILE;
      contextDisplayName = 'general';
      break;
    default:
      console.error(chalk.red(`Error: Tipo de contexto '${type}' no válido.`));
      return;
  }
  if (deleteFile(filePath)) {
    console.log(chalk.green(`Contexto ${contextDisplayName} limpiado exitosamente de ${filePath}.`));
    console.log(chalk.yellow(`Este contenido NO se cargará si --enable-context está activo.`));
  } else {
    console.log(chalk.yellow(`No hay contexto ${contextDisplayName} para limpiar en ${filePath}.`));
  }
}

/**
 * Pregunta interactivamente al usuario para definir el contexto local.
 * @param {function} questionFn Función para hacer preguntas al usuario (e.g., de readline).
 * @param {boolean} forceNew Indica si se está forzando un nuevo contexto (sobrescribir/borrar existente).
 * @param {string} initialPrompt El prompt inicial del usuario si existe, para que Gemini lo resuma.
 * @returns {Promise<boolean>} True si se guardó un contexto, false si se omitió.
 */
export async function promptForLocalContext(questionFn, forceNew, initialPrompt) {
  console.log(chalk.yellow('\n--- CONTEXTO DE PROYECTO LOCAL ---'));
  let promptMessage = '';
  let contextToSummarize = '';
  const localContextExists = readFileContent(LOCAL_CONTEXT_FILE).trim() !== '';

  if (forceNew) {
    promptMessage = 'Has solicitado forzar un nuevo contexto local. El contexto existente será sobrescrito.\n';
    promptMessage += 'Cuéntame qué haremos. Por ejemplo: "Voy a programar en Node.js con MySQL y React una aplicación de escritorio para consultas a Telegram mediante el bot textcontextbot."\n';
    promptMessage += '¿Tu nuevo contexto de proyecto (o deja vacío para borrar el existente)? ';
    contextToSummarize = initialPrompt; // Siempre habrá un userPrompt con --force-new-context
  } else { // shouldPromptAutomatically
    promptMessage = 'Parece que no tienes un contexto de proyecto local definido para este directorio.\n';
    promptMessage += 'Este contexto es como la "explicación de qué harás aquí".\n';
    promptMessage += 'Cuéntame qué haremos. Por ejemplo: "Voy a programar en Node.js con MySQL y React una aplicación de escritorio para consultas a Telegram mediante el bot textcontextbot."\n';
    promptMessage += '¿Tu contexto de proyecto (o deja vacío para omitir y continuar con tu pregunta inicial)? ';
    contextToSummarize = initialPrompt; // Podría ser vacío en este caso
  }

  let proposedContext = '';
  if (contextToSummarize.trim()) {
    console.log(chalk.blue('DEBUG: Solicitando a Gemini que resuma el contexto inicial...'));
    try {
      // Importación local para evitar dependencia circular o no utilizada
      const { getGenerativeModel } = await import('../models/geminiService.js');
      const { GoogleGenerativeAI } = await import('@google/generative-ai'); // Necesario para inicializar tempModel
      
      const tempGenAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const tempModel = getGenerativeModel(tempGenAI, DEFAULT_MODEL); // Usar el modelo por defecto para la consulta de resumen
      
      const result = await tempModel.generateContent(`Basado en el siguiente texto, genera una frase concisa (máximo 50 palabras) que sirva como contexto de proyecto para mi IA, enfocándote en la descripción de lo que haré o el propósito principal. Si el texto es una pregunta, reformúlala como una declaración de contexto. Ejemplo de formato: "Estoy desarrollando una app con X para Y". Texto: "${contextToSummarize}"`);
      proposedContext = result.response.text().trim();
      console.log(chalk.yellow(`\nGemini propone este contexto:`));
      console.log(chalk.cyan(`"${proposedContext}"`));
      const confirm = await questionFn(chalk.green('¿Es correcto? (Y/n) '));
      if (confirm.toLowerCase() === 'n') {
        console.log(chalk.yellow('Por favor, ingresa tu propio contexto o deja vacío:'));
        const inputContext = await questionFn(chalk.green('Tu contexto: '));
        if (inputContext.trim()) {
          proposedContext = inputContext.trim();
        } else {
          proposedContext = '';
        }
      }
    } catch (e) {
      console.warn(chalk.yellow('Advertencia: No se pudo generar una propuesta de contexto con Gemini. Por favor, ingresa el contexto manualmente.'));
      console.error(chalk.red('Error de Gemini para propuesta de contexto:'), e.message);
      proposedContext = await questionFn(chalk.green('Tu contexto de proyecto (o deja vacío para omitir/borrar): '));
    }
  } else {
    proposedContext = await questionFn(chalk.green(promptMessage));
  }

  if (proposedContext.trim()) {
    setContextFile('local', proposedContext.trim()); // Llama a la función local setContextFile
    return true; // Se guardó un contexto
  } else {
    if (forceNew && localContextExists) {
        clearContextFile('local'); // Llama a la función local clearContextFile
        console.log(chalk.yellow('Contexto local existente borrado.'));
    }
    return false; // No se guardó contexto
  }
}