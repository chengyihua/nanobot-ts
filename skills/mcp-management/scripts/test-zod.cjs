
const z = require('zod');

console.log('Zod version:', require('zod/package.json').version);

const schema = z.object({ foo: z.string() });

// console.log('Is Zod schema:', schema instanceof z.ZodSchema); // Removed
console.log('Has safeParse:', typeof schema.safeParse === 'function');
console.log('Has _zod property:', !!schema._zod);
console.log('schema._zod type:', typeof schema._zod);
console.log('Keys on schema:', Object.keys(schema));

try {
  const result = schema.safeParse({ foo: 'bar' });
  console.log('safeParse result:', result);
} catch (e) {
  console.error('safeParse error:', e);
}

// Check if SDK's isZ4Schema works
const isZ4Schema = (s) => !!s._zod;
console.log('isZ4Schema check:', isZ4Schema(schema));
