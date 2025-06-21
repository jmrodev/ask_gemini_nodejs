// src/args/messages.js
import chalk from 'chalk';
import { MODEL_NAMES_MAP, HISTORY_FILE_DISPLAY, LOCAL_CONTEXT_FILE_DISPLAY, GENERAL_CONTEXT_FILE_DISPLAY } from './constants.js';

export const USAGE_MESSAGES = {
  header: chalk.bold('Uso: ask [opciones] "[prompt]"'),
  modelOptionsHeader: '\nOpciones de Modelo y Chat:',
  flashOption: `  ${chalk.cyan('--flash')}           Usa el modelo ${MODEL_NAMES_MAP.FLASH}.`,
  liteOption: `  ${chalk.cyan('--lite')}            Usa el modelo ${MODEL_NAMES_MAP.LITE}.`,
  proOption: `  ${chalk.cyan('--pro')}             Usa el modelo ${MODEL_NAMES_MAP.PRO}.`,
  chatOption: `  ${chalk.cyan('--chat')}            Activa el modo chat interactivo (con memoria de historial)`,
  streamOption: `  ${chalk.cyan('--stream')}          Activa el modo de respuesta en streaming.`,
  inputOptionsHeader: '\nOpciones de Entrada:',
  imageOption: `  ${chalk.cyan('--image <path>')}      Adjunta una imagen a la solicitud (solo en modo prompt único).`,
  fileOption: `  ${chalk.cyan('--file <path>')}        Adjunta el contenido de un archivo de texto al prompt.`,
  generationOptionsHeader: '\nOpciones de Configuración de Generación:',
  maxTokensOption: `  ${chalk.cyan('--max-tokens <N>')}      Establece el número máximo de tokens de salida.`,
  temperatureOption: `  ${chalk.cyan('--temperature <F>')}    Controla la aleatoriedad de la respuesta (0.0 a 1.0).`,
  systemInstructionOption: `  ${chalk.cyan('--system-instruction "<TEXT>"')} Define el comportamiento o rol del modelo.`,
  memoryContextOptionsHeader: '\nOpciones de Memoria y Contexto:',
  enableChatMemoryOption: `  ${chalk.cyan('--enable-chat-memory')}  Activa la lectura/escritura del historial de chat (default para --chat).`,
  disableChatMemoryOption: `  ${chalk.cyan('--disable-chat-memory')} Desactiva la lectura/escritura del historial de chat.`,
  enableContextOption: `  ${chalk.cyan('--enable-context')}    Activa la lectura de contexto local/general (default para todos los modos).`,
  disableContextOption: `  ${chalk.cyan('--disable-context')}   Desactiva la lectura de contexto local/general.`,
  forceNewContextOption: `  ${chalk.cyan('--force-new-context')} Fuerza la creación de un nuevo contexto local, sobrescribiendo el existente si lo hay.`,
  ttsOption: `  ${chalk.cyan('--tts "<texto>')}        Convierte el texto proporcionado a audio WAV.`,
  generalOptionsHeader: '\nOpciones Generales:',
  verboseOption: `  ${chalk.cyan('--verbose')}           Activa la salida de depuración detallada`,
  helpOption: `  ${chalk.cyan('--help')}            Muestra esta ayuda`,
  clearHistoryOption: `  ${chalk.cyan('--clear-history')}      Elimina el archivo de historial de chat (${HISTORY_FILE_DISPLAY}).`,
  setLocalContextOption: `  ${chalk.cyan('--set-context-local "<TEXT>"')}  Establece el contexto local inicial sin interacción.`,
  clearLocalContextOption: `  ${chalk.cyan('--clear-context-local')}  Elimina el contexto local inicial.`,
  setGeneralContextOption: `  ${chalk.cyan('--set-context-general "<TEXT>"')} Establece el contexto general inicial sin interacción.`,
  clearGeneralContextOption: `  ${chalk.cyan('--clear-context-general')} Elimina el contexto general inicial.`,
  notesHeader: `\n${chalk.bold.yellow('Notas:')}`,
  note1: ' El modo de prompt único NO mantiene memoria de conversación por defecto.',
  note2: `    El modo ${chalk.cyan('--chat')} SÍ carga y guarda el historial en ${HISTORY_FILE_DISPLAY} por defecto.`,
  note3: '    Los contextos locales/generales se pueden usar en ambos modos si están activados.',
  note4: '    Si no hay contexto local y no se usan flags de contexto, se te preguntará para definirlo.',
  note5: '    La opción --tts convierte el texto proporcionado a formato WAV y lo guarda en el directorio actual.',
};

export const ERROR_MESSAGES = {
  ttsRequiresText: chalk.red('Error: --tts requiere un texto para convertir a audio.'),
  imageRequiresPath: chalk.red('Error: --image requiere una ruta de archivo.'),
  fileRequiresPath: chalk.red('Error: --file requiere una ruta de archivo.'),
  systemInstructionRequiresArg: chalk.red('Error: --system-instruction requiere un argumento.'),
  maxTokensRequiresInt: chalk.red('Error: --max-tokens requiere un número entero válido.'),
  temperatureRequiresFloat: chalk.red('Error: --temperature requiere un número válido (ej. 0.7).'),
  setContextLocalRequiresArg: chalk.red('Error: --set-context-local requiere un argumento.'),
  setContextGeneralRequiresArg: chalk.red('Error: --set-context-general requiere un argumento.'),
  adminConflict: chalk.red('Error: Las opciones administrativas (--clear-*, --set-context-*) no pueden combinarse con opciones de chat o generación de contenido.'),
  localContextConflict: chalk.red('Error: No se pueden usar --set-context-local y --clear-context-local al mismo tiempo.'),
  generalContextConflict: chalk.red('Error: No se pueden usar --set-context-general y --clear-context-general al mismo tiempo.'),
  enableChatMemoryWithoutChat: chalk.red('Error: --enable-chat-memory solo tiene efecto en el modo --chat.'),
  forceNewContextConditions: chalk.red('Error: --force-new-context solo es compatible con un prompt único de texto y sin otras opciones de entrada. Debes proporcionar un prompt inicial para el nuevo contexto.'),
  multipleModelFlags: chalk.red('Error: Solo puedes especificar uno de los flags --lite, --flash o --pro.'),
  missingAction: chalk.red('Error: Se requiere un prompt, un archivo (--file), --chat, o --force-new-context con un prompt inicial.'),
  chatModeConflict: chalk.red('Error: Las opciones --image, --file y --force-new-context no son compatibles con el modo --chat.'),
  imageFileConflict: chalk.red('Error: No se pueden usar las opciones --image y --file al mismo tiempo.'),
};

export const WARNING_MESSAGES = {
  disableChatMemoryInChat: chalk.yellow('Advertencia: Desactivar la memoria de chat (--disable-chat-memory) en modo --chat significa que las conversaciones no se guardarán en el historial. Considera usar --clear-history if deseas un chat fresco.'),
  disableContextWithSetClear: chalk.yellow('Advertencia: Has especificado --disable-context pero también has intentado establecer/limpiar un contexto. La acción de establecer/limpiar se realizará, pero el contexto NO se utilizará en esta ejecución.'),
};

export function displayUsage() {
  console.log(USAGE_MESSAGES.header);
  console.log(USAGE_MESSAGES.modelOptionsHeader);
  console.log(USAGE_MESSAGES.flashOption);
  console.log(USAGE_MESSAGES.liteOption);
  console.log(USAGE_MESSAGES.proOption);
  console.log(USAGE_MESSAGES.chatOption);
  console.log(USAGE_MESSAGES.streamOption);
  console.log(USAGE_MESSAGES.inputOptionsHeader);
  console.log(USAGE_MESSAGES.imageOption);
  console.log(USAGE_MESSAGES.fileOption);
  console.log(USAGE_MESSAGES.ttsOption);
  console.log(USAGE_MESSAGES.generationOptionsHeader);
  console.log(USAGE_MESSAGES.maxTokensOption);
  console.log(USAGE_MESSAGES.temperatureOption);
  console.log(USAGE_MESSAGES.systemInstructionOption);
  console.log(USAGE_MESSAGES.memoryContextOptionsHeader);
  console.log(USAGE_MESSAGES.enableChatMemoryOption);
  console.log(USAGE_MESSAGES.disableChatMemoryOption);
  console.log(USAGE_MESSAGES.enableContextOption);
  console.log(USAGE_MESSAGES.disableContextOption);
  console.log(USAGE_MESSAGES.forceNewContextOption);
  console.log(USAGE_MESSAGES.generalOptionsHeader);
  console.log(USAGE_MESSAGES.verboseOption);
  console.log(USAGE_MESSAGES.helpOption);
  console.log(USAGE_MESSAGES.clearHistoryOption);
  console.log(USAGE_MESSAGES.setLocalContextOption);
  console.log(USAGE_MESSAGES.clearLocalContextOption);
  console.log(USAGE_MESSAGES.setGeneralContextOption);
  console.log(USAGE_MESSAGES.clearGeneralContextOption);
  console.log(USAGE_MESSAGES.notesHeader);
  console.log(USAGE_MESSAGES.note1);
  console.log(USAGE_MESSAGES.note2);
  console.log(USAGE_MESSAGES.note3);
  console.log(USAGE_MESSAGES.note4);
  console.log(USAGE_MESSAGES.note5);
  process.exit(1);
}
