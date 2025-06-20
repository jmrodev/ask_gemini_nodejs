// src/history/historyManager.js

import path from 'path';
import chalk from 'chalk';
import { readFileContent, writeFileContent, deleteFile } from '../lib/utils.js';

// Ruta del archivo de historial (ahora usa process.cwd())
const HISTORY_FILE = path.join(process.cwd(), '.ask_history.json');

/**
 * Carga el historial de chat desde el archivo para el SDK de Gemini.
 * @returns {Array<Object>} Array de objetos de historial en formato { role: ..., parts: [...] }
 */
export function loadChatHistory() {
  const fileContent = readFileContent(HISTORY_FILE);
  if (!fileContent.trim()) {
    return [];
  }
  try {
    const historyData = JSON.parse(fileContent);
    // Limitar el historial para evitar que sea demasiado largo para la API
    const recentHistory = historyData.slice(-10);
    // Asegurarse de que el formato sea compatible con el SDK de Gemini
    return recentHistory.flatMap((entry) => [
      { role: 'user', parts: [{ text: entry.prompt }] },
      { role: 'model', parts: [{ text: entry.response }] },
    ]);
  } catch (e) {
    console.warn(
      chalk.yellow(
        `Advertencia: Error al leer/parsear el historial (${HISTORY_FILE}). Se iniciará un historial nuevo.`
      )
    );
    return [];
  }
}

/**
 * Guarda el historial de chat en el archivo.
 * @param {Array<Object>} history El historial en formato del SDK de Gemini (chat.getHistory()).
 */
export function saveChatHistory(history) {
  // CAMBIO CLAVE: Asegurar que 'history' sea un array antes de mapear
  if (!Array.isArray(history) || history.length === 0) {
    // Si no es un array o está vacío, no hay nada que guardar del turno actual
    // Pero aún necesitamos cargar el historial existente para manejar borrados o truncados.
    const fileContent = readFileContent(HISTORY_FILE);
    let existingHistory = [];
    if (fileContent.trim() !== '') {
      try {
        existingHistory = JSON.parse(fileContent);
      } catch (e) {
        console.warn(chalk.yellow('Advertencia: Historial existente corrupto. Se sobreescribirá.'));
        existingHistory = [];
      }
    }
    // Si el historial entrante es vacío/inválido, solo guardamos el existente (posiblemente truncado)
    const MAX_HISTORY_ENTRIES = 20; // Limita a 20 pares de user/model
    const combinedHistory = existingHistory.slice(-MAX_HISTORY_ENTRIES * 2); 
    writeFileContent(HISTORY_FILE, JSON.stringify(combinedHistory, null, 2));
    return; // Salir de la función si no hay historial nuevo/válido para procesar
  }

  // Si el historial es válido, proceder como antes
  const simpleHistory = history.map(entry => {
    // Asegurarse de que 'parts' exista y sea un array para evitar errores
    const textPart = entry.parts && Array.isArray(entry.parts) ? (entry.parts.find(part => part.text)?.text || '') : '';
    return {
      role: entry.role,
      prompt: entry.role === 'user' ? textPart : '',
      response: entry.role === 'model' ? textPart : '',
      timestamp: new Date().toISOString()
    };
  }).filter(entry => entry.prompt || entry.response); // Filtrar entradas vacías

  // Cargar historial existente para añadir nuevas entradas
  let existingHistory = [];
  const fileContent = readFileContent(HISTORY_FILE);
  if (fileContent.trim() !== '') {
    try {
      existingHistory = JSON.parse(fileContent);
    } catch (e) {
      console.warn(chalk.yellow('Advertencia: Historial existente corrupto. Se sobreescribirá.'));
      existingHistory = [];
    }
  }
  
  // Limitar el historial antes de guardar para no crecer indefinidamente
  const MAX_HISTORY_ENTRIES = 20; // Limita a 20 pares de user/model (40 entradas user/model)
  // Concatenar y luego cortar para mantener solo las entradas más recientes
  const combinedHistory = [...existingHistory, ...simpleHistory].slice(-MAX_HISTORY_ENTRIES * 2); 

  writeFileContent(HISTORY_FILE, JSON.stringify(combinedHistory, null, 2));
}

/**
 * Elimina el archivo de historial de chat.
 */
export function clearChatHistory() {
  if (deleteFile(HISTORY_FILE)) {
    console.log(chalk.green('Historial de chat limpiado.'));
  } else {
    console.log(chalk.yellow('No hay historial de chat para limpiar.'));
  }
}