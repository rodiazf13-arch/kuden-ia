import dotenv from 'dotenv';
dotenv.config();

import { generateEmbedding } from './ragService.js';

async function test() {
  try {
    console.log('Testing embedding...');
    const vector = await generateEmbedding('hola mundo', 'gemini');
    console.log('Embedding success. Vector size:', vector.length);
  } catch (e) {
    console.error('Test Failed:', e);
  }
}

test();
