
import fetch from 'node-fetch';

const apiKey = 'dcbf71346ee64225a798e64645c8479e.RgPfSEESmYXoT5ah';
const url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

async function testZhipuWithTools() {
  console.log('Testing Zhipu GLM-5 with Tools...');
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
          { role: 'user', content: 'What is the weather in Beijing?' }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get current weather',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' }
                },
                required: ['location']
              }
            }
          }
        ],
        tool_choice: 'auto'
      })
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testZhipuWithTools();
