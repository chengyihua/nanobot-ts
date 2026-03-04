
import fetch from 'node-fetch';

const apiKey = 'dcbf71346ee64225a798e64645c8479e.RgPfSEESmYXoT5ah';
const url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

async function testZhipu() {
  console.log('Testing Zhipu GLM-5...');
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-5',
        messages: [
          { role: 'user', content: 'Hello, are you working?' }
        ]
      })
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testZhipu();
