// src/context/contextManager.js

import path from 'path';
import { readFileContent, writeFileContent, deleteFile } from '../lib/utils.js';
import * as C from '../constants.js'; // Assuming global constants include DEFAULT_MODEL and API_KEY_ENV_VAR
import * as M from './messages.js';

const getContextFilePath = (type) => {
  switch (type) {
    case 'local':
      return C.LOCAL_CONTEXT_FILE_PATH;
    case 'general':
      return C.GENERAL_CONTEXT_FILE_PATH;
    default:
      return null;
  }
};

export function getContextHistory(type) {
  const filePath = getContextFilePath(type);
  if (!filePath) return [];

  const content = readFileContent(filePath);
  if (content.trim()) {
    const prefix = type === 'local' ? M.CONTEXT_USER_PREFIX_LOCAL : M.CONTEXT_USER_PREFIX_GENERAL;
    return [
      { role: 'user', parts: [{ text: `${prefix}${content.trim()}` }] },
      { role: 'model', parts: [{ text: M.CONTEXT_MODEL_UNDERSTOOD }] },
    ];
  }
  return [];
}

export function setContextFile(type, content) {
  const filePath = getContextFilePath(type);
  if (!filePath) {
    console.error(M.ERROR_INVALID_CONTEXT_TYPE(type));
    return;
  }
  writeFileContent(filePath, content);
  console.log(M.INFO_CONTEXT_SET_SUCCESS(type, filePath));
  console.log(M.INFO_CONTEXT_WILL_LOAD_IF_ENABLED);
}

export function clearContextFile(type) {
  const filePath = getContextFilePath(type);
  if (!filePath) {
    console.error(M.ERROR_INVALID_CONTEXT_TYPE(type));
    return;
  }
  if (deleteFile(filePath)) {
    console.log(M.INFO_CONTEXT_CLEARED_SUCCESS(type, filePath));
    console.log(M.INFO_CONTEXT_WONT_LOAD);
  } else {
    console.log(M.INFO_NO_CONTEXT_TO_CLEAR(type, filePath));
  }
}


async function getGeminiSummary(textToSummarize) {
  // Dynamic imports to avoid circular dependencies or unused heavy libraries
  const { getGenerativeModel } = await import('../models/geminiService.js');
  const { GoogleGenerativeAI } = await import('@google/generative-ai');

  const tempGenAI = new GoogleGenerativeAI(process.env[C.API_KEY_ENV_VAR]);
  // Ensure DEFAULT_MODEL_NAME is correctly available, might need to pass it or import from a shared constants file
  const tempModel = getGenerativeModel(tempGenAI, C.DEFAULT_MODEL_NAME);

  const prompt = `Basado en el siguiente texto, genera una frase concisa (máximo 50 palabras) que sirva como contexto de proyecto para mi IA, enfocándote en la descripción de lo que haré o el propósito principal. Si el texto es una pregunta, reformúlala como una declaración de contexto. Ejemplo de formato: "Estoy desarrollando una app con X para Y". Texto: "${textToSummarize}"`;
  const result = await tempModel.generateContent(prompt);
  return result.response.text().trim();
}

async function solicitProposedContext(questionFn, contextToSummarize) {
    console.log(M.DEBUG_SUMMARIZING_CONTEXT);
    try {
      let proposedContext = await getGeminiSummary(contextToSummarize);
      console.log(M.INFO_GEMINI_PROPOSED_CONTEXT_HEADER);
      console.log(M.INFO_GEMINI_PROPOSED_CONTEXT_BODY(proposedContext));
      const confirm = await questionFn(M.PROMPT_CONFIRM_GEMINI_CONTEXT);
      if (confirm.toLowerCase() === 'n') {
        console.log(M.INFO_ENTER_OWN_CONTEXT);
        const inputContext = await questionFn(M.PROMPT_USER_CONTEXT_INPUT);
        return inputContext.trim() ? inputContext.trim() : C.EMPTY_STRING;
      }
      return proposedContext;
    } catch (e) {
      console.warn(M.WARN_GEMINI_PROPOSAL_FAILED);
      console.error(M.ERROR_GEMINI_PROPOSAL(e.message));
      return await questionFn(M.PROMPT_USER_CONTEXT_MANUAL_INPUT);
    }
}

export async function promptForLocalContext(questionFn, forceNew, initialPrompt) {
  console.log(M.PROMPT_HEADER_LOCAL_CONTEXT);
  let promptMessageText = '';
  let contextToSummarize = initialPrompt || C.EMPTY_STRING; // Ensure initialPrompt is not undefined
  const localContextFilePath = getContextFilePath('local');
  const localContextExists = localContextFilePath ? readFileContent(localContextFilePath).trim() !== C.EMPTY_STRING : false;

  if (forceNew) {
    promptMessageText = `${M.MSG_FORCE_NEW_CONTEXT_PROMPT_INTRO}${M.MSG_FORCE_NEW_CONTEXT_PROMPT_EXAMPLE}${M.MSG_FORCE_NEW_CONTEXT_PROMPT_QUESTION}`;
    // contextToSummarize is already set to initialPrompt which is required for forceNew
  } else { // shouldPromptAutomatically
    promptMessageText = `${M.MSG_AUTO_PROMPT_CONTEXT_INTRO}${M.MSG_AUTO_PROMPT_CONTEXT_EXPLANATION}${M.MSG_AUTO_PROMPT_CONTEXT_EXAMPLE}${M.MSG_AUTO_PROMPT_CONTEXT_QUESTION}`;
  }

  let proposedContext;
  if (contextToSummarize.trim()) {
    proposedContext = await solicitProposedContext(questionFn, contextToSummarize);
  } else {
    proposedContext = await questionFn(promptMessageText);
  }

  proposedContext = proposedContext.trim(); // Ensure it's trimmed after any input method

  if (proposedContext) {
    setContextFile('local', proposedContext);
    return true;
  } else {
    if (forceNew && localContextExists) {
      clearContextFile('local');
      console.log(M.INFO_LOCAL_CONTEXT_EXISTING_CLEARED);
    }
    return false;
  }
}