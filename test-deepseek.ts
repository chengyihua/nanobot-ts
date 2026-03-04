
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function testDeepSeek() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseURL = process.env.NANOBOT__PROVIDERS__DEEPSEEK__API_BASE || 'https://api.deepseek.com';

  console.log('Testing DeepSeek API...');
  console.log(`Base URL: ${baseURL}`);
  console.log(`API Key: ${apiKey ? 'Found' : 'Missing'}`);

  if (!apiKey) {
    console.error('❌ Missing DEEPSEEK_API_KEY');
    return;
  }

  const deepseek = createOpenAI({
    apiKey,
    baseURL,
  });

  try {
    console.log('Sending request...');
    const result = await generateText({
      model: deepseek('deepseek-chat'),
      prompt: 'Hello, are you working?',
      maxTokens: 50,
    });

    console.log('✅ Response received:');
    console.log(result.text);
  } catch (error: any) {
    console.error('❌ Error calling DeepSeek:', error.message);
    if (error.cause) console.error('Cause:', error.cause);
  }
}

testDeepSeek();
