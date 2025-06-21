// src/lib/utils.js

import fs from 'fs';
import path from 'path';
import * as M from './messages.js';
import * as C from '../constants.js'; // Assuming C.EMPTY_STRING exists

// Función para procesar archivos de imagen para la API de Gemini
export function fileToGenerativePart(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(M.ERROR_IMAGE_FILE_NOT_FOUND(filePath));
  }
  const fileExtension = path.extname(filePath).toLowerCase();
  const mimeTypeMap = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  const mimeType = mimeTypeMap[fileExtension];

  if (!mimeType) {
    throw new Error(M.ERROR_UNSUPPORTED_IMAGE_TYPE(fileExtension));
  }

  return {
    inlineData: {
      data: fs.readFileSync(filePath).toString('base64'),
      mimeType,
    },
  };
}

// Función auxiliar para leer contenido de archivos
export function readFileContent(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (error) {
    // Log error or handle as per application's error strategy, e.g., console.error
    // For now, mimics original behavior of returning empty string on error implicitly or file not existing
  }
  return C.EMPTY_STRING; // Return empty string if file doesn't exist or error
}

// Función auxiliar para escribir contenido en archivos
export function writeFileContent(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (e) {
    console.error(M.ERROR_WRITING_FILE(filePath, e.message));
    throw e; // Re-throw to allow calling function to handle if needed
  }
}

// Función auxiliar para eliminar archivos
export function deleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (error) {
    // Log error or handle, e.g., console.error(`Failed to delete ${filePath}: ${error.message}`);
    // For now, mimics original behavior of returning false on error implicitly
  }
  return false;
}