
require('dotenv').config();
const OpenAI = require('openai');

const client = new OpenAI();

async function main() {
  try {
    const stream = await client.responses.create({
      model: 'gpt-4o-mini',
      input: [{ role: 'user', content: 'What are the latest developments in AI?' }],
      stream: true,
      tools: [
        {
          type: 'web_search_preview',
        },
      ],
    });

    console.log('--- Starting Stream ---');
    for await (const event of stream) {
      console.log('--- Event Received ---');
      console.log(JSON.stringify(event, null, 2));
    }
    console.log('--- Stream Ended ---');

  } catch (error) {
    console.error('Error during API call:', error);
  }
}

main();
