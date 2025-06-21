// src/history/messages.js
import chalk from 'chalk';

export const WARN_HISTORY_PARSE_ERROR = (filePath) => chalk.yellow(
  `Advertencia: Error al leer/parsear el historial (${filePath}). Se iniciará un historial nuevo.`
);
export const WARN_HISTORY_CORRUPT_OVERWRITE = chalk.yellow(
  'Advertencia: Historial existente corrupto. Se sobreescribirá.'
);

export const INFO_HISTORY_CLEARED = chalk.green('Historial de chat limpiado.');
export const INFO_NO_HISTORY_TO_CLEAR = chalk.yellow('No hay historial de chat para limpiar.');
