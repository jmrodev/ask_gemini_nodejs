// src/history/historyManager.js

import { readFileContent, writeFileContent, deleteFile } from '../lib/utils.js'
import * as C from '../constants.js'
import * as M from './messages.js'

const MAX_HISTORY_ENTRIES_PAIRS = 10 // Max pairs of user/model for loading
const MAX_HISTORY_ENTRIES_STORED = 20 // Max pairs of user/model for storing

export function loadChatHistory() {
  const fileContent = readFileContent(C.HISTORY_FILE_PATH)
  if (!fileContent.trim()) {
    return []
  }
  try {
    const historyData = JSON.parse(fileContent)
    // Limitar el historial que se carga para la API
    const recentHistory = historyData.slice(-MAX_HISTORY_ENTRIES_PAIRS * 2)

    // Convertir a formato SDK Gemini
    return recentHistory.flatMap((entry) => {
      if (
        entry &&
        typeof entry.prompt === 'string' &&
        typeof entry.response === 'string'
      ) {
        const userMsg = entry.prompt.trim()
        const modelMsg = entry.response.trim()
        const arr = []
        if (userMsg) arr.push({ role: 'user', parts: [{ text: userMsg }] })
        if (modelMsg) arr.push({ role: 'model', parts: [{ text: modelMsg }] })
        return arr
      }
      return []
    })
  } catch (e) {
    console.warn(M.WARN_HISTORY_PARSE_ERROR(C.HISTORY_FILE_PATH))
    return []
  }
}

export function saveChatHistory(newSdkHistory) {
  // Log para depuración
  console.log(
    'DEBUG: saveChatHistory recibe:',
    JSON.stringify(newSdkHistory, null, 2)
  )

  let simpleNewHistory = []
  if (Array.isArray(newSdkHistory) && newSdkHistory.length > 0) {
    simpleNewHistory = newSdkHistory
      .map((entry) => {
        const textPart =
          entry.parts && Array.isArray(entry.parts)
            ? entry.parts.find((part) => typeof part.text === 'string')?.text ||
              C.EMPTY_STRING
            : C.EMPTY_STRING
        return {
          role: entry.role,
          prompt: entry.role === 'user' ? textPart.trim() : C.EMPTY_STRING,
          response: entry.role === 'model' ? textPart.trim() : C.EMPTY_STRING,
          timestamp: new Date().toISOString(),
        }
      })
      .filter(
        (entry) =>
          (entry.prompt && entry.prompt !== '') ||
          (entry.response && entry.response !== '')
      ) // Solo guarda si hay texto real
  }

  // Log para depuración
  console.log(
    'DEBUG: simpleNewHistory a guardar:',
    JSON.stringify(simpleNewHistory, null, 2)
  )

  // Truncar el historial si es necesario
  const truncatedHistoryToSave = simpleNewHistory.slice(
    -MAX_HISTORY_ENTRIES_STORED * 2
  )

  writeFileContent(
    C.HISTORY_FILE_PATH,
    JSON.stringify(truncatedHistoryToSave, null, 2)
  )
}

export function clearChatHistory() {
  if (deleteFile(C.HISTORY_FILE_PATH)) {
    console.log(M.INFO_HISTORY_CLEARED)
  } else {
    console.log(M.INFO_NO_HISTORY_TO_CLEAR)
  }
}
