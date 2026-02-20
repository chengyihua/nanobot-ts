
const z = require('zod');
// Use the exported path
const { CallToolResultSchema } = require('@modelcontextprotocol/sdk/types.js');

console.log('CallToolResultSchema type:', typeof CallToolResultSchema);
if (CallToolResultSchema) {
  console.log('Has safeParse:', typeof CallToolResultSchema.safeParse === 'function');
  console.log('Has _zod property:', !!CallToolResultSchema._zod);
  console.log('Keys:', Object.keys(CallToolResultSchema));
} else {
  console.log('CallToolResultSchema is undefined!');
}

// Access zod-compat via internal path if possible, or try to import it if exported
// The exports map has "./server": ...
// So require('@modelcontextprotocol/sdk/server/zod-compat.js') might work if mapped
// Or require('@modelcontextprotocol/sdk/server/zod-compat')

const compat = require('@modelcontextprotocol/sdk/server/zod-compat.js');
const safeParse = compat.safeParse;
console.log('safeParse imported from SDK compat');

try {
  const result = safeParse(CallToolResultSchema, { result: { content: [] } });
  console.log('SDK safeParse result:', result);
} catch (e) {
  console.error('SDK safeParse error:', e);
}
