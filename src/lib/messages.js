// src/lib/messages.js
import chalk from 'chalk';

export const ERROR_IMAGE_FILE_NOT_FOUND = (filePath) => `El archivo de imagen no existe: ${filePath}`;
export const ERROR_UNSUPPORTED_IMAGE_TYPE = (fileExt) => `Tipo de archivo de imagen no soportado: ${fileExt}`;
export const ERROR_WRITING_FILE = (filePath, message) => chalk.red(`Error al escribir el archivo ${filePath}: ${message}`);
