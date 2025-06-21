// src/audio/speechService.js

// Importaciones para @google-cloud/text-to-speech irían aquí cuando se implemente
import * as Messages from './messages.js';


/**
 * Genera audio de texto usando la API de Text-to-Speech (a implementar).
 * Por ahora, solo es un stub.
 * @param {string} text El texto a convertir a voz.
 * @param {string} outputFile El nombre del archivo de salida.
 */
export async function generateSpeech(text, outputFile) {
  console.error(Messages.ERROR_TTS_NOT_IMPLEMENTED);
  console.warn(Messages.WARN_TTS_SDK_NEEDED);
  // Lógica futura de TTS iría aquí usando el SDK de @google-cloud/text-to-speech
  return false;
}

/**
 * Genera audio de texto largo en chunks usando la API de Text-to-Speech (a implementar).
 * Por ahora, solo es un stub.
 * @param {string} text El texto a convertir a voz.
 */
export async function generateLongSpeechInChunks(text) {
  console.error(Messages.ERROR_LONG_TTS_NOT_IMPLEMENTED);
  console.warn(Messages.WARN_LONG_TTS_COMPLEXITY);
  return false;
}

/**
 * Limpia el progreso de audio (si se hubiera implementado un sistema de progreso).
 * Por ahora, solo es un stub.
 */
export function clearAudioProgress() {
  console.warn(Messages.WARN_AUDIO_PROGRESS_DISABLED);
}