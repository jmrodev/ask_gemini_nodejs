#!/usr/bin/env node


import 'dotenv/config';

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import chalk from 'chalk';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HISTORY_FILE = path.join(process.cwd(), '.ask_history.json');
const LOCAL_CONTEXT_FILE = path.join(process.cwd(), '.ask_context.local');
const GENERAL_CONTEXT_FILE = path.join(process.env.HOME, '.ask_context.general');

const DEFAULT_MODEL = 'gemini-1.5-flash-latest';

const MODEL_NAMES = {
  LITE: 'models/gemini-2.5-flash-lite-preview-06-17',
  FLASH: 'models/gemini-2.5-flash',
  PRO: 'models/gemini-1.5-pro',
};

const API_KEY = process.env.GEMINI_API_KEY;

const TEXT_CHUNK_SIZE = 30;

marked.setOptions({
  renderer: new TerminalRenderer(),
  gfm: true,
});

if (!API_KEY) {
  console.error(
    chalk.red('Error: La variable de entorno GEMINI_API_KEY no está definida.')
  );
  process.exit(1);
}

console.log(chalk.blue('DEBUG: API_KEY cargada correctamente. Longitud:', API_KEY.length));
const genAI = new GoogleGenerativeAI(API_KEY);

console.log(chalk.blue('DEBUG: genAI inicializado.'));

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
const question = (query) => new Promise((resolve) => rl.question(query, resolve));



function usage() {
  console.log(chalk.bold('Uso: ask [opciones] "[prompt]"'));
  console.log('\nOpciones de Modelo y Chat:');
  console.log(
    `  ${chalk.cyan(
      '--flash'
    )}           Usa el modelo ${MODEL_NAMES.FLASH}.`
  );
  console.log(
    `  ${chalk.cyan(
      '--lite'
    )}            Usa el modelo ${MODEL_NAMES.LITE}.`
  );
  console.log(
    `  ${chalk.cyan(
      '--pro'
    )}             Usa el modelo ${MODEL_NAMES.PRO}.`
  );
  console.log(
    `  ${chalk.cyan(
      '--chat'
    )}            Activa el modo chat interactivo (con memoria de historial)`
  );
  console.log(
    `  ${chalk.cyan(
      '--stream'
    )}          Activa el modo de respuesta en streaming.`
  );
  console.log('\nOpciones de Entrada:');
  console.log(
    `  ${chalk.cyan(
      '--image <path>'
    )}      Adjunta una imagen a la solicitud (solo en modo prompt único).`
  );
  console.log(
    `  ${chalk.cyan(
      '--file <path>'
    )}        Adjunta el contenido de un archivo de texto al prompt.`
  );
  console.log('\nOpciones de Configuración de Generación:');
  console.log(
    `  ${chalk.cyan(
      '--max-tokens <N>'
    )}      Establece el número máximo de tokens de salida.`
  );
  console.log(
    `  ${chalk.cyan(
      '--temperature <F>'
    )}    Controla la aleatoriedad de la respuesta (0.0 a 1.0).`
  );
  console.log(
    `  ${chalk.cyan(
      '--system-instruction "<TEXT>"'
    )} Define el comportamiento o rol del modelo.`
  );
  console.log('\nOpciones de Memoria y Contexto:');
  console.log(
    `  ${chalk.cyan('--enable-chat-memory')}  Activa la lectura/escritura del historial de chat (default para --chat).`
  );
  console.log(
    `  ${chalk.cyan('--disable-chat-memory')} Desactiva la lectura/escritura del historial de chat.`
  );
  console.log(
    `  ${chalk.cyan('--enable-context')}    Activa la lectura de contexto local/general (default para todos los modos).`
  );
  console.log(
    `  ${chalk.cyan('--disable-context')}   Desactiva la lectura de contexto local/general.`
  );
  console.log(
    `  ${chalk.cyan('--force-new-context')} Fuerza la creación de un nuevo contexto local, sobrescribiendo el existente si lo hay.`
  );
  console.log('\nOpciones Generales:');
  console.log(
    `  ${chalk.cyan(
      '--verbose'
    )}           Activa la salida de depuración detallada`
  );
  console.log(`  ${chalk.cyan('--help')}            Muestra esta ayuda`);
  console.log(
    `  ${chalk.cyan(
      '--clear-history'
    )}      Elimina el archivo de historial de chat (${HISTORY_FILE}).`
  );
  console.log(
    `  ${chalk.cyan(
      '--set-context-local "<TEXT>"'
    )}  Establece el contexto local inicial sin interacción.`
  );
  console.log(
    `  ${chalk.cyan(
      '--clear-context-local'
    )}  Elimina el contexto local inicial.`
  );
  console.log(
    `  ${chalk.cyan(
      '--set-context-general "<TEXT>"'
    )} Establece el contexto general inicial sin interacción.`
  );
  console.log(
    `  ${chalk.cyan(
      '--clear-context-general'
    )} Elimina el contexto general inicial.`
  );
  console.log(
    `\n${chalk.bold.yellow(
      'Notas:'
    )} El modo de prompt único NO mantiene memoria de conversación por defecto.`
  );
  console.log(
    `    El modo ${chalk.cyan(
      '--chat'
    )} SÍ carga y guarda el historial en ${HISTORY_FILE} por defecto.`
  );
  console.log(
    `    Los contextos locales/generales se pueden usar en ambos modos si están activados.`
  );
  console.log(
    `    Si no hay contexto local y no se usan flags de contexto, se te preguntará para definirlo.`
  );
  rl.close();
  process.exit(1);
}

function fileToGenerativePart(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`El archivo de imagen no existe: ${filePath}`);
  }
  const mimeType = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  }[path.extname(filePath).toLowerCase()];

  if (!mimeType) {
    throw new Error(
      `Tipo de archivo de imagen no soportado: ${path.extname(filePath)}`
    );
  }

  return {
    inlineData: {
      data: fs.readFileSync(filePath).toString('base64'),
      mimeType,
    },
  };
}

function loadContextFromFile(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function buildContextContentParts() {
  let contextParts = [];
  const generalCtx = loadContextFromFile(GENERAL_CONTEXT_FILE);
  const localCtx = loadContextFromFile(LOCAL_CONTEXT_FILE);

  if (generalCtx) {
    contextParts.push({ text: `CONTEXTO GENERAL: ${generalCtx.trim()}` });
  }
  if (localCtx) {
    contextParts.push({ text: `CONTEXTO LOCAL: ${localCtx.trim()}` });
  }
  return contextParts;
}

function loadHistoryForChatSdk() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try {
    const fileContent = fs.readFileSync(HISTORY_FILE, 'utf8');
    if (fileContent.trim() === '') return [];
    const historyData = JSON.parse(fileContent);
    const recentHistory = historyData.slice(-10);
    return recentHistory.flatMap((entry) => [
      { role: 'user', parts: [{ text: entry.prompt }] },
      { role: 'model', parts: [{ text: entry.response }] },
    ]);
  } catch (e) {
    console.warn(
      chalk.yellow(
        `Advertencia: Error al leer/parsear el historial. Se iniciará un historial nuevo.`
      )
    );
    return [];
  }
}

function saveToHistory(userPrompt, modelResponse, modelName) {
  const newEntry = {
    timestamp: new Date().toISOString(),
    model: modelName,
    prompt: userPrompt,
    response: modelResponse,
  };

  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    const fileContent = fs.readFileSync(HISTORY_FILE, 'utf8');
    if (fileContent.trim() !== '') {
      try {
        history = JSON.parse(fileContent);
      } catch (e) {
        console.warn(
          chalk.yellow('Advertencia: Historial corrupto. Se sobreescribirá.')
        );
      }
    }
  }

  history.push(newEntry);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
}



let args = process.argv.slice(2);
let modelName = DEFAULT_MODEL; 

let interactiveChat = false;
let stream = false;
let generateAudio = false;
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

let clearAudioProg = false;
let clearHistoryFlag = false;
let setLocalContextText = null;
let clearLocalContextFlag = false;
let setGeneralContextText = null;
let clearGeneralContextFlag = false;
let tts = false;

let modelFlagProvided = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  const nextArg = args[i + 1];
  switch (arg) {
    case '--flash':
      modelName = MODEL_NAMES.FLASH;
      modelFlagProvided = true;
      break;
    case '--lite':
      modelName = MODEL_NAMES.LITE;
      modelFlagProvided = true;
      break;
    case '--pro':
      modelName = MODEL_NAMES.PRO;
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
        console.error(chalk.red('Error: --image requiere una ruta de archivo.'));
        usage();
      }
      break;
    case '--file':
      if (nextArg) {
        filePath = nextArg;
        i++;
      } else {
        console.error(chalk.red('Error: --file requiere una ruta de archivo.'));
        usage();
      }
      break;
    case '--audio':
      generateAudio = true;
      console.warn(chalk.yellow('Advertencia: La generación de audio está actualmente deshabilitada en el script.'));
      break;
    case '--tts':
      tts = true;
      console.warn(chalk.yellow('Advertencia: La generación de audio (TTS) está actualmente deshabilitada en el script.'));
      break;
    case '--system-instruction':
      if (nextArg) {
        systemInstruction = nextArg;
        i++;
      } else {
        console.error(
          chalk.red('Error: --system-instruction requiere un argumento.')
        );
        usage();
      }
      break;
    case '--max-tokens':
      if (nextArg && !isNaN(parseInt(nextArg))) {
        maxOutputTokens = parseInt(nextArg);
        i++;
      } else {
        console.error(
          chalk.red('Error: --max-tokens requiere un número entero válido.')
        );
        usage();
      }
      break;
    case '--temperature':
      if (nextArg && !isNaN(parseFloat(nextArg))) {
        temperature = parseFloat(nextArg);
        i++;
      } else {
        console.error(
          chalk.red('Error: --temperature requiere un número válido (ej. 0.7).')
        );
        usage();
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
    case '--clear-audio-progress':
      clearAudioProg = true;
      console.warn(chalk.yellow('Advertencia: La limpieza del progreso de audio está actualmente deshabilitada en el script.'));
      break;
    case '--clear-history':
      clearHistoryFlag = true;
      break;
    case '--set-context-local':
      if (nextArg !== undefined) {
        setLocalContextText = nextArg;
        i++;
      } else {
        console.error(chalk.red('Error: --set-context-local requiere un argumento (puede ser "" para vaciar).'));
        usage();
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
        console.error(chalk.red('Error: --set-context-general requiere un argumento (puede ser "" para vaciar).'));
        usage();
      }
      break;
    case '--clear-context-general':
      clearGeneralContextFlag = true;
      break;
    case '--help':
      usage();
      break;
    default:
      userPrompt += (userPrompt ? ' ' : '') + arg;
      break;
  }
}

const administrativeFlags = [
  clearAudioProg,
  clearHistoryFlag,
  setLocalContextText !== null,
  clearLocalContextFlag,
  setGeneralContextText !== null,
  clearGeneralContextFlag,
];

const hasContextSetOrClearFlags = setLocalContextText !== null || clearLocalContextFlag || setGeneralContextText !== null || clearGeneralContextFlag;

const onlyAdministrative = administrativeFlags.some(flag => flag);

const isNormalOperationMode = !(onlyAdministrative || hasContextSetOrClearFlags);


if (onlyAdministrative) {
  const conflictingFlags = [
    interactiveChat,
    stream,
    generateAudio,
    userPrompt,
    imagePath,
    filePath,
    systemInstruction,
    maxOutputTokens !== undefined,
    temperature !== undefined,
    tts,
    enableChatMemory !== undefined,
    enableContext !== undefined,
    forceNewContext,
    modelFlagProvided
  ];
  if (conflictingFlags.some(flag => flag)) {
    console.error(
      chalk.red(
        'Error: Las opciones administrativas (--clear-*, --set-context-*) no pueden combinarse con opciones de chat o generación de contenido.'
      )
    );
    usage();
  }

  if (setLocalContextText !== null && clearLocalContextFlag) {
    console.error(chalk.red('Error: No se pueden usar --set-context-local y --clear-context-local al mismo tiempo.'));
    usage();
  }
  if (setGeneralContextText !== null && clearGeneralContextFlag) {
    console.error(chalk.red('Error: No se pueden usar --set-context-general y --clear-context-general al mismo tiempo.'));
    usage();
  }

} else {
  if (enableChatMemory === true && !interactiveChat) {
    console.error(chalk.red('Error: --enable-chat-memory solo tiene efecto en el modo --chat.'));
    usage();
  }
  if (enableChatMemory === false && interactiveChat && !clearHistoryFlag) {
    console.warn(chalk.yellow('Advertencia: Desactivar la memoria de chat (--disable-chat-memory) en modo --chat significa que las conversaciones no se guardarán en el historial. Considera usar --clear-history si deseas un chat fresco.'));
  }
  if (enableContext === false && hasContextSetOrClearFlags) {
      console.warn(chalk.yellow('Advertencia: Has especificado --disable-context pero también has intentado establecer/limpiar un contexto. La acción de establecer/limpiar se realizará, pero el contexto NO se utilizará en esta ejecución.'));
  }
  if (forceNewContext && (interactiveChat || generateAudio || tts || filePath || imagePath || !userPrompt)) {
    console.error(chalk.red('Error: --force-new-context solo es compatible con un prompt único de texto y sin otras opciones de entrada. Debes proporcionar un prompt inicial para el nuevo contexto.'));
    usage();
  }
  const modelFlagsUsed = [args.includes('--lite'), args.includes('--flash'), args.includes('--pro')].filter(Boolean).length;
  if (modelFlagsUsed > 1) {
    console.error(chalk.red('Error: Solo puedes especificar uno de los flags --lite, --flash o --pro.'));
    usage();
  }

  if (imagePath && (generateAudio || tts)) {
    console.error(
      chalk.red(
        'Error: Las opciones --audio y --tts no son compatibles con --image. (Funcionalidad de audio deshabilitada)'
      )
    );
    usage();
  }

  const hasUserAction = interactiveChat || userPrompt || generateAudio || tts || filePath || imagePath;
  if (isNormalOperationMode && !hasUserAction && !forceNewContext) {
    const localContextExists = fs.existsSync(LOCAL_CONTEXT_FILE) && fs.readFileSync(LOCAL_CONTEXT_FILE, 'utf8').trim() !== '';
    const shouldPromptAutomatically = !localContextExists && !interactiveChat && !generateAudio && !tts && !filePath && !imagePath && !hasContextSetOrClearFlags && userPrompt === '';

    if (!shouldPromptAutomatically) {
      console.error(
        chalk.red(
          'Error: Se requiere un prompt, un archivo (--file), --chat, o --force-new-context con un prompt inicial.'
        )
      );
      usage();
    }
  }


  if (interactiveChat && (imagePath || filePath || generateAudio || tts || forceNewContext)) {
    console.error(
      chalk.red(
        'Error: Las opciones --image, --file y --force-new-context no son compatibles con el modo --chat. (Funcionalidad de audio deshabilitada)'
      )
    );
    usage();
  }
  if (imagePath && filePath) {
    console.error(
      chalk.red(
        'Error: No se pueden usar las opciones --image y --file al mismo tiempo.'
      )
    );
    usage();
  }
}

const textGenerationConfig = {};
if (maxOutputTokens !== undefined) {
  textGenerationConfig.maxOutputTokens = maxOutputTokens;
}
if (temperature !== undefined) {
  textGenerationConfig.temperature = temperature;
}


async function run() {
  if (onlyAdministrative) {
    if (clearAudioProg) {
      console.warn(chalk.yellow('Advertencia: La limpieza del progreso de audio está actualmente deshabilitada en el script.'));
    }
    if (clearHistoryFlag) {
      clearHistory();
    }
    if (clearLocalContextFlag) {
      clearContextFile(LOCAL_CONTEXT_FILE, 'local');
    }
    if (setLocalContextText !== null) {
      setContextFile(LOCAL_CONTEXT_FILE, setLocalContextText, 'local');
    }
    if (clearGeneralContextFlag) {
      clearContextFile(GENERAL_CONTEXT_FILE, 'general');
    }
    if (setGeneralContextText !== null) {
      setContextFile(GENERAL_CONTEXT_FILE, setGeneralContextText, 'general');
    }
    rl.close();
    process.exit(0);
  }

  const localContextExists = fs.existsSync(LOCAL_CONTEXT_FILE) && fs.readFileSync(LOCAL_CONTEXT_FILE, 'utf8').trim() !== '';

  const shouldPromptAutomatically = isNormalOperationMode && !localContextExists && !hasContextSetOrClearFlags && !interactiveChat && !generateAudio && !tts && !filePath && !imagePath && userPrompt === '';
  const shouldForcePromptForContext = isNormalOperationMode && forceNewContext && !interactiveChat && !generateAudio && !tts && !filePath && !imagePath && userPrompt !== '';


  if (shouldPromptAutomatically || shouldForcePromptForContext) {
    console.log(chalk.yellow('\n--- CONTEXTO DE PROYECTO LOCAL ---'));
    let promptMessage = '';
    let contextToSummarize = '';

    if (shouldPromptAutomatically) {
        promptMessage = 'Parece que no tienes un contexto de proyecto local definido para este directorio.\n';
        promptMessage += 'Este contexto es como la "explicación de qué harás aquí".\n';
        promptMessage += 'Cuéntame qué haremos. Por ejemplo: "Voy a programar en Node.js con MySQL y React una aplicación de escritorio para consultas a Telegram mediante el bot textcontextbot."\n';
        promptMessage += '¿Tu contexto de proyecto (o deja vacío para omitir y continuar con tu pregunta inicial)? ';
        contextToSummarize = userPrompt;
    } else {
        promptMessage = 'Has solicitado forzar un nuevo contexto local. El contexto existente será sobrescrito.\n';
        promptMessage += 'Cuéntame qué haremos. Por ejemplo: "Voy a programar en Node.js con MySQL y React una aplicación de escritorio para consultas a Telegram mediante el bot textcontextbot."\n';
        promptMessage += '¿Tu nuevo contexto de proyecto (o deja vacío para borrar el existente)? ';
        contextToSummarize = userPrompt;
    }
    
    let proposedContext = '';
    if (contextToSummarize.trim()) {
        console.log(chalk.blue('DEBUG: Solicitando a Gemini que resuma el contexto inicial...'));
        try {
            const tempModel = genAI.getGenerativeModel({ model: DEFAULT_MODEL }); 
            const result = await tempModel.generateContent(`Basado en el siguiente texto, genera una frase concisa (máximo 50 palabras) que sirva como contexto de proyecto para mi IA, enfocándote en la descripción de lo que haré o el propósito principal. Si el texto es una pregunta, reformúlala como una declaración de contexto. Ejemplo de formato: "Estoy desarrollando una app con X para Y". Texto: "${contextToSummarize}"`);
            proposedContext = result.response.text().trim();
            console.log(chalk.yellow(`\nGemini propone este contexto:`));
            console.log(chalk.cyan(`"${proposedContext}"`));
            const confirm = await question(chalk.green('¿Es correcto? (Y/n) '));
            if (confirm.toLowerCase() === 'n') {
                console.log(chalk.yellow('Por favor, ingresa tu propio contexto o deja vacío:'));
                inputContext = await question(chalk.green('Tu contexto: '));
                if (inputContext.trim()) {
                    proposedContext = inputContext.trim();
                } else {
                    proposedContext = '';
                }
            }
        } catch (e) {
            console.warn(chalk.yellow('Advertencia: No se pudo generar una propuesta de contexto con Gemini. Por favor, ingresa el contexto manualmente.'));
            console.error(chalk.red('Error de Gemini para propuesta de contexto:'), e.message);
            proposedContext = await question(chalk.green('Tu contexto de proyecto (o deja vacío para omitir/borrar): '));
        }
    } else {
        proposedContext = await question(chalk.green(promptMessage));
    }

    if (proposedContext.trim()) {
      setContextFile(LOCAL_CONTEXT_FILE, proposedContext.trim(), 'local');
      console.log(chalk.green('Contexto local guardado. Reinicia el script para que se cargue si --enable-context está activo.'));
    } else {
      console.log(chalk.yellow('Contexto local no guardado.'));
      if (shouldForcePromptForContext && localContextExists) {
          clearContextFile(LOCAL_CONTEXT_FILE, 'local');
          console.log(chalk.yellow('Contexto local existente borrado.'));
      }
    }
    rl.close();
    process.exit(0);
  }


  let model;
  try {
    console.log(chalk.blue('DEBUG: Intentando obtener el modelo de texto:', modelName, 'con systemInstruction:', systemInstruction));
    model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstruction
        ? { parts: [{ text: systemInstruction }] }
        : undefined,
    });
    console.log(chalk.blue('DEBUG: Modelo de texto inicializado exitosamente.'));
  } catch (e) {
    console.error(chalk.red('ERROR FATAL: Fallo al inicializar el modelo de texto:'), e.message);
    rl.close();
    process.exit(1);
  }

  if (!model) {
      console.error(chalk.red('ERROR FATAL: El modelo de texto no pudo ser inicializado. La variable "model" es nula o indefinida después del intento de inicialización.'));
      rl.close();
      process.exit(1);
  }


  if (tts) {
    console.error(chalk.red('Error: La generación de audio (TTS) está actualmente deshabilitada en el script.'));
    rl.close();
    process.exit(1);
  }

  if (generateAudio) {
    console.error(chalk.red('Error: La generación de audio (por chunks) está actualmente deshabilitada en el script.'));
    rl.close();
    process.exit(1);
  }

  if (interactiveChat) {
    console.log(
      chalk.bold.yellow(
        `Modo Chat. Modelo: ${modelName}. Escribe '${chalk.cyan(
          'exit'
        )}' o '${chalk.cyan('quit')}' para salir.`
      )
    );
    if (stream) console.log(chalk.yellow('Modo Streaming activado.'));

    const useChatMemory = enableChatMemory === true || (enableChatMemory === undefined);
    const useContext = enableContext === true || (enableContext === undefined);


    let initialHistory = [];
    if (useChatMemory) {
      initialHistory = loadHistoryForChatSdk();
    }

    if (useContext) {
      const contextContentParts = buildContextContentParts();
      if (contextContentParts.length > 0) {
        contextContentParts.forEach(part => {
          initialHistory.push({ role: 'user', parts: [part] });
          initialHistory.push({ role: 'model', parts: [{ text: 'Entendido.' }] });
        });
      }
    }

    const chat = model.startChat({
      history: initialHistory,
      generationConfig:
        Object.keys(textGenerationConfig).length > 0
          ? textGenerationConfig
          : undefined,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
      systemInstruction: systemInstruction
        ? { parts: [{ text: systemInstruction }] }
        : undefined,
    });

    while (true) {
      const prompt = await question(chalk.cyan('Tú: '));

      if (prompt.toLowerCase() === 'exit' || prompt.toLowerCase() === 'quit')
        break;
      if (!prompt) continue;

      console.log(chalk.bold.yellow('Gemini:'));
      let fullResponse = '';
      try {
        const modelMethod = stream ? 'sendMessageStream' : 'sendMessage';
        const result = await chat[modelMethod](prompt);

        if (stream) {
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            process.stdout.write(chalk.yellow(chunkText));
            fullResponse += chunkText;
          }
          console.log();
        } else {
          fullResponse = result.response.text();
          console.log(marked(fullResponse));
        }
        if (useChatMemory) {
          saveToHistory(prompt, fullResponse, modelName);
        }
      } catch (error) {
        console.error(chalk.red('\nError:'), error.message);
      } finally {
        console.log('');
      }
    }
    rl.close();
    console.log(chalk.bold.yellow('\n¡Hasta pronto!'));
  } else {
    let contents = [];
    let finalPromptText = userPrompt;

    const useContext = enableContext === true || (enableContext === undefined);

    if (useContext && !systemInstruction) {
        const contextContentParts = buildContextContentParts();
        if (contextContentParts.length > 0) {
            finalPromptText = `${contextContentParts.map(p => p.text).join('\n')}\n\n${userPrompt}`;
        }
    } else if (useContext && systemInstruction) {
        console.warn(chalk.yellow('Advertencia: El contexto local/general no se añadió al prompt porque se especificó una --system-instruction.'));
    }


    if (filePath) {
      try {
        if (!fs.existsSync(filePath)) {
          console.error(chalk.red(`El archivo no existe: ${filePath}`));
          process.exit(1);
        }
        const fileContent = fs.readFileSync(filePath, 'utf8');
        finalPromptText = `Basado en el contenido del siguiente archivo, responde a mi pregunta.\n\n--- INICIO DEL ARCHIVO: ${path.basename(
          filePath
        )} ---\n\n${fileContent}\n\n--- FIN DEL ARCHIVO ---\n\nMi pregunta es: ${userPrompt}`;
      } catch (e) {
        console.error(chalk.red(`Error al leer el archivo: ${e.message}`));
        process.exit(1);
      }
    }

    let userParts = [{ text: finalPromptText }];
    if (imagePath) {
      try {
        const imagePart = fileToGenerativePart(imagePath);
        userParts = [{ text: userPrompt }, imagePart];
      } catch (e) {
        console.error(chalk.red(`Error al procesar la imagen: ${e.message}`));
        process.exit(1);
      }
    }

    contents.push({ role: 'user', parts: userParts });

    console.log(chalk.bold.yellow('Gemini:'));
    let fullResponse = '';
    try {
      const modelMethod = stream ? 'generateContentStream' : 'generateContent';
      const result = await model[modelMethod]({
        contents,
        generationConfig:
          Object.keys(textGenerationConfig).length > 0
            ? textGenerationConfig
            : undefined,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
        systemInstruction: systemInstruction
          ? { parts: [{ text: systemInstruction }] }
          : undefined,
      });

      if (stream) {
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          process.stdout.write(chalk.yellow(chunkText));
          fullResponse += chunkText;
        }
        console.log();
      } else {
        fullResponse = result.response.text();
        console.log(marked(fullResponse));
      }
    } catch (error) {
      console.error(chalk.red('\nError:'), error.message);
    } finally {
        rl.close();
    }
  }
}

run();