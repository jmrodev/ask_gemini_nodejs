#!/usr/bin/env node

// ask.js - Script principal para interactuar con modelos de IA

// Cargar variables de entorno para ESM
import 'dotenv/config';

// Importar SDK de Gemini
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Módulos de Node.js
import fs from 'fs'; // Necesario para leer archivos adjuntos
import path from 'path'; // Necesario para basename en file attachments

// Importar marked y TerminalRenderer
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';

// Módulos internos
import { fileToGenerativePart } from './lib/utils.js';
import { parseArgs } from './args/argParser.js'; // 'usage' ya no se exporta directamente desde aquí
import { getContextHistory, setContextFile, clearContextFile, promptForLocalContext } from './context/contextManager.js';
import { loadChatHistory, saveChatHistory, clearChatHistory as clearHistoryFile } from './history/historyManager.js'; // Renombrado para evitar conflicto
import { getGenerativeModel } from './models/geminiService.js';
import { questionUser, closeUserInput } from './lib/userInput.js';
import * as C from './constants.js'; // Importar todas las constantes

// Configurar Markdown Renderer
marked.setOptions({
  renderer: new TerminalRenderer(),
  gfm: true,
});

// Inicializar API de Gemini
const API_KEY = process.env[C.API_KEY_ENV_VAR];
if (!API_KEY) {
  console.error(C.ERROR_API_KEY_MISSING);
  process.exit(1);
}
console.log(C.DEBUG_API_KEY_LOADED(API_KEY.length));
const genAI = new GoogleGenerativeAI(API_KEY);
console.log(C.DEBUG_GEN_AI_INITIALIZED);


// --- Lógica Principal Asíncrona ---
async function run() {
  // 1. Parsear y validar argumentos
  const {
    modelName, interactiveChat, stream, userPrompt, imagePath, filePath,
    systemInstruction, maxOutputTokens, temperature, verbose,
    enableChatMemory, enableContext, forceNewContext,
    clearHistoryFlag, setLocalContextText, clearLocalContextFlag,
    setGeneralContextText, clearGeneralContextFlag,
    onlyAdministrative, hasContextSetOrClearFlags, isNormalOperationMode,
    modelFlagProvided
  } = parseArgs();

  // 2. Lógica para opciones administrativas (borrar historial/contexto, establecer contexto)
  if (onlyAdministrative) {
    if (clearHistoryFlag) {
      clearChatHistory();
    }
    if (clearLocalContextFlag) {
      clearContextFile('local');
    }
    if (setLocalContextText !== null) {
      setContextFile('local', setLocalContextText);
    }
    if (clearGeneralContextFlag) {
      clearContextFile('general');
    }
    if (setGeneralContextText !== null) {
      setContextFile('general', setGeneralContextText);
    }
   closeUserInput();
    process.exit(0);
  }

  // 3. Lógica para Preguntar/Forzar Nuevo Contexto Local (INTERACTIVO)
  const localContextExists = getContextHistory('local').length > 0;

  const shouldPromptAutomatically = isNormalOperationMode && !localContextExists && !hasContextSetOrClearFlags && !interactiveChat && !userPrompt && !filePath && !imagePath;
  const shouldForcePromptForContext = isNormalOperationMode && forceNewContext && !interactiveChat && !filePath && !imagePath && userPrompt;

  if (shouldPromptAutomatically || shouldForcePromptForContext) {
    const success = await promptForLocalContext(question, shouldForcePromptForContext, userPrompt);
    if (success) {
      console.log('Contexto local guardado. Reinicia el script para que se cargue si --enable-context está activo.');
    } else {
      console.log('Contexto local no guardado.');
    }
   closeUserInput();
    process.exit(0);
  }

  // 4. Inicialización del Modelo Gemini
  let model;
  try {
    model = getGenerativeModel(genAI, modelName, systemInstruction);
    console.log('DEBUG: Intentando obtener el modelo de texto:', modelName, 'con systemInstruction:', systemInstruction);
    console.log('DEBUG: Modelo de texto inicializado exitosamente.');
  } catch (e) {
    console.error('ERROR FATAL: Fallo al inicializar el modelo de texto:', e.message);
   closeUserInput();
    process.exit(1);
  }

  if (!model) {
      console.error('ERROR FATAL: El modelo de texto no pudo ser inicializado.');
     closeUserInput();
      process.exit(1);
  }

  // 5. Lógica principal según el modo de operación
  if (interactiveChat) {
    // --- MODO CHAT INTERACTIVO ---
    console.log(`Modo Chat. Modelo: ${modelName}. Escribe 'exit' o 'quit' para salir.`);
    if (stream) console.log('Modo Streaming activado.');

    const useChatMemory = enableChatMemory === true || (enableChatMemory === undefined);
    const useContext = enableContext === true || (enableContext === undefined);

    let initialHistory = [];
    if (useChatMemory) {
      initialHistory = loadChatHistory();
    }

    if (useContext) {
      initialHistory = [...getContextHistory('general'), ...getContextHistory('local'), ...initialHistory];
    }
    
    // Iniciar la sesión de chat con el historial y contexto combinados
    const chat = model.startChat({
      history: initialHistory,
      generationConfig: Object.keys({ maxOutputTokens, temperature }).length > 0 ? { maxOutputTokens, temperature } : undefined,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
    });

    while (true) {
      const prompt = await question('Tú: ');
      if (prompt.toLowerCase() === 'exit' || prompt.toLowerCase() === 'quit') break;
      if (!prompt) continue;

      console.log('Gemini:');
      let fullResponse = '';
      try {
        const result = stream ? await chat.sendMessageStream(prompt) : await chat.sendMessage(prompt);

        if (stream) {
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            process.stdout.write(chunkText);
            fullResponse += chunkText;
          }
          console.log();
        } else {
          fullResponse = result.response.text();
          console.log(marked(fullResponse)); // Usar marked para renderizar
        }
        if (useChatMemory) {
          saveChatHistory(chat.getHistory()); 
        }
      } catch (error) {
        console.error('\nError:', error.message);
      } finally {
        console.log('');
      }
    }
   closeUserInput();
    console.log('\n¡Hasta pronto!');
  } else {
    // --- MODO PROMPT ÚNICO (Texto/Multimodal) ---
    let contents = [];
    let finalPromptText = userPrompt;

    const useContext = enableContext === true || (enableContext === undefined);

    if (useContext && !systemInstruction) {
        const contextText = [...getContextHistory('general'), ...getContextHistory('local')].map(p => p.parts[0].text).join('\n');
        if (contextText) {
            finalPromptText = `${contextText}\n\n${userPrompt}`;
        }
    } else if (useContext && systemInstruction) {
        console.warn('Advertencia: El contexto local/general no se añadió al prompt porque se especificó una --system-instruction.');
    }

    // Manejo de archivo de texto adjunto
    if (filePath) {
      try {
        // fs y path son importados en lib/utils.js, pero leídos aquí
        // La lectura del archivo se hace con fs, que es un módulo nativo de Node.js
        const fileContent = fs.readFileSync(filePath, 'utf8');
        finalPromptText = `Basado en el contenido del siguiente archivo, responde a mi pregunta.\n\n--- INICIO DEL ARCHIVO: ${path.basename(filePath)} ---\n\n${fileContent}\n\n--- FIN DEL ARCHIVO ---\n\nMi pregunta es: ${userPrompt}`;
      } catch (e) {
        console.error(`Error al leer el archivo: ${e.message}`);
       closeUserInput();
        process.exit(1);
      }
    }

    // Construcción de las partes del contenido para la API
    let userParts = [{ text: finalPromptText }];
    if (imagePath) {
      try {
        const imagePart = fileToGenerativePart(imagePath);
        userParts = [{ text: userPrompt }, imagePart];
      } catch (e) {
        console.error(`Error al procesar la imagen: ${e.message}`);
       closeUserInput();
        process.exit(1);
      }
    }

    contents.push({ role: 'user', parts: userParts });

    console.log('Gemini:');
    let fullResponse = '';
    try {
      const result = stream ? await model.generateContentStream({ contents, generationConfig: Object.keys({ maxOutputTokens, temperature }).length > 0 ? { maxOutputTokens, temperature } : undefined, safetySettings: [{ category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }], systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined }) : await model.generateContent({ contents, generationConfig: Object.keys({ maxOutputTokens, temperature }).length > 0 ? { maxOutputTokens, temperature } : undefined, safetySettings: [{ category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }], systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined });

      if (stream) {
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          process.stdout.write(chunkText);
          fullResponse += chunkText;
        }
        console.log();
      } else {
        fullResponse = result.response.text();
        console.log(marked(fullResponse)); // Usar marked para renderizar
      }
    } catch (error) {
      console.error('\nError:', error.message);
    } finally {
       closeUserInput();
    }
  }
}

run();