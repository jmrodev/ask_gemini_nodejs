import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

// Function to save binary file
export function saveBinaryFile(fileName, content) {
  fs.writeFile(fileName, content, (err) => {
    if (err) {
      console.error(`Error writing file ${fileName}:`, err);
      return;
    }
    console.log(`File ${fileName} saved to file system.`);
  });
}

// Function to convert audio data to WAV format
export function convertToWav(rawData, mimeType) {
  const options = parseMimeType(mimeType);
  const wavHeader = createWavHeader(rawData.length, options);
  const buffer = Buffer.from(rawData, 'base64');
  return Buffer.concat([wavHeader, buffer]);
}

// Function to parse MIME type and extract audio parameters
export function parseMimeType(mimeType) {
  const [fileType, ...params] = mimeType.split(';').map(s => s.trim());
  const [_, format] = fileType.split('/');

  const options = {
    numChannels: 1,
    sampleRate: 24000, // Default sample rate
    bitsPerSample: 16  // Default bits per sample
  };

  if (format && format.startsWith('L')) {
    const bits = parseInt(format.slice(1), 10);
    if (!isNaN(bits)) {
      options.bitsPerSample = bits;
    }
  }

  for (const param of params) {
    const [key, value] = param.split('=').map(s => s.trim());
    if (key === 'rate') {
      options.sampleRate = parseInt(value, 10);
    }
  }

  return options;
}

// Function to create WAV header
export function createWavHeader(dataLength, options) {
  const {
    numChannels,
    sampleRate,
    bitsPerSample,
  } = options;

  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const buffer = Buffer.alloc(44);

  buffer.write('RIFF', 0);                      // ChunkID
  buffer.writeUInt32LE(36 + dataLength, 4);     // ChunkSize
  buffer.write('WAVE', 8);                      // Format
  buffer.write('fmt ', 12);                     // Subchunk1ID
  buffer.writeUInt32LE(16, 16);                 // Subchunk1Size (PCM)
  buffer.writeUInt16LE(1, 20);                  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);        // NumChannels
  buffer.writeUInt32LE(sampleRate, 24);         // SampleRate
  buffer.writeUInt32LE(byteRate, 28);           // ByteRate
  buffer.writeUInt16LE(blockAlign, 32);         // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34);      // BitsPerSample
  buffer.write('data', 36);                     // Subchunk2ID
  buffer.writeUInt32LE(dataLength, 40);         // Subchunk2Size

  return buffer;
}

// Main function to generate audio
export async function generateAudio(apiKey, text, outputDir = '.') {
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const config = {
    temperature: 1,
    responseModalities: ['audio'],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: 'Zephyr',
        }
      }
    },
  };

  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: text,
        },
      ],
    },
  ];

  const model = 'gemini-2.5-flash-preview-tts';
  const response = await genAI.generateContentStream({
    model,
    config,
    contents,
  });

  let fileIndex = 0;
  for await (const chunk of response) {
    if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
      continue;
    }
    if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
      const inlineData = chunk.candidates[0].content.parts[0].inlineData;
      let fileExtension = 'wav';
      let buffer = Buffer.from(inlineData.data, 'base64');
      
      // If the data is not already in WAV format, convert it
      if (!inlineData.mimeType?.toLowerCase().includes('wav')) {
        buffer = convertToWav(inlineData.data, inlineData.mimeType);
      }
      
      const fileName = path.join(outputDir, `output_${fileIndex++}.wav`);
      saveBinaryFile(fileName, buffer);
    }
  }
}
