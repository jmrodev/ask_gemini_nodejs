// src/models/geminiService.js

import { HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import chalk from 'chalk';

/**
 * Obtiene y configura una instancia del modelo generativo.
 * @param {GoogleGenerativeAI} genAI Instancia de GoogleGenerativeAI.
 * @param {string} modelName El nombre del modelo a usar (ej., 'models/gemini-1.5-flash').
 * @param {string} [systemInstruction=''] Instrucción del sistema opcional para el modelo.
 * @returns {GenerativeModel} La instancia del modelo configurada.
 */
export function getGenerativeModel(genAI, modelName, systemInstruction = '') {
  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemInstruction
      ? { parts: [{ text: systemInstruction }] }
      : undefined,
  });
}

/**
 * Envía un mensaje al modelo y obtiene una respuesta no stream.
 * @param {GenerativeModel} model Instancia del modelo.
 * @param {Array<Object>} contents Contenido a enviar al modelo.
 * @param {Object} generationConfig Configuración de generación opcional.
 * @returns {Promise<Object>} La respuesta del modelo.
 */
export async function sendMessage(model, contents, generationConfig = {}) {
  const result = await model.generateContent({
    contents,
    generationConfig,
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ],
  });
  return result.response;
}

/**
 * Envía un mensaje al modelo y obtiene una respuesta en stream.
 * @param {GenerativeModel} model Instancia del modelo.
 * @param {Array<Object>} contents Contenido a enviar al modelo.
 * @param {Object} generationConfig Configuración de generación opcional.
 * @returns {Promise<AsyncIterable<Object>>} Un iterable asíncrono de chunks de respuesta.
 */
export async function sendMessageStream(model, contents, generationConfig = {}) {
  const result = await model.generateContentStream({
    contents,
    generationConfig,
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ],
  });
  return result.stream;
}