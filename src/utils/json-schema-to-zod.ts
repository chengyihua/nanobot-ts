
import { z } from 'zod';

export function jsonSchemaToZod(schema: any): z.ZodTypeAny {
  if (!schema) return z.any();

  switch (schema.type) {
    case 'string':
      return z.string().describe(schema.description || '');
    case 'number':
      return z.number().describe(schema.description || '');
    case 'integer':
      return z.number().int().describe(schema.description || '');
    case 'boolean':
      return z.boolean().describe(schema.description || '');
    case 'array':
      const itemSchema = schema.items ? jsonSchemaToZod(schema.items) : z.any();
      return z.array(itemSchema).describe(schema.description || '');
    case 'object':
      const shape: Record<string, z.ZodTypeAny> = {};
      if (schema.properties) {
        for (const [key, value] of Object.entries(schema.properties)) {
          shape[key] = jsonSchemaToZod(value);
          // Handle optional fields
          const isRequired = schema.required && Array.isArray(schema.required) && schema.required.includes(key);
          if (!isRequired) {
            shape[key] = shape[key].optional();
          }
        }
      }
      return z.object(shape).describe(schema.description || '').passthrough();
    default:
      return z.any().describe(schema.description || '');
  }
}
