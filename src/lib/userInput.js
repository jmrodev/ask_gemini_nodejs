// src/lib/userInput.js
import readline from 'readline';

let rlInstance = null;

function getRlInstance() {
  if (!rlInstance || rlInstance.closed) { // Añadir chequeo de rlInstance.closed
    rlInstance = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    // Manejar el evento 'close' para limpiar rlInstance
    rlInstance.on('close', () => {
      // console.log('Readline interface closed, rlInstance set to null.'); // Para depuración
      rlInstance = null;
    });
  }
  return rlInstance;
}

export function questionUser(query) {
  const rl = getRlInstance();
  return new Promise((resolve) => {
    if (rl && !rl.closed) {
      rl.question(query, resolve);
    } else {
      // console.warn('Attempted to use questionUser on a closed readline interface.'); // Para depuración
      resolve(''); // Evita que la app se cuelgue
    }
  });
}

export function closeUserInput() {
  if (rlInstance && !rlInstance.closed) { 
    // console.log('Closing readline interface.'); // Para depuración
    rlInstance.close();
    // rlInstance se volverá null por el manejador del evento 'close'
  }
}