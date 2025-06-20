// src/args/argParser.js

import chalk from 'chalk';
import fs from 'fs';   // CAMBIO CLAVE: Importar fs
import path from 'path'; // CAMBIO CLAVE: Importar path

// Constantes globales (necesarias para el mensaje de uso)
const DEFAULT_MODEL = 'gemini-1.5-flash-latest';
const HISTORY_FILE_DISPLAY = './.ask_history.json'; // Para mostrar en el usage
const LOCAL_CONTEXT_FILE_DISPLAY = './.ask_context.local'; // Para mostrar en el usage
const GENERAL_CONTEXT_FILE_DISPLAY = '~/.ask_context.general'; // Para mostrar en el usage

// Definir los nombres de modelos directamente con sus códigos exactos
const MODEL_NAMES_MAP = {
  LITE: 'models/gemini-2.5-flash-lite-preview-06-17',
  FLASH: 'models/gemini-2.5-flash',
  PRO: 'models/gemini-1.5-pro',
};

export function usage() {
  console.log(chalk.bold('Uso: ask [opciones] "[prompt]"'));
  console.log('\nOpciones de Modelo y Chat:');
  console.log(
    `  ${chalk.cyan('--flash')}           Usa el modelo ${MODEL_NAMES_MAP.FLASH}.`
  );
  console.log(
    `  ${chalk.cyan('--lite')}            Usa el modelo ${MODEL_NAMES_MAP.LITE}.`
  );
  console.log(
    `  ${chalk.cyan('--pro')}             Usa el modelo ${MODEL_NAMES_MAP.PRO}.`
  );
  console.log(
    `  ${chalk.cyan('--chat')}            Activa el modo chat interactivo (con memoria de historial)`
  );
  console.log(
    `  ${chalk.cyan('--stream')}          Activa el modo de respuesta en streaming.`
  );
  console.log('\nOpciones de Entrada:');
  console.log(
    `  ${chalk.cyan('--image <path>')}      Adjunta una imagen a la solicitud (solo en modo prompt único).`
  );
  console.log(
    `  ${chalk.cyan('--file <path>')}        Adjunta el contenido de un archivo de texto al prompt.`
  );
  console.log('\nOpciones de Configuración de Generación:');
  console.log(
    `  ${chalk.cyan('--max-tokens <N>')}      Establece el número máximo de tokens de salida.`
  );
  console.log(
    `  ${chalk.cyan('--temperature <F>')}    Controla la aleatoriedad de la respuesta (0.0 a 1.0).`
  );
  console.log(
    `  ${chalk.cyan('--system-instruction "<TEXT>"')} Define el comportamiento o rol del modelo.`
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
    `  ${chalk.cyan('--verbose')}           Activa la salida de depuración detallada`
  );
  console.log(`  ${chalk.cyan('--help')}            Muestra esta ayuda`);
  console.log(
    `  ${chalk.cyan('--clear-history')}      Elimina el archivo de historial de chat (${HISTORY_FILE_DISPLAY}).`
  );
  console.log(
    `  ${chalk.cyan('--set-context-local "<TEXT>"')}  Establece el contexto local inicial sin interacción.`
  );
  console.log(
    `  ${chalk.cyan('--clear-context-local')}  Elimina el contexto local inicial.`
  );
  console.log(
    `  ${chalk.cyan('--set-context-general "<TEXT>"')} Establece el contexto general inicial sin interacción.`
  );
  console.log(
    `  ${chalk.cyan('--clear-context-general')} Elimina el contexto general inicial.`
  );
  console.log(
    `\n${chalk.bold.yellow(
      'Notas:'
    )} El modo de prompt único NO mantiene memoria de conversación por defecto.`
  );
  console.log(
    `    El modo ${chalk.cyan(
      '--chat'
    )} SÍ carga y guarda el historial en ${HISTORY_FILE_DISPLAY} por defecto.`
  );
  console.log(
    `    Los contextos locales/generales se pueden usar en ambos modos si están activados.`
  );
  console.log(
    `    Si no hay contexto local y no se usan flags de contexto, se te preguntará para definirlo.`
  );
  process.exit(1);
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
      case '--clear-history':
        clearHistoryFlag = true;
        break;
      case '--set-context-local':
        if (nextArg !== undefined) {
          setLocalContextText = nextArg;
          i++;
        } else {
          console.error(chalk.red('Error: --set-context-local requiere un argumento.'));
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
          console.error(chalk.red('Error: --set-context-general requiere un argumento.'));
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
    // Validaciones para el modo de operación normal
    if (enableChatMemory === true && !interactiveChat) {
      console.error(chalk.red('Error: --enable-chat-memory solo tiene efecto en el modo --chat.'));
      usage();
    }
    if (enableChatMemory === false && interactiveChat && !clearHistoryFlag) {
      console.warn(chalk.yellow('Advertencia: Desactivar la memoria de chat (--disable-chat-memory) en modo --chat significa que las conversaciones no se guardarán en el historial. Considera usar --clear-history if deseas un chat fresco.'));
    }
    if (enableContext === false && hasContextSetOrClearFlags) {
        console.warn(chalk.yellow('Advertencia: Has especificado --disable-context pero también has intentado establecer/limpiar un contexto. La acción de establecer/limpiar se realizará, pero el contexto NO se utilizará en esta ejecución.'));
    }
    if (forceNewContext && (interactiveChat || userPrompt === '' || filePath || imagePath)) {
      console.error(chalk.red('Error: --force-new-context solo es compatible con un prompt único de texto y sin otras opciones de entrada. Debes proporcionar un prompt inicial para el nuevo contexto.'));
      usage();
    }
    const modelFlagsUsed = [args.includes('--lite'), args.includes('--flash'), args.includes('--pro')].filter(Boolean).length;
    if (modelFlagsUsed > 1) {
      console.error(chalk.red('Error: Solo puedes especificar uno de los flags --lite, --flash o --pro.'));
      usage();
    }

    const hasUserAction = interactiveChat || userPrompt || filePath || imagePath;
    if (isNormalOperationMode && !hasUserAction && !forceNewContext) {
      const localContextExists = (fs.existsSync(path.join(process.cwd(), LOCAL_CONTEXT_FILE_DISPLAY.substring(2))) && fs.readFileSync(path.join(process.cwd(), LOCAL_CONTEXT_FILE_DISPLAY.substring(2)), 'utf8').trim() !== '');
      const shouldPromptAutomatically = !localContextExists && !interactiveChat && !hasContextSetOrClearFlags && !userPrompt; 

      if (!shouldPromptAutomatically) {
        console.error(
          chalk.red(
            'Error: Se requiere un prompt, un archivo (--file), --chat, o --force-new-context con un prompt inicial.'
          )
        );
        usage();
      }
    }


    if (interactiveChat && (imagePath || filePath || forceNewContext)) {
      console.error(
        chalk.red(
          'Error: Las opciones --image, --file y --force-new-context no son compatibles con el modo --chat.'
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