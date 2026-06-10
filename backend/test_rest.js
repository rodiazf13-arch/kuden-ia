import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

async function test() {
  try {
    const text = 'hola mundo';
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`;
    
    const response = await axios.post(url, {
      model: "models/gemini-embedding-2",
      content: {
        parts: [{ text }]
      },
      outputDimensionality: 768
    });
    
    console.log('Success, vector size:', response.data.embedding.values.length);
  } catch (e) {
    console.error('Error:', e.response ? e.response.data : e.message);
  }
}
test();
