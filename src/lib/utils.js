// src/lib/utils.js

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

// Función para procesar archivos de imagen para la API de Gemini
export function fileToGenerativePart(filePath) {
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

// Función auxiliar para leer contenido de archivos
export function readFileContent(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

// Función auxiliar para escribir contenido en archivos
export function writeFileContent(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (e) {
    console.error(chalk.red(`Error al escribir el archivo ${filePath}: ${e.message}`));
    throw e;
  }
}

// Función auxiliar para eliminar archivos
export function deleteFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}