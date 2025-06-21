// src/lib/userInput.js
import readline from 'readline';

let rlInstance = null;

function getRlInstance() {
  if (!rlInstance) {
    rlInstance = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return rlInstance;
}

/**
 * Prompts the user with a question and returns their input.
 * @param {string} query The question to ask the user.
 * @returns {Promise<string>} A promise that resolves with the user's input.
 */
export function questionUser(query) {
  const rl = getRlInstance();
  return new Promise((resolve) => rl.question(query, resolve));
}

/**
 * Closes the readline interface.
 */
export function closeUserInput() {
  const rl = getRlInstance();
  if (rl) {
    rl.close();
    rlInstance = null; // Reset for potential future uses (though typically script exits)
  }
}
