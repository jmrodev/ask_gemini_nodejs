#!/usr/bin/env node

// ask.js

// Cargar variables de entorno para ESM
import 'dotenv/config'

// Importar SDK de Gemini
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai' // Para modelos de texto/multimodales
import { GoogleGenAI } from '@google/genai' // Para modelos específicos de audio (TTS)

// Importar módulos Node.js y librerías adicionales
import fetch from 'node-fetch' // Aunque no se usa directamente en este código, se mantiene por si se necesita para otras funciones.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url' // CORRECCIÓN: Aquí la sintaxis es correcta
import readline from 'readline'
import chalk from 'chalk'
import { marked } from 'marked'
import TerminalRenderer from 'marked-terminal'
import mime from 'mime' // Importar mime para manejar tipos de archivo de audio

// --- Replicar __dirname en ESM ---
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// --- Configuración Global ---
const HISTORY_FILE = path.join(__dirname, '.ask_history.json')
const LOCAL_CONTEXT_FILE = path.join(__dirname, '.ask_context.local')
const GENERAL_CONTEXT_FILE = path.join(process.env.HOME, '.ask_context.general')
const AUDIO_PROGRESS_FILE = path.join(__dirname, '.audio_progress.json')
const DEFAULT_MODEL = 'gemini-1.5-flash-latest'
const API_KEY = process.env.GEMINI_API_KEY

// Configuración para el modelo de audio y chunking de texto
const AUDIO_MODEL = 'gemini-2.5-flash-preview-tts'
//const AUDIO_MODEL = 'gemini-2.5-pro-preview-tts'
// La voz 'Zephyr' es la más común y a menudo la única soportada por estos modelos preview
//const AUDIO_VOICE = 'Zephyr' // Cambia a 'Zephyr' para asegurar 
const AUDIO_VOICE = 'Charon'
//const AUDIO_VOICE = 'Enceladus'

const TEXT_CHUNK_SIZE = 30 // Número de líneas por chunk para audio de texto largo

// Inicializar el renderizador de Markdown
marked.setOptions({
  renderer: new TerminalRenderer(),
  gfm: true,
})

// Inicializar la API de Gemini
if (!API_KEY) {
  console.error(
    chalk.red('Error: La variable de entorno GEMINI_API_KEY no está definida.')
  )
  process.exit(1)
}
const genAI = new GoogleGenerativeAI(API_KEY) // Para modelos de texto (gemini-1.5-flash-latest, etc.)
const ttsAI = new GoogleGenAI({ apiKey: API_KEY }) // Para modelos de audio (gemini-2.5-pro-preview-tts)

// --- Funciones Auxiliares ---

function usage() {
  console.log(chalk.bold('Uso: ask [opciones] "[prompt]"'))
  console.log('\nOpciones de Modelo y Chat:')
  console.log(
    `  ${chalk.cyan(
      '--model <MODEL_NAME>'
    )}    Especifica el modelo de Gemini (default: ${DEFAULT_MODEL})`
  )
  console.log(
    `  ${chalk.cyan(
      '--chat'
    )}            Activa el modo chat interactivo (con memoria de historial)`
  )
  console.log(
    `  ${chalk.cyan(
      '--stream'
    )}          Activa el modo de respuesta en streaming.`
  )
  console.log('\nOpciones de Entrada:')
  console.log(
    `  ${chalk.cyan(
      '--image <path>'
    )}      Adjunta una imagen a la solicitud (solo en modo prompt único).`
  )
  console.log(
    `  ${chalk.cyan(
      '--file <path>'
    )}        Adjunta el contenido de un archivo de texto al prompt.`
  )
  console.log(
    `  ${chalk.cyan(
      '--audio'
    )}            Genera audio de texto largo en chunks (usa ${AUDIO_MODEL}).`
  )
  console.log(
    `  ${chalk.cyan(
      '--tts'
    )}              Genera audio de un prompt o archivo simple (usa ${AUDIO_MODEL}).`
  )
  console.log('\nOpciones de Configuración de Generación:')
  console.log(
    `  ${chalk.cyan(
      '--max-tokens <N>'
    )}      Establece el número máximo de tokens de salida.`
  )
  console.log(
    `  ${chalk.cyan(
      '--temperature <F>'
    )}    Controla la aleatoriedad de la respuesta (0.0 a 1.0).`
  )
  console.log(
    `  ${chalk.cyan(
      '--system-instruction "<TEXT>"'
    )} Define el comportamiento o rol del modelo.`
  )
  // --- MODIFICACIÓN: Añadir opciones de voz a usage() ---
  console.log(
    `  ${chalk.cyan(
      '--speaking-rate <F>'
    )}  Controla la velocidad de habla para TTS (ej. 0.8 a 1.2).`
  )
  console.log(
    `  ${chalk.cyan(
      '--pitch <F>'
    )}            Ajusta el tono de la voz para TTS (ej. -5.0 a 5.0).`
  )
  console.log('\nOpciones Generales:')
  console.log(
    `  ${chalk.cyan(
      '--verbose'
    )}          Activa la salida de depuración detallada`
  )
  console.log(`  ${chalk.cyan('--help')}            Muestra esta ayuda`)
  console.log(
    `  ${chalk.cyan(
      '--clear-audio-progress'
    )} Elimina el archivo de progreso de audio.`
  )
  console.log(
    `\n${chalk.bold.yellow(
      'Notas:'
    )} El modo de prompt único no mantiene memoria de conversación entre llamadas.`
  )
  console.log(
    `    El modo ${chalk.cyan(
      '--chat'
    )} sí carga y guarda el historial en ${HISTORY_FILE}.`
  )
  console.log(
    `    Los modos ${chalk.cyan('--audio')} y ${chalk.cyan(
      '--tts'
    )} guardan los archivos de audio generados en la carpeta actual.`
  )
  process.exit(1)
}

function fileToGenerativePart(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`El archivo de imagen no existe: ${filePath}`)
  }
  const mimeType = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  }[path.extname(filePath).toLowerCase()]

  if (!mimeType) {
    throw new Error(
      `Tipo de archivo de imagen no soportado: ${path.extname(filePath)}`
    )
  }

  return {
    inlineData: {
      data: fs.readFileSync(filePath).toString('base64'),
      mimeType,
    },
  }
}

function loadContext(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
}

function buildContextString() {
  let fullCtx = ''
  const generalCtx = loadContext(GENERAL_CONTEXT_FILE)
  const localCtx = loadContext(LOCAL_CONTEXT_FILE)

  if (generalCtx) {
    fullCtx += `${generalCtx.trim()}\n\n`
  }
  if (localCtx) {
    fullCtx += `${localCtx.trim()}\n\n`
  }
  return fullCtx.trim()
}

function loadHistoryForChatSdk() {
  if (!fs.existsSync(HISTORY_FILE)) return []
  try {
    const fileContent = fs.readFileSync(HISTORY_FILE, 'utf8')
    if (fileContent.trim() === '') return []
    const historyData = JSON.parse(fileContent)
    const recentHistory = historyData.slice(-10) // Mantener historial reciente
    return recentHistory.flatMap((entry) => [
      { role: 'user', parts: [{ text: entry.prompt }] },
      { role: 'model', parts: [{ text: entry.response }] },
    ])
  } catch (e) {
    console.warn(
      chalk.yellow(
        `Advertencia: Error al leer/parsear el historial. Se iniciará un historial nuevo.`
      )
    )
    return []
  }
}

function saveToHistory(userPrompt, modelResponse, modelName) {
  const newEntry = {
    timestamp: new Date().toISOString(),
    model: modelName,
    prompt: userPrompt,
    response: modelResponse,
  }

  let history = []
  if (fs.existsSync(HISTORY_FILE)) {
    const fileContent = fs.readFileSync(HISTORY_FILE, 'utf8')
    if (fileContent.trim() !== '') {
      try {
        history = JSON.parse(fileContent)
      } catch (e) {
        console.warn(
          chalk.yellow('Advertencia: Historial corrupto. Se sobreescribirá.')
        )
      }
    }
  }

  history.push(newEntry)
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8')
}

// Funciones para manejar el progreso del audio
function loadAudioProgress() {
  if (!fs.existsSync(AUDIO_PROGRESS_FILE)) {
    return { lastProcessedIndex: -1 }
  }
  try {
    const content = fs.readFileSync(AUDIO_PROGRESS_FILE, 'utf8')
    return JSON.parse(content)
  } catch (e) {
    console.warn(
      chalk.yellow(
        'Advertencia: Archivo de progreso de audio corrupto. Iniciando desde el principio.'
      )
    )
    return { lastProcessedIndex: -1 }
  }
}

function saveAudioProgress(index) {
  fs.writeFileSync(
    AUDIO_PROGRESS_FILE,
    JSON.stringify({ lastProcessedIndex: index }, null, 2),
    'utf8'
  )
}

function clearAudioProgress() {
  if (fs.existsSync(AUDIO_PROGRESS_FILE)) {
    fs.unlinkSync(AUDIO_PROGRESS_FILE)
    console.log(chalk.green('Progreso de audio limpiado.'))
  }
}

function splitTextIntoChunks(text) {
  const lines = text.split('\n')
  const chunks = []
  // Split into chunks of TEXT_CHUNK_SIZE lines, ensuring no empty chunks
  for (let i = 0; i < lines.length; i += TEXT_CHUNK_SIZE) {
    const chunk = lines
      .slice(i, i + TEXT_CHUNK_SIZE)
      .join('\n')
      .trim()
    if (chunk) {
      // Only add non-empty chunks
      chunks.push(chunk)
    }
  }
  return chunks
}

// --- MODIFICACIÓN: Usa fs.promises.writeFile para async/await ---
async function saveBinaryFile(fileName, content) {
  try {
    await fs.promises.writeFile(fileName, content)
    console.log(chalk.green(`Archivo ${fileName} guardado exitosamente.`))
  } catch (err) {
    console.error(chalk.red(`Error writing file ${fileName}:`), err)
    throw err
  }
}

// --- Procesamiento de Argumentos ---
let args = process.argv.slice(2)
let modelName = DEFAULT_MODEL
let interactiveChat = false
let stream = false
let generateAudio = false // Para la generación de audio de texto largo (en chunks)
let userPrompt = ''
let imagePath = ''
let filePath = ''
let systemInstruction = ''
let maxOutputTokens = undefined
let temperature = undefined
let verbose = false
let clearAudioProg = false
let tts = false // Para la generación de audio de un prompt único
// --- MODIFICACIÓN: Nuevas variables para speakingRate y pitch ---
let customSpeakingRate = 0.8;
let customPitch = -2.0;

for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  const nextArg = args[i + 1]
  switch (arg) {
    case '--model':
      if (nextArg) {
        modelName = nextArg
        i++
      } else {
        console.error(chalk.red('Error: --model requiere un argumento.'))
        usage()
      }
      break
    case '--chat':
      interactiveChat = true
      break
    case '--stream':
      stream = true
      break
    case '--image':
      if (nextArg) {
        imagePath = nextArg
        i++
      } else {
        console.error(chalk.red('Error: --image requiere una ruta de archivo.'))
        usage()
      }
      break
    case '--file':
      if (nextArg) {
        filePath = nextArg
        i++
      } else {
        console.error(chalk.red('Error: --file requiere una ruta de archivo.'))
        usage()
      }
      break
    case '--audio': // Flag para generación de audio en chunks
      generateAudio = true
      break
    case '--tts': // Flag para generación de audio de un prompt único
      tts = true
      break
    case '--system-instruction':
      if (nextArg) {
        systemInstruction = nextArg
        i++
      } else {
        console.error(
          chalk.red('Error: --system-instruction requiere un argumento.')
        )
        usage()
      }
      break
    case '--max-tokens':
      if (nextArg && !isNaN(parseInt(nextArg))) {
        maxOutputTokens = parseInt(nextArg)
        i++
      } else {
        console.error(
          chalk.red('Error: --max-tokens requiere un número entero válido.')
        )
        usage()
      }
      break
    case '--temperature':
      if (nextArg && !isNaN(parseFloat(nextArg))) {
        temperature = parseFloat(nextArg)
        i++
      } else {
        console.error(
          chalk.red('Error: --temperature requiere un número válido (ej. 0.7).')
        )
        usage()
      }
      break
    // --- MODIFICACIÓN: Manejar argumentos --speaking-rate y --pitch ---
    case '--speaking-rate':
        if (nextArg && !isNaN(parseFloat(nextArg))) {
            customSpeakingRate = parseFloat(nextArg);
            i++;
        } else {
            console.error(chalk.red('Error: --speaking-rate requiere un número válido (ej. 1.2).'));
            usage();
        }
        break;
    case '--pitch':
        if (nextArg && !isNaN(parseFloat(nextArg))) {
            customPitch = parseFloat(nextArg);
            i++;
        } else {
            console.error(chalk.red('Error: --pitch requiere un número válido (ej. 3.0).'));
            usage();
        }
        break;
    // --- Fin de modificación ---
    case '--verbose':
      verbose = true
      break
    case '--clear-audio-progress':
      clearAudioProg = true
      break
    case '--help':
      usage()
      break
    default:
      userPrompt += (userPrompt ? ' ' : '') + arg
      break
  }
}

// --- Validaciones ---
if (clearAudioProg) {
  clearAudioProgress()
  process.exit(0)
}

// Validaciones para --audio y --tts
if (generateAudio && tts) {
  console.error(
    chalk.red('Error: Las opciones --audio y --tts son mutuamente excluyentes.')
  )
  usage()
}
if (imagePath && (generateAudio || tts)) {
  console.error(
    chalk.red(
      'Error: Las opciones --audio y --tts no son compatibles con --image. El audio se genera a partir de texto.'
    )
  )
  usage()
}

// Validaciones generales
if (!interactiveChat && !userPrompt && !generateAudio && !tts && !filePath) {
  console.error(
    chalk.red(
      'Error: Se requiere un prompt, un archivo (--file), --chat, --audio o --tts.'
    )
  )
  usage()
}
if (interactiveChat && (imagePath || filePath || generateAudio || tts)) {
  console.error(
    chalk.red(
      'Error: Las opciones --image, --file, --audio y --tts no son compatibles con el modo --chat.'
    )
  )
  usage()
}
if (imagePath && filePath) {
  console.error(
    chalk.red(
      'Error: No se pueden usar las opciones --image y --file al mismo tiempo.'
    )
  )
  usage()
}
// Note: --tts is compatible with --file, so no explicit check here, it's handled by logic.

// --- Configuración de generación para TEXTO ---
const textGenerationConfig = {}
if (maxOutputTokens !== undefined) {
  textGenerationConfig.maxOutputTokens = maxOutputTokens
}
if (temperature !== undefined) {
  textGenerationConfig.temperature = temperature
}

// --- MODIFICACIÓN: Función para TTS (prompt único) - Ahora acepta speakingRate y pitch ---
async function generateTTS(promptText, baseFileName = 'respuesta', speakingRate = 1.0, pitch = 0.0) {
  const audioGenerationConfig = {
    responseModalities: ['audio'],
    config: {
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: AUDIO_VOICE,
          },
        },
        speakingRate: speakingRate, // Pasa el valor
        pitch: pitch,               // Pasa el valor
      },
    },
  }

  try {
    const responseStream = await ttsAI.models.generateContentStream({
      model: AUDIO_MODEL,
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      config: audioGenerationConfig,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        // --- MODIFICACIÓN: Añadir regla de seguridad para contenido sexual explícito ---
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    })

    let combinedAudioBuffer = Buffer.alloc(0)
    let firstAudioChunkReceived = false
    let audioMimeType = null // Para almacenar el mimeType del primer chunk de audio

    for await (const chunk of responseStream) {
      if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
        const inlineData = chunk.candidates[0].content.parts[0].inlineData
        const buffer = Buffer.from(inlineData.data || '', 'base64')
        combinedAudioBuffer = Buffer.concat([combinedAudioBuffer, buffer])
        firstAudioChunkReceived = true
        if (!audioMimeType) {
          audioMimeType = inlineData.mimeType // Guarda el mimeType
        }
      } else if (verbose && chunk.text) {
        // Esto es si el stream envía también chunks de texto, lo cual es menos común para audio puro
        console.log(chalk.dim(`(Stream text chunk for TTS): ${chunk.text}`))
      }
    }

    if (combinedAudioBuffer.length > 0) {
      let finalAudioBuffer = combinedAudioBuffer
      let fileExtension = 'wav' // Predeterminado a 'wav' ahora que lo estamos manejando

      if (audioMimeType) {
        fileExtension = mime.getExtension(audioMimeType) || 'wav' // Obtiene extensión o usa 'wav'
        if (verbose) {
            console.log(chalk.dim(`MimeType recibido: ${audioMimeType}, extensión sugerida: ${fileExtension}`))
        }

        // Si el mimeType es raw PCM o un WAV incompleto, convierte a WAV completo
        if (audioMimeType.startsWith('audio/L') || audioMimeType === 'audio/x-wav' || fileExtension === 'wav') {
            try {
                // `convertToWav` espera el rawData como string base64, no el Buffer
                finalAudioBuffer = convertToWav(Buffer.from(combinedAudioBuffer).toString('base64'), audioMimeType)
                fileExtension = 'wav' // Asegura que la extensión sea .wav
            } catch (wavError) {
                console.warn(chalk.yellow(`Advertencia: Fallo al convertir a WAV, intentando guardar como ${fileExtension}: ${wavError.message}`))
                // Si falla la conversión a WAV, se queda con el buffer original
                finalAudioBuffer = combinedAudioBuffer
            }
        }
      } else {
          console.warn(chalk.yellow('Advertencia: No se recibió información de mimeType. Se intentará guardar como WAV.'))
          // Si no hay mimeType, intenta como WAV
          try {
              finalAudioBuffer = convertToWav(Buffer.from(combinedAudioBuffer).toString('base64'), 'audio/L16;rate=24000') // Asume un formato común
              fileExtension = 'wav'
          } catch (wavError) {
              console.warn(chalk.yellow(`Advertencia: Fallo al asumir WAV: ${wavError.message}. Guardando como un archivo binario genérico.`))
              fileExtension = 'bin' // Último recurso
          }
      }

      const outputFile = `${baseFileName}.${fileExtension}`
      await saveBinaryFile(outputFile, finalAudioBuffer)
      console.log(chalk.bold.green(`Audio guardado en ${outputFile}`))
    } else if (!firstAudioChunkReceived) {
      const finishReason =
        responseStream.response?.candidates?.[0]?.finishReason
      if (finishReason === 'SAFETY') {
        console.error(
          chalk.red(
            `El contenido fue bloqueado por políticas de seguridad. No se generó audio.`
          )
        )
      } else {
        console.warn(
          chalk.yellow('Advertencia: No se recibió audio para el prompt TTS.')
        )
      }
    }
  } catch (e) {
    console.error(chalk.red('Error al generar audio (TTS):'), e.message)
    throw e // Re-throw to be caught by the run() function
  }
}

// --- Lógica Principal Asíncrona ---
async function run() {
  const model = genAI.getGenerativeModel({ model: modelName })

  if (tts) {
    // --- MODO TTS (prompt único) ---
    try {
      let promptText = userPrompt
      if (filePath) {
        if (!fs.existsSync(filePath)) {
          console.error(chalk.red(`El archivo no existe: ${filePath}`))
          process.exit(1)
        }
        const fileContent = fs.readFileSync(filePath, 'utf8')
        // Si hay prompt y archivo, se combinan. Si solo hay archivo, se usa su contenido.
        promptText = userPrompt
          ? `Basado en el contenido del siguiente archivo, responde a mi pregunta.\n\n--- INICIO DEL ARCHIVO: ${path.basename(
              filePath
            )} ---\n\n${fileContent}\n\n--- FIN DEL ARCHIVO ---\n\nMi pregunta es: ${userPrompt}`
          : fileContent
      } else if (!userPrompt) {
        console.error(
          chalk.red('Error: --tts requiere un prompt o un archivo (--file).')
        )
        usage()
      }
      // --- MODIFICACIÓN: Pasar los nuevos argumentos a generateTTS ---
      await generateTTS(
        promptText,
        'respuesta_tts',
        customSpeakingRate !== undefined ? customSpeakingRate : 1.0, // Usar 1.0 por defecto
        customPitch !== undefined ? customPitch : 0.0                // Usar 0.0 por defecto
      );
    } catch (e) {
      process.exit(1)
    }
    return // Salir después de la ejecución de TTS
  }

  if (generateAudio) {
    // --- MODO GENERACIÓN DE AUDIO (texto largo en chunks) ---
    if (!userPrompt && !filePath) {
      console.error(
        chalk.red('Error: --audio requiere un prompt o un archivo (--file).')
      )
      usage()
    }

    let textToSynthesize = userPrompt
    if (filePath) {
      try {
        if (!fs.existsSync(filePath)) {
          throw new Error(`El archivo no existe en la ruta: ${filePath}`)
        }
        textToSynthesize = fs.readFileSync(filePath, 'utf8')
        console.log(chalk.blue(`Leyendo texto del archivo: ${filePath}`))
      } catch (e) {
        console.error(
          chalk.red(`Error al leer el archivo para audio: ${e.message}`)
        )
        process.exit(1)
      }
    }

    const textChunks = splitTextIntoChunks(textToSynthesize)
    if (textChunks.length === 0) {
      console.warn(
        chalk.yellow(
          'Advertencia: El texto proporcionado está vacío o no contiene contenido significativo para generar audio.'
        )
      )
      process.exit(0)
    }
    console.log(
      chalk.bold.yellow(
        `Generando audio con el modelo: ${AUDIO_MODEL} (voz: ${AUDIO_VOICE})`
      )
    )
    console.log(
      chalk.yellow(
        `Dividiendo el texto en ${textChunks.length} fragmentos de hasta ${TEXT_CHUNK_SIZE} líneas.`
      )
    )

    let { lastProcessedIndex } = loadAudioProgress()
    console.log(
      chalk.blue(`Reanudando desde el chunk: ${lastProcessedIndex + 1}`)
    )

    const MAX_RETRIES = 5

    for (let i = lastProcessedIndex + 1; i < textChunks.length; i++) {
      const chunk = textChunks[i]
      if (!chunk.trim()) {
        // Double-check, though splitTextIntoChunks should prevent this
        console.log(chalk.dim(`Saltando chunk ${i} vacío.`))
        saveAudioProgress(i)
        continue
      }

      if (verbose) {
        console.log(
          chalk.dim(
            `\nProcesando chunk de texto ${i} (${chunk.length} caracteres):\n---\n${chunk}\n---`
          )
        )
      }

      let chunkProcessedSuccessfully = false
      let retries = 0

      while (!chunkProcessedSuccessfully && retries < MAX_RETRIES) {
        try {
          const audioGenerationConfig = {
            responseModalities: ['audio'],
            config: {
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: AUDIO_VOICE,
                  },
                },
                // --- MODIFICACIÓN: Pasa speakingRate y pitch a cada chunk ---
                speakingRate: customSpeakingRate !== undefined ? customSpeakingRate : 1.0,
                pitch: customPitch !== undefined ? customPitch : 0.0,
              },
            },
          }

          const contents = [
            {
              role: 'user',
              parts: [{ text: chunk }],
            },
          ]

          const responseStream = await ttsAI.models.generateContentStream({
            model: AUDIO_MODEL,
            contents,
            config: audioGenerationConfig,
            safetySettings: [
              {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
              },
              // --- MODIFICACIÓN: Añadir regla de seguridad para contenido sexual explícito ---
              {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
              },
            ],
          })

          let combinedAudioBuffer = Buffer.alloc(0)
          let firstAudioChunkReceived = false
          let audioMimeType = null // Para almacenar el mimeType del primer chunk de audio

          for await (const audioChunk of responseStream) {
            // Iterar sobre el stream de audio
            if (audioChunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
              const inlineData =
                audioChunk.candidates[0].content.parts[0].inlineData
              const buffer = Buffer.from(inlineData.data || '', 'base64')
              combinedAudioBuffer = Buffer.concat([combinedAudioBuffer, buffer])
              firstAudioChunkReceived = true
              if (!audioMimeType) {
                audioMimeType = inlineData.mimeType // Guarda el mimeType
              }
            } else if (verbose && audioChunk.text) {
              console.log(chalk.dim(`(Stream text chunk): ${audioChunk.text}`))
            }
          }

          if (combinedAudioBuffer.length > 0) {
            let finalAudioBuffer = combinedAudioBuffer
            let fileExtension = 'wav'

            if (audioMimeType) {
                fileExtension = mime.getExtension(audioMimeType) || 'wav'
                if (verbose) {
                    console.log(chalk.dim(`MimeType recibido: ${audioMimeType}, extensión sugerida: ${fileExtension}`))
                }
                if (audioMimeType.startsWith('audio/L') || audioMimeType === 'audio/x-wav' || fileExtension === 'wav') {
                    try {
                        finalAudioBuffer = convertToWav(Buffer.from(combinedAudioBuffer).toString('base64'), audioMimeType)
                        fileExtension = 'wav'
                    } catch (wavError) {
                        console.warn(chalk.yellow(`Advertencia: Fallo al convertir a WAV, intentando guardar como ${fileExtension}: ${wavError.message}`))
                        finalAudioBuffer = combinedAudioBuffer
                    }
                }
            } else {
                console.warn(chalk.yellow('Advertencia: No se recibió información de mimeType para el chunk. Se intentará guardar como WAV.'))
                try {
                    finalAudioBuffer = convertToWav(Buffer.from(combinedAudioBuffer).toString('base64'), 'audio/L16;rate=24000')
                    fileExtension = 'wav'
                } catch (wavError) {
                    console.warn(chalk.yellow(`Advertencia: Fallo al asumir WAV: ${wavError.message}. Guardando como un archivo binario genérico.`))
                    fileExtension = 'bin'
                }
            }

            const outputFileName = `audio_output_${String(i).padStart(3, '0')}.${fileExtension}`
            await saveBinaryFile(outputFileName, finalAudioBuffer)
            saveAudioProgress(i)
            chunkProcessedSuccessfully = true
          } else if (!firstAudioChunkReceived) {
            const finishReason =
              responseStream.response?.candidates?.[0]?.finishReason
            if (finishReason === 'SAFETY') {
              console.error(
                chalk.red(
                  `El contenido del chunk ${i} fue bloqueado por políticas de seguridad. Saltando este chunk.`
                )
              )
              saveAudioProgress(i) // Marcar como procesado para no reintentar
              chunkProcessedSuccessfully = true // Salir del bucle de reintentos
            } else {
              console.warn(
                chalk.yellow(
                  `Advertencia: No se recibió audio para el chunk ${i} después de procesar el stream. Razón: ${
                    finishReason || 'Desconocida'
                  }. Reintentando...`
                )
              )
              retries++
            }
          }
        } catch (error) {
          console.error(
            chalk.red(
              `\nError al generar audio para el chunk ${i} (intento ${
                retries + 1
              }/${MAX_RETRIES}):`
            ),
            error.message // Solo el mensaje del error para una salida más limpia
          )
          retries++
          if (
            error.message.includes('429') ||
            error.message.includes('503') ||
            error.message.includes('unavailable') ||
            error.message.includes('RESOURCE_EXHAUSTED')
          ) {
            const retryAfter = 5 + Math.pow(2, retries)
            console.log(
              chalk.yellow(
                `Excedida la cuota o servicio no disponible. Reintentando en ${retryAfter} segundos...`
              )
            )
            await new Promise((resolve) =>
              setTimeout(resolve, retryAfter * 1000)
            )
          } else {
            console.error(chalk.red('Error no reintentable. Terminando.'))
            process.exit(1)
          }
        }
      }

      if (!chunkProcessedSuccessfully) {
        console.error(
          chalk.red(
            `Falló la generación de audio para el chunk ${i} después de ${MAX_RETRIES} reintentos. Terminando.`
          )
        )
        process.exit(1)
      }
    }
    console.log(chalk.bold.green('\n¡Generación de audio completada!'))
    clearAudioProgress()
  } else if (interactiveChat) {
    // --- MODO CHAT INTERACTIVO ---
    console.log(
      chalk.bold.yellow(
        `Modo Chat. Modelo: ${modelName}. Escribe '${chalk.cyan(
          'exit'
        )}' o '${chalk.cyan('quit')}' para salir.`
      )
    )
    if (stream) console.log(chalk.yellow('Modo Streaming activado.'))

    const chatModel = genAI.getGenerativeModel({ model: modelName })
    const chat = chatModel.startChat({
      history: loadHistoryForChatSdk(),
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
    })

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    const question = (query) =>
      new Promise((resolve) => rl.question(query, resolve))

    while (true) {
      const prompt = await question(chalk.cyan('Tú: '))

      if (prompt.toLowerCase() === 'exit' || prompt.toLowerCase() === 'quit')
        break
      if (!prompt) continue

      console.log(chalk.bold.yellow('Gemini:'))
      let fullResponse = ''
      try {
        const modelMethod = stream ? 'sendMessageStream' : 'sendMessage'
        const result = await chat[modelMethod](prompt)

        if (stream) {
          for await (const chunk of result.stream) {
            const chunkText = chunk.text()
            process.stdout.write(chalk.yellow(chunkText))
            fullResponse += chunkText
          }
          console.log() // Nueva línea después del streaming
        } else {
          fullResponse = result.response.text()
          console.log(marked(fullResponse))
        }
        saveToHistory(prompt, fullResponse, modelName)
      } catch (error) {
        console.error(chalk.red('\nError:'), error.message)
      } finally {
        console.log('') // Una línea extra para la legibilidad en la consola
      }
    }
    rl.close()
    console.log(chalk.bold.yellow('\n¡Hasta pronto!'))
  } else {
    // --- MODO PROMPT ÚNICO (Texto/Multimodal) ---
    const model = genAI.getGenerativeModel({ model: modelName }) // Definir model aquí para este scope
    let contents = []
    let finalPromptText = userPrompt
    const contextString = buildContextString()

    // Si hay contexto general/local y no hay system-instruction explícita, se añade al prompt
    if (contextString && !systemInstruction) {
      finalPromptText = `${contextString}\n\n${userPrompt}`
    }

    if (filePath) {
      try {
        if (!fs.existsSync(filePath)) {
          throw new Error(`El archivo no existe en la ruta: ${filePath}`)
        }
        const fileContent = fs.readFileSync(filePath, 'utf8')
        finalPromptText = `Basado en el contenido del siguiente archivo, responde a mi pregunta.\n\n--- INICIO DEL ARCHIVO: ${path.basename(
          filePath
        )} ---\n\n${fileContent}\n\n--- FIN DEL ARCHIVO ---\n\nMi pregunta es: ${userPrompt}`
      } catch (e) {
        console.error(chalk.red(`Error al leer el archivo: ${e.message}`))
        process.exit(1)
      }
    }

    let userParts = [{ text: finalPromptText }]
    if (imagePath) {
      try {
        const imagePart = fileToGenerativePart(imagePath)
        userParts = [{ text: userPrompt }, imagePart]
      } catch (e) {
        console.error(chalk.red(`Error al procesar la imagen: ${e.message}`))
        process.exit(1)
      }
    }

    contents.push({ role: 'user', parts: userParts })

    console.log(chalk.bold.yellow('Gemini:'))
    let fullResponse = ''
    try {
      const modelMethod = stream ? 'generateContentStream' : 'generateContent'
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
      })

      if (stream) {
        for await (const chunk of result.stream) {
          const chunkText = chunk.text()
          process.stdout.write(chalk.yellow(chunkText))
          fullResponse += chunkText
        }
        console.log()
      } else {
        fullResponse = result.response.text()
        console.log(marked(fullResponse))
      }
      saveToHistory(userPrompt, fullResponse, modelName)
    } catch (error) {
      console.error(chalk.red('\nError:'), error.message)
    }
  }
}

run()


// --- NUEVAS FUNCIONES PARA CONVERTIR A WAV (estas deben estar al final del archivo) ---

/**
 * @typedef {Object} WavConversionOptions
 * @property {number} numChannels - Número de canales de audio (ej. 1 para mono, 2 para estéreo).
 * @property {number} sampleRate - Tasa de muestreo en Hz (ej. 24000).
 * @property {number} bitsPerSample - Bits por muestra (ej. 16).
 */

/**
 * Convierte datos de audio en bruto (base64) a un formato WAV añadiendo la cabecera.
 * @param {string} rawData - Datos de audio en bruto en formato base64.
 * @param {string} mimeType - El mimeType de los datos de audio en bruto (ej. "audio/L16;rate=24000").
 * @returns {Buffer} El buffer de audio con la cabecera WAV.
 */
function convertToWav(rawData, mimeType) {
  const options = parseMimeType(mimeType)
  // Decodifica los datos base64 primero para obtener la longitud del audio
  const buffer = Buffer.from(rawData, 'base64')
  const wavHeader = createWavHeader(buffer.length, options)

  return Buffer.concat([wavHeader, buffer])
}

/**
 * Parsea el mimeType para extraer opciones de conversión WAV.
 * @param {string} mimeType - El mimeType del audio (ej. "audio/L16;rate=24000").
 * @returns {WavConversionOptions} Las opciones de conversión.
 */
function parseMimeType(mimeType) {
  const [fileType, ...params] = mimeType.split(';').map((s) => s.trim())
  const [_, format] = fileType.split('/')

  /** @type {Partial<WavConversionOptions>} */
  const options = {
    numChannels: 1, // Por defecto, mono
    sampleRate: 24000, // Por defecto, 24kHz (común para Gemini TTS)
    bitsPerSample: 16, // Por defecto, 16 bits (común para Gemini TTS)
  }

  // Intenta parsear bits por muestra del formato de archivo (ej. L16)
  if (format && format.startsWith('L')) {
    const bits = parseInt(format.slice(1), 10)
    if (!isNaN(bits)) {
      options.bitsPerSample = bits
    }
  }

  // Parsea parámetros adicionales como la tasa de muestreo
  for (const param of params) {
    const [key, value] = param.split('=').map((s) => s.trim())
    if (key === 'rate') {
      options.sampleRate = parseInt(value, 10)
    }
  }

  // Asegura que todos los campos requeridos estén definidos, usando valores predeterminados si faltan
  if (options.numChannels === undefined) options.numChannels = 1;
  if (options.sampleRate === undefined) options.sampleRate = 24000;
  if (options.bitsPerSample === undefined) options.bitsPerSample = 16;

  return /** @type {WavConversionOptions} */ (options)
}

/**
 * Crea una cabecera WAV (RIFF) para datos de audio PCM.
 * @param {number} dataLength - La longitud de los datos de audio en bytes.
 * @param {WavConversionOptions} options - Opciones de formato de audio.
 * @returns {Buffer} El buffer que contiene la cabecera WAV.
 */
function createWavHeader(dataLength, options) {
  const { numChannels, sampleRate, bitsPerSample } = options

  // http://soundfile.sapp.org/doc/WaveFormat/

  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8
  const blockAlign = (numChannels * bitsPerSample) / 8
  const buffer = Buffer.alloc(44) // Tamaño estándar de cabecera WAV

  buffer.write('RIFF', 0) // ChunkID
  buffer.writeUInt32LE(36 + dataLength, 4) // ChunkSize
  buffer.write('WAVE', 8) // Format
  buffer.write('fmt ', 12) // Subchunk1ID
  buffer.writeUInt32LE(16, 16) // Subchunk1Size (PCM)
  buffer.writeUInt16LE(1, 20) // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22) // NumChannels
  buffer.writeUInt32LE(sampleRate, 24) // SampleRate
  buffer.writeUInt32LE(byteRate, 28) // ByteRate
  buffer.writeUInt16LE(blockAlign, 32) // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34) // BitsPerSample
  buffer.write('data', 36) // Subchunk2ID
  buffer.writeUInt32LE(dataLength, 40) // Subchunk2Size

  return buffer
}