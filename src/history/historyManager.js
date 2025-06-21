// src/history/historyManager.js

import { readFileContent, writeFileContent, deleteFile } from '../lib/utils.js';
import * as C from '../constants.js'; // Assuming C.HISTORY_FILE_PATH exists
import * as M from './messages.js';

const MAX_HISTORY_ENTRIES_PAIRS = 10; // Max pairs of user/model for loading (e.g., 10 pairs = 20 entries)
const MAX_HISTORY_ENTRIES_STORED = 20; // Max pairs of user/model for storing (e.g., 20 pairs = 40 entries)


export function loadChatHistory() {
  const fileContent = readFileContent(C.HISTORY_FILE_PATH);
  if (!fileContent.trim()) {
    return [];
  }
  try {
    const historyData = JSON.parse(fileContent);
    // Limitar el historial que se carga para la API
    const recentHistory = historyData.slice(-MAX_HISTORY_ENTRIES_PAIRS * 2); // *2 because flatMap creates two entries per original

    // Asegurarse de que el formato sea compatible con el SDK de Gemini
    return recentHistory.flatMap((entry) => {
      // Defensive check for entry structure
      if (entry && typeof entry.prompt === 'string' && typeof entry.response === 'string') {
        return [
          { role: 'user', parts: [{ text: entry.prompt }] },
          { role: 'model', parts: [{ text: entry.response }] },
        ];
      }
      return []; // Skip malformed entries
    });
  } catch (e) {
    console.warn(M.WARN_HISTORY_PARSE_ERROR(C.HISTORY_FILE_PATH));
    return [];
  }
}

export function saveChatHistory(newSdkHistory) {
  let simpleNewHistory = [];
  if (Array.isArray(newSdkHistory) && newSdkHistory.length > 0) {
    simpleNewHistory = newSdkHistory.map(entry => {
      const textPart = (entry.parts && Array.isArray(entry.parts))
                       ? (entry.parts.find(part => typeof part.text === 'string')?.text || C.EMPTY_STRING)
                       : C.EMPTY_STRING;
      return {
        role: entry.role,
        // Store prompt/response based on role, ensuring only one is populated per entry
        prompt: entry.role === 'user' ? textPart : C.EMPTY_STRING,
        response: entry.role === 'model' ? textPart : C.EMPTY_STRING,
        timestamp: new Date().toISOString()
      };
    }).filter(entry => entry.prompt || entry.response); // Filter out entries that became empty
  }

  let existingSimpleHistory = [];
  const fileContent = readFileContent(C.HISTORY_FILE_PATH);
  if (fileContent.trim() !== C.EMPTY_STRING) {
    try {
      existingSimpleHistory = JSON.parse(fileContent);
      if (!Array.isArray(existingSimpleHistory)) existingSimpleHistory = []; // Ensure it's an array
    } catch (e) {
      console.warn(M.WARN_HISTORY_CORRUPT_OVERWRITE);
      existingSimpleHistory = [];
    }
  }
  
  // Combine and truncate
  // We need to be careful here. The newSdkHistory is already in {role, parts} format.
  // We should convert the existingSimpleHistory to this format, combine, then simplify back.
  // OR, more simply, always work with the "simple" {prompt, response, timestamp} format for storage.

  // Let's assume the newSdkHistory represents the *entire* desired state from the chat instance.
  // So, we convert it directly to simpleHistory and overwrite (after truncation).
  // The `chat.getHistory()` from Gemini usually returns the whole conversation.

  // If `newSdkHistory` is what `chat.getHistory()` returns, it includes previous turns.
  // So, we just need to convert this `newSdkHistory` to `simpleHistory` format and save (after truncating).

  const allSimpleHistoryToSave = simpleNewHistory; // Already processed from newSdkHistory

  // Truncate the complete history to be saved
  const truncatedHistoryToSave = allSimpleHistoryToSave.slice(-MAX_HISTORY_ENTRIES_STORED * 2); // *2 for user/model entries

  writeFileContent(C.HISTORY_FILE_PATH, JSON.stringify(truncatedHistoryToSave, null, 2));
}


export function clearChatHistory() {
  if (deleteFile(C.HISTORY_FILE_PATH)) {
    console.log(M.INFO_HISTORY_CLEARED);
  } else {
    console.log(M.INFO_NO_HISTORY_TO_CLEAR);
  }
}