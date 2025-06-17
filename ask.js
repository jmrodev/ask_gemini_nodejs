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
import { fileURLToPath } from 'url'
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
//const AUDIO_MODEL = 'gemini-2.5-pro-preview-tts' // Modelo TTS de alta calidad
const AUDIO_MODEL = 'gemini-2.5-flash-preview-tts'
const AUDIO_VOICE = 'Zephyr'
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

function saveBinaryFile(fileName, content) {
  return new Promise((resolve, reject) => {
    fs.writeFile(fileName, content, (err) => {
      if (err) {
        console.error(chalk.red(`Error writing file ${fileName}:`), err)
        return reject(err)
      }
      console.log(chalk.green(`Archivo ${fileName} guardado exitosamente.`))
      resolve()
    })
  })
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

// --- Función para TTS (prompt único) ---
async function generateTTS(promptText, outputFile = 'respuesta.mp3') {
  const audioGenerationConfig = {
    responseModalities: ['audio'],
    config: {
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: AUDIO_VOICE,
          },
        },
      },
    },
  }

  try {
    const responseStream = await ttsAI.models.generateContentStream({
      model: AUDIO_MODEL,
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      config: audioGenerationConfig,
      safetySettings: [
        // Add safety settings for TTS model as well
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    })

    let combinedAudioBuffer = Buffer.alloc(0)
    let firstAudioChunkReceived = false

    for await (const chunk of responseStream) {
      if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
        const inlineData = chunk.candidates[0].content.parts[0].inlineData
        const buffer = Buffer.from(inlineData.data || '', 'base64')
        combinedAudioBuffer = Buffer.concat([combinedAudioBuffer, buffer])
        firstAudioChunkReceived = true
      } else if (verbose && chunk.text) {
        console.log(chalk.dim(`(Stream text chunk for TTS): ${chunk.text}`))
      }
    }

    if (combinedAudioBuffer.length > 0) {
      await saveBinaryFile(outputFile, combinedAudioBuffer)
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
      await generateTTS(promptText, 'respuesta_tts.mp3') // Guarda como un único archivo
    } catch (e) {
      // Error ya manejado dentro de generateTTS, solo salimos si es un error crítico
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
            // Usar ttsAI y generateContentStream
            model: AUDIO_MODEL,
            contents,
            config: audioGenerationConfig,
            safetySettings: [
              {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
              },
            ],
          })

          let combinedAudioBuffer = Buffer.alloc(0)
          let firstAudioChunkReceived = false

          for await (const audioChunk of responseStream) {
            // Iterar sobre el stream de audio
            if (audioChunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
              const inlineData =
                audioChunk.candidates[0].content.parts[0].inlineData
              const buffer = Buffer.from(inlineData.data || '', 'base64')
              combinedAudioBuffer = Buffer.concat([combinedAudioBuffer, buffer])
              firstAudioChunkReceived = true
            } else if (verbose && audioChunk.text) {
              console.log(chalk.dim(`(Stream text chunk): ${audioChunk.text}`))
            }
          }

          if (combinedAudioBuffer.length > 0) {
            // Asume MP3. Si el mimeType fuera diferente, usar mime.getExtension
            const outputFileName = `audio_output_${String(i).padStart(
              3,
              '0'
            )}.mp3`
            await saveBinaryFile(outputFileName, combinedAudioBuffer)
            saveAudioProgress(i)
            chunkProcessedSuccessfully = true
          } else if (!firstAudioChunkReceived) {
            // No audio data at all after streaming
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
            error.message.includes('RESOURCE_EXHAUSTED') // Añadir este código de error común
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

    const chat = model.startChat({
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
