// src/args/argParser.js

import fs from 'fs';
import path from 'path';
import { DEFAULT_MODEL, MODEL_NAMES_MAP, LOCAL_CONTEXT_FILE_DISPLAY } from './constants.js';
import { displayUsage, ERROR_MESSAGES, WARNING_MESSAGES } from './messages.js';

// Helper function to display usage and exit
function exitWithUsage(message) {
  if (message) {
    console.error(message);
  }
  displayUsage(); // displayUsage already calls process.exit(1)
}

export function parseArgs() {
  let args = process.argv.slice(2);

  let modelName = DEFAULT_MODEL;
  let interactiveChat = false;
  let stream = false;
  let userPrompt = '';
  let imagePath = '';
  let filePath = '';
  let systemInstruction = '';
  let maxOutputTokens = undefined;
  let temperature = undefined;
  let verbose = false;

  let enableChatMemory = undefined;
  let enableContext = undefined;
  let forceNewContext = false;
  let textToSpeech = null; // Text for text-to-speech conversion

  let clearHistoryFlag = false;
  let setLocalContextText = null;
  let clearLocalContextFlag = false;
  let setGeneralContextText = null;
  let clearGeneralContextFlag = false;

  let modelFlagProvided = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    switch (arg) {
      case '--flash':
        modelName = MODEL_NAMES_MAP.FLASH;
        modelFlagProvided = true;
        break;
      case '--lite':
        modelName = MODEL_NAMES_MAP.LITE;
        modelFlagProvided = true;
        break;
      case '--pro':
        modelName = MODEL_NAMES_MAP.PRO;
        modelFlagProvided = true;
        break;
      case '--chat':
        interactiveChat = true;
        break;
      case '--stream':
        stream = true;
        break;
      case '--image':
        if (nextArg) {
          imagePath = nextArg;
          i++;
        } else {
          exitWithUsage(ERROR_MESSAGES.imageRequiresPath);
        }
        break;
      case '--file':
        if (nextArg) {
          filePath = nextArg;
          i++;
        } else {
          exitWithUsage(ERROR_MESSAGES.fileRequiresPath);
        }
        break;
      case '--system-instruction':
        if (nextArg) {
          systemInstruction = nextArg;
          i++;
        } else {
          exitWithUsage(ERROR_MESSAGES.systemInstructionRequiresArg);
        }
        break;
      case '--max-tokens':
        if (nextArg && !isNaN(parseInt(nextArg))) {
          maxOutputTokens = parseInt(nextArg);
          i++;
        } else {
          exitWithUsage(ERROR_MESSAGES.maxTokensRequiresInt);
        }
        break;
      case '--temperature':
        if (nextArg && !isNaN(parseFloat(nextArg))) {
          temperature = parseFloat(nextArg);
          i++;
        } else {
          exitWithUsage(ERROR_MESSAGES.temperatureRequiresFloat);
        }
        break;
      case '--tts':
        if (nextArg) {
          textToSpeech = nextArg;
          i++;
        } else {
          exitWithUsage(ERROR_MESSAGES.ttsRequiresText);
        }
        break;
      case '--enable-chat-memory':
        enableChatMemory = true;
        break;
      case '--disable-chat-memory':
        enableChatMemory = false;
        break;
      case '--enable-context':
        enableContext = true;
        break;
      case '--disable-context':
        enableContext = false;
        break;
      case '--force-new-context':
        forceNewContext = true;
        break;
      case '--verbose':
        verbose = true;
        break;
      case '--clear-history':
        clearHistoryFlag = true;
        break;
      case '--set-context-local':
        if (nextArg !== undefined) {
          setLocalContextText = nextArg;
          i++;
        } else {
          exitWithUsage(ERROR_MESSAGES.setContextLocalRequiresArg);
        }
        break;
      case '--clear-context-local':
        clearLocalContextFlag = true;
        break;
      case '--set-context-general':
        if (nextArg !== undefined) {
          setGeneralContextText = nextArg;
          i++;
        } else {
          exitWithUsage(ERROR_MESSAGES.setContextGeneralRequiresArg);
        }
        break;
      case '--clear-context-general':
        clearGeneralContextFlag = true;
        break;
      case '--help':
        displayUsage(); // displayUsage already calls process.exit(1)
        break;
      default:
        userPrompt += (userPrompt ? ' ' : '') + arg;
        break;
    }
  }

  // --- Declarar variables de validación *después* del procesamiento de argumentos ---
  const administrativeFlags = [
    clearHistoryFlag,
    setLocalContextText !== null,
    clearLocalContextFlag,
    setGeneralContextText !== null,
    clearGeneralContextFlag,
  ];

  const hasContextSetOrClearFlags = setLocalContextText !== null || clearLocalContextFlag || setGeneralContextText !== null || clearGeneralContextFlag;

  const onlyAdministrative = administrativeFlags.some(flag => flag);

  const isNormalOperationMode = !(onlyAdministrative || hasContextSetOrClearFlags);

  // --- Validaciones de Conflictos ---
  if (onlyAdministrative) {
    const conflictingFlags = [
      interactiveChat,
      stream,
      userPrompt,
      imagePath,
      filePath,
      systemInstruction,
      maxOutputTokens !== undefined,
      temperature !== undefined,
      enableChatMemory !== undefined,
      enableContext !== undefined,
      forceNewContext,
      modelFlagProvided
    ];
    if (conflictingFlags.some(flag => flag)) {
      exitWithUsage(ERROR_MESSAGES.adminConflict);
    }

    if (setLocalContextText !== null && clearLocalContextFlag) {
      exitWithUsage(ERROR_MESSAGES.localContextConflict);
    }
    if (setGeneralContextText !== null && clearGeneralContextFlag) {
      exitWithUsage(ERROR_MESSAGES.generalContextConflict);
    }

  } else {
    // Validaciones para el modo de operación normal
    if (enableChatMemory === true && !interactiveChat) {
      exitWithUsage(ERROR_MESSAGES.enableChatMemoryWithoutChat);
    }
    if (enableChatMemory === false && interactiveChat && !clearHistoryFlag) {
      console.warn(WARNING_MESSAGES.disableChatMemoryInChat);
    }
    if (enableContext === false && hasContextSetOrClearFlags) {
        console.warn(WARNING_MESSAGES.disableContextWithSetClear);
    }
    if (forceNewContext && (interactiveChat || userPrompt === '' || filePath || imagePath)) {
      exitWithUsage(ERROR_MESSAGES.forceNewContextConditions);
    }
    const modelFlagsUsed = [args.includes('--lite'), args.includes('--flash'), args.includes('--pro')].filter(Boolean).length;
    if (modelFlagsUsed > 1) {
      exitWithUsage(ERROR_MESSAGES.multipleModelFlags);
    }

    const hasUserAction = interactiveChat || userPrompt || filePath || imagePath;
    if (isNormalOperationMode && !hasUserAction && !forceNewContext) {
      // Corrected path for local context check
      const localContextPath = path.join(process.cwd(), LOCAL_CONTEXT_FILE_DISPLAY);
      const localContextExists = (fs.existsSync(localContextPath) && fs.readFileSync(localContextPath, 'utf8').trim() !== '');
      const shouldPromptAutomatically = !localContextExists && !interactiveChat && !hasContextSetOrClearFlags && !userPrompt; 

      if (!shouldPromptAutomatically) {
        exitWithUsage(ERROR_MESSAGES.missingAction);
      }
    }


    if (interactiveChat && (imagePath || filePath || forceNewContext)) {
      exitWithUsage(ERROR_MESSAGES.chatModeConflict);
    }
    if (imagePath && filePath) {
      exitWithUsage(ERROR_MESSAGES.imageFileConflict);
    }
  }

  // Se retornan todos los argumentos parseados y las flags de estado
  return {
    modelName, interactiveChat, stream, userPrompt, imagePath, filePath,
    systemInstruction, maxOutputTokens, temperature, verbose,
    enableChatMemory, enableContext, forceNewContext,
    clearHistoryFlag, setLocalContextText, clearLocalContextFlag,
    setGeneralContextText, clearGeneralContextFlag,
    onlyAdministrative, hasContextSetOrClearFlags, isNormalOperationMode,
    modelFlagProvided
  };
}