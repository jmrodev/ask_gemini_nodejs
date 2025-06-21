// src/audio/messages.js
import chalk from 'chalk';

export const ERROR_TTS_NOT_IMPLEMENTED = chalk.red('Error: La generación de audio (TTS) aún no está implementada.');
export const WARN_TTS_SDK_NEEDED = chalk.yellow('Para implementar esta funcionalidad, necesitarás el SDK de @google-cloud/text-to-speech y un modelo como text-to-speech-001.');

export const ERROR_LONG_TTS_NOT_IMPLEMENTED = chalk.red('Error: La generación de audio largo (por chunks) aún no está implementada.');
export const WARN_LONG_TTS_COMPLEXITY = chalk.yellow('Esta funcionalidad es más compleja y requiere el SDK de @google-cloud/text-to-speech y manejo de streaming específico.');

export const WARN_AUDIO_PROGRESS_DISABLED = chalk.yellow('Advertencia: La limpieza del progreso de audio está deshabilitada (funcionalidad de audio no implementada).');
