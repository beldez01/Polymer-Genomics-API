/**
 * OpenAPI spec loader — fetches /api/openapi.json and parses into EndpointDoc objects
 * that match the shape used by the docs page.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Param {
  name: string;
  location: 'path' | 'query' | 'body';
  type: string;
  required: boolean;
  default?: string;
  description: string;
}

export interface EndpointDoc {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  title: string;
  tag: string;
  description: string;
  params: Param[];
  /** Only populated for static (hand-written) endpoints */
  examples?: { curl: string; python: string; r: string };
  /** Only populated for static (hand-written) endpoints */
  response?: string;
}

// ---------------------------------------------------------------------------
// OpenAPI 3.x minimal types (enough to parse what FastAPI generates)
// ---------------------------------------------------------------------------

interface OpenAPIParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: {
    type?: string;
    default?: unknown;
    enum?: string[];
    items?: { type?: string };
  };
}

interface OpenAPIRequestBody {
  content?: {
    [mediaType: string]: {
      schema?: {
        type?: string;
        properties?: Record<string, {
          type?: string;
          description?: string;
          default?: unknown;
          items?: { type?: string };
        }>;
        required?: string[];
        $ref?: string;
      };
    };
  };
}

interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
}

interface OpenAPISpec {
  paths: Record<string, Record<string, OpenAPIOperation>>;
  components?: {
    schemas?: Record<string, {
      type?: string;
      properties?: Record<string, {
        type?: string;
        description?: string;
        default?: unknown;
        items?: { type?: string };
      }>;
      required?: string[];
    }>;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function schemaTypeToString(schema?: { type?: string; items?: { type?: string } }): string {
  if (!schema) return 'any';
  if (schema.type === 'array') {
    return `${schema.items?.type ?? 'any'}[]`;
  }
  return schema.type ?? 'any';
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function resolveBodyParams(
  body: OpenAPIRequestBody | undefined,
  spec: OpenAPISpec,
): Param[] {
  if (!body?.content) return [];
  const jsonContent = body.content['application/json'];
  if (!jsonContent?.schema) return [];

  let schema = jsonContent.schema;

  // Resolve $ref
  if (schema.$ref) {
    const refName = schema.$ref.replace('#/components/schemas/', '');
    schema = spec.components?.schemas?.[refName] as typeof schema ?? schema;
  }

  if (!schema.properties) return [];
  const required = new Set(schema.required ?? []);

  return Object.entries(schema.properties).map(([name, prop]) => ({
    name,
    location: 'body' as const,
    type: schemaTypeToString(prop),
    required: required.has(name),
    ...(prop.default !== undefined ? { default: String(prop.default) } : {}),
    description: prop.description ?? '',
  }));
}

// ---------------------------------------------------------------------------
// Main loader
// ---------------------------------------------------------------------------

export async function loadEndpointsFromOpenAPI(): Promise<EndpointDoc[]> {
  const resp = await fetch('/api/openapi.json');
  if (!resp.ok) throw new Error(`OpenAPI fetch failed: ${resp.status}`);
  const spec: OpenAPISpec = await resp.json();

  const endpoints: EndpointDoc[] = [];
  const seenIds = new Set<string>();

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const httpMethod = method.toUpperCase();
      if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(httpMethod)) continue;

      const tag = operation.tags?.[0] ?? 'General';
      const title = operation.summary ?? operation.operationId ?? path;

      // Build a unique id
      let id = slugify(operation.operationId ?? `${httpMethod}-${path}`);
      if (seenIds.has(id)) id = `${id}-${httpMethod.toLowerCase()}`;
      seenIds.add(id);

      // Parse parameters
      const params: Param[] = [];
      if (operation.parameters) {
        for (const p of operation.parameters) {
          if (p.in === 'header' || p.in === 'cookie') continue;
          params.push({
            name: p.name,
            location: p.in,
            type: schemaTypeToString(p.schema),
            required: p.required ?? false,
            ...(p.schema?.default !== undefined ? { default: String(p.schema.default) } : {}),
            description: p.description ?? '',
          });
        }
      }

      // Body params
      params.push(...resolveBodyParams(operation.requestBody, spec));

      endpoints.push({
        id,
        method: httpMethod as EndpointDoc['method'],
        path,
        title,
        tag,
        description: operation.description ?? operation.summary ?? '',
        params,
      });
    }
  }

  return endpoints;
}

// ---------------------------------------------------------------------------
// Group by tag
// ---------------------------------------------------------------------------

export function groupByTag(endpoints: EndpointDoc[]): Map<string, EndpointDoc[]> {
  const groups = new Map<string, EndpointDoc[]>();
  for (const ep of endpoints) {
    const tag = ep.tag;
    if (!groups.has(tag)) groups.set(tag, []);
    groups.get(tag)!.push(ep);
  }
  return groups;
}
