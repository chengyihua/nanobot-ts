
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { safeParse } from '@modelcontextprotocol/sdk/server/zod-compat.js';

console.log('CallToolResultSchema type:', typeof CallToolResultSchema);
if (CallToolResultSchema) {
  console.log('Has safeParse:', typeof CallToolResultSchema.safeParse === 'function');
  // @ts-ignore
  console.log('Has _zod property:', !!CallToolResultSchema._zod);
}

try {
  const result = safeParse(CallToolResultSchema, { result: { content: [] } });
  console.log('SDK safeParse result:', result);
} catch (e) {
  console.error('SDK safeParse error:', e);
}
