import { zodToJsonSchema } from 'zod-to-json-schema';

export type OpenRouterResponseFormat =
  | { type: 'json_object' }
  | {
      type: 'json_schema';
      json_schema: {
        name: string;
        strict: boolean;
        schema: Record<string, unknown>;
      };
    };

type ZodJsonSchemaConvertible = {
  toJSONSchema: () => Record<string, unknown>;
};

function hasZodJsonSchema(zodSchema: unknown): zodSchema is ZodJsonSchemaConvertible {
  return (
    typeof zodSchema === 'object' &&
    zodSchema !== null &&
    'toJSONSchema' in zodSchema &&
    typeof (zodSchema as ZodJsonSchemaConvertible).toJSONSchema === 'function'
  );
}

/**
 * Converts a Zod schema to a provider-safe JSON Schema object (no top-level $ref).
 * Zod 4: use native toJSONSchema(). Zod 3 fallback: zod-to-json-schema + inline definitions.
 */
function convertZodToJsonSchema(zodSchema: unknown, name: string): Record<string, unknown> {
  if (hasZodJsonSchema(zodSchema)) {
    const schema = { ...zodSchema.toJSONSchema() };
    delete schema.$schema;
    return schema;
  }

  const raw = zodToJsonSchema(zodSchema as Parameters<typeof zodToJsonSchema>[0], {
    name,
    $refStrategy: 'none',
  }) as Record<string, unknown>;

  if (typeof raw.$ref === 'string' && raw.definitions && typeof raw.definitions === 'object') {
    const defKey = raw.$ref.replace('#/definitions/', '');
    const resolved = (raw.definitions as Record<string, unknown>)[defKey];
    if (resolved && typeof resolved === 'object') {
      const schema = { ...(resolved as Record<string, unknown>) };
      delete schema.$schema;
      return schema;
    }
  }

  const schema = { ...raw };
  delete schema.$schema;
  delete schema.$ref;
  delete schema.definitions;
  return schema;
}

/**
 * Builds OpenRouter response_format. Prefers json_schema (strict) when enabled;
 * callers should fall back to json_object if the model/provider rejects it.
 *
 * @see https://openrouter.ai/docs/guides/features/structured-outputs
 */
export function buildOpenRouterResponseFormat(
  zodSchema: unknown,
  name: string,
): OpenRouterResponseFormat {
  // Opt-in: many models (e.g. minimax-m3) reject or return empty output with strict json_schema.
  const useJsonSchema = process.env.OPENROUTER_USE_JSON_SCHEMA === 'true';

  if (!useJsonSchema) {
    return { type: 'json_object' };
  }

  const schema = convertZodToJsonSchema(zodSchema, name);

  // OpenRouter strict mode requires a JSON Schema object with an explicit top-level type.
  if (typeof schema.type !== 'string') {
    schema.type = 'object';
  }

  return {
    type: 'json_schema',
    json_schema: {
      name,
      strict: true,
      schema,
    },
  };
}

export function openRouterPlugins(
  responseFormat: OpenRouterResponseFormat,
): Array<{ id: string }> | undefined {
  // Response Healing repairs markdown wrappers and minor JSON syntax issues.
  // @see https://openrouter.ai/docs/guides/features/plugins/response-healing
  if (responseFormat.type === 'json_schema' || responseFormat.type === 'json_object') {
    return [{ id: 'response-healing' }];
  }

  return undefined;
}

export function isStructuredOutputUnsupported(status: number, body: string): boolean {
  if (status !== 400 && status !== 422) {
    return false;
  }

  const lower = body.toLowerCase();
  return (
    lower.includes('response_format') ||
    lower.includes('json_schema') ||
    lower.includes('structured output') ||
    lower.includes('structured_output') ||
    lower.includes('undefined schema') ||
    lower.includes('reference to undefined')
  );
}
