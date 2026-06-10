import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

async function test() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    
    const response = await axios.get(url);
    const models = response.data.models.map(m => m.name);
    console.log('Available models:', models);
  } catch (e) {
    console.error('Error:', e.response ? e.response.data : e.message);
  }
}
test();
