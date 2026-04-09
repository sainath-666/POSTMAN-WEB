import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ApiCollection, ApiRequest, CollectionFolder,
  HttpMethod, KeyValuePair,
  generateId, createDefaultAuth, createDefaultBody, createKeyValuePair
} from '../models/api.models';
import { StorageService } from './storage.service';

/**
 * SwaggerService — Fetches & parses Swagger/OpenAPI specs (v2 & v3),
 * converting them into fully-typed ApiCollections with tagged folders.
 *
 * Handles:
 *  - Swagger 2.0 & OpenAPI 3.x specs (JSON)
 *  - ASP.NET Swagger UI HTML pages (auto-discovers spec URL)
 *  - Java/Spring Swagger UI pages
 *  - CORS bypass via Angular dev-server proxy
 */
@Injectable({ providedIn: 'root' })
export class SwaggerService {
  private http = inject(HttpClient);
  private storage = inject(StorageService);

  /**
   * Fetch the Swagger/OpenAPI JSON from a URL.
   * Intelligently resolves Swagger UI pages → raw JSON endpoints.
   * Routes through proxy to bypass CORS.
   */
  async fetchSpec(url: string): Promise<any> {
    url = url.trim().replace(/#.*$/, '');  // strip hash fragments

    // If the URL is clearly a JSON spec URL, fetch directly
    if (this.isSpecUrl(url)) {
      return this.fetchJson(url);
    }

    // If it's a Swagger UI page, try to discover the spec URL
    // by fetching the HTML and parsing the config
    if (this.isSwaggerUiUrl(url)) {
      return this.discoverAndFetchSpec(url);
    }

    // Otherwise just try to fetch it as JSON directly
    return this.fetchJson(url);
  }

  /**
   * Convert a raw Swagger/OpenAPI spec into an ApiCollection.
   */
  parseSpec(spec: any): ApiCollection {
    const isV3 = spec.openapi && spec.openapi.startsWith('3');
    const title = spec.info?.title || 'Imported API';
    const description = spec.info?.description || '';
    const version = spec.info?.version || '';
    const baseUrl = this.resolveBaseUrl(spec, isV3);

    // Build requests from paths
    const tagMap = new Map<string, ApiRequest[]>();
    const untaggedRequests: ApiRequest[] = [];

    const paths = spec.paths || {};
    for (const [path, methods] of Object.entries<any>(paths)) {
      for (const [method, operation] of Object.entries<any>(methods)) {
        if (['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].indexOf(method.toLowerCase()) === -1) continue;

        const request = this.buildRequest(method, path, operation, baseUrl, spec, isV3);
        const tags: string[] = operation.tags && operation.tags.length > 0 ? operation.tags : [];

        if (tags.length === 0) {
          untaggedRequests.push(request);
        } else {
          for (const tag of tags) {
            if (!tagMap.has(tag)) tagMap.set(tag, []);
            tagMap.get(tag)!.push(request);
          }
        }
      }
    }

    // Build folders from tags
    const folders: CollectionFolder[] = [];
    for (const [tag, requests] of tagMap) {
      folders.push({
        id: generateId(),
        name: tag,
        requests,
      });
    }

    const collection: ApiCollection = {
      id: generateId(),
      name: `${title}${version ? ' v' + version : ''}`,
      description,
      requests: untaggedRequests,
      folders,
    };

    return collection;
  }

  /**
   * Full flow: fetch → parse → save to storage.
   */
  async importFromUrl(url: string): Promise<{ collection: ApiCollection; collections: ApiCollection[] }> {
    const spec = await this.fetchSpec(url);
    const collection = this.parseSpec(spec);

    const existing = this.storage.getCollections();
    existing.push(collection);
    this.storage.saveCollections(existing);

    return { collection, collections: existing };
  }

  /**
   * Import from raw JSON string (paste fallback — no CORS issues).
   */
  importFromJson(jsonString: string): { collection: ApiCollection; collections: ApiCollection[] } {
    try {
      const spec = JSON.parse(jsonString);
      if (!spec.paths && !spec.openapi && !spec.swagger) {
        throw new Error('This does not look like a valid Swagger/OpenAPI spec');
      }
      const collection = this.parseSpec(spec);

      const existing = this.storage.getCollections();
      existing.push(collection);
      this.storage.saveCollections(existing);

      return { collection, collections: existing };
    } catch (e: any) {
      if (e.message?.includes('Swagger/OpenAPI')) throw e;
      throw new Error('Invalid JSON. Please paste a valid Swagger/OpenAPI spec JSON.');
    }
  }

  /**
   * Preview from raw JSON string.
   */
  previewFromJson(jsonString: string): { spec: any; collection: ApiCollection } {
    const spec = JSON.parse(jsonString);
    if (!spec.paths && !spec.openapi && !spec.swagger) {
      throw new Error('This does not look like a valid Swagger/OpenAPI spec');
    }
    const collection = this.parseSpec(spec);
    return { spec, collection };
  }

  /**
   * Preview without persisting.
   */
  async previewFromUrl(url: string): Promise<{ spec: any; collection: ApiCollection }> {
    const spec = await this.fetchSpec(url);
    const collection = this.parseSpec(spec);
    return { spec, collection };
  }

  // ──────────────────────────────────
  //  FETCHING HELPERS
  // ──────────────────────────────────

  /**
   * Fetch JSON through the CORS proxy.
   */
  private fetchJson(url: string): Promise<any> {
    const proxyUrl = `/swagger-proxy?url=${encodeURIComponent(url)}`;
    return new Promise((resolve, reject) => {
      this.http.get<any>(proxyUrl).subscribe({
        next: (data) => {
          // Validate it looks like a spec
          if (data && (data.paths || data.openapi || data.swagger)) {
            resolve(data);
          } else {
            reject(new Error('The URL did not return a valid Swagger/OpenAPI spec.'));
          }
        },
        error: (err) => reject(new Error(
          `Failed to fetch spec: ${err.status === 0 ? 'Network error or CORS blocked' : err.message || err.statusText || 'Unknown error'}`
        )),
      });
    });
  }

  /**
   * Fetch the Swagger UI HTML page, extract the spec URL from it,
   * then fetch the actual spec JSON.
   */
  private async discoverAndFetchSpec(uiUrl: string): Promise<any> {
    // Fetch the HTML page through proxy
    const proxyUrl = `/swagger-proxy?url=${encodeURIComponent(uiUrl)}`;
    const html = await new Promise<string>((resolve, reject) => {
      this.http.get(proxyUrl, { responseType: 'text' }).subscribe({
        next: (data) => resolve(data),
        error: () => reject(new Error('Failed to fetch the Swagger UI page.')),
      });
    });

    // Extract spec URL from the HTML
    const specUrl = this.extractSpecUrlFromHtml(html, uiUrl);
    if (specUrl) {
      return this.fetchJson(specUrl);
    }

    // If we can't extract from HTML, try common patterns
    return this.tryCommonSpecUrls(uiUrl);
  }

  /**
   * Parse the Swagger UI HTML to find the spec URL.
   * Handles ASP.NET, Springdoc, and standard swagger-ui patterns.
   */
  private extractSpecUrlFromHtml(html: string, uiUrl: string): string | null {
    const baseUrl = this.getBaseFromUrl(uiUrl);

    // Pattern 1: ASP.NET — configObject with urls array
    //   JSON.parse('{"urls":[{"url":"v1/swagger.json", ...}], ...}')
    const configMatch = html.match(/configObject\s*=\s*JSON\.parse\('([^']+)'\)/);
    if (configMatch) {
      try {
        const config = JSON.parse(configMatch[1]);
        if (config.urls && config.urls.length > 0) {
          let specPath = config.urls[0].url;
          if (!specPath.startsWith('http') && !specPath.startsWith('/')) {
            // Relative to the swagger UI page directory
            const swaggerDir = uiUrl.substring(0, uiUrl.lastIndexOf('/') + 1);
            specPath = swaggerDir + specPath;
          } else if (specPath.startsWith('/')) {
            specPath = baseUrl + specPath;
          }
          return specPath;
        }
        if (config.url) {
          let specPath = config.url;
          if (!specPath.startsWith('http') && !specPath.startsWith('/')) {
            const swaggerDir = uiUrl.substring(0, uiUrl.lastIndexOf('/') + 1);
            specPath = swaggerDir + specPath;
          } else if (specPath.startsWith('/')) {
            specPath = baseUrl + specPath;
          }
          return specPath;
        }
      } catch {}
    }

    // Pattern 2: Standard SwaggerUI({ url: "..." }) or SwaggerUIBundle({ url: "..." })
    const urlMatch = html.match(/SwaggerUI(?:Bundle)?\s*\(\s*\{[^}]*url\s*:\s*["']([^"']+)["']/);
    if (urlMatch) {
      let specPath = urlMatch[1];
      if (!specPath.startsWith('http')) {
        specPath = specPath.startsWith('/') ? baseUrl + specPath : baseUrl + '/' + specPath;
      }
      return specPath;
    }

    // Pattern 3: configUrl or spec-url in HTML attributes
    const configUrlMatch = html.match(/(?:configUrl|spec-url)\s*[=:]\s*["']([^"']+)["']/);
    if (configUrlMatch) {
      let specPath = configUrlMatch[1];
      if (!specPath.startsWith('http')) {
        specPath = specPath.startsWith('/') ? baseUrl + specPath : baseUrl + '/' + specPath;
      }
      return specPath;
    }

    return null;
  }

  /**
   * Try common spec URL patterns when HTML parsing fails.
   */
  private async tryCommonSpecUrls(uiUrl: string): Promise<any> {
    const baseUrl = this.getBaseFromUrl(uiUrl);

    // Order: most common patterns first
    const candidates = [
      // ASP.NET patterns
      baseUrl + '/swagger/v1/swagger.json',
      baseUrl + '/swagger/v2/swagger.json',
      // Spring / Springdoc patterns
      baseUrl + '/v3/api-docs',
      baseUrl + '/v2/api-docs',
      // Standard patterns
      baseUrl + '/swagger.json',
      baseUrl + '/openapi.json',
      baseUrl + '/api-docs',
    ];

    for (const candidate of candidates) {
      try {
        const result = await this.fetchJson(candidate);
        return result;
      } catch {
        // Try next candidate
      }
    }

    throw new Error(
      'Could not find the Swagger/OpenAPI spec. Try pasting the direct JSON URL instead ' +
      '(e.g. .../swagger/v1/swagger.json or .../v3/api-docs).\n' +
      'Or use the "Paste JSON" tab and paste the spec JSON directly.'
    );
  }

  // ──────────────────────────────────
  //  URL HELPERS
  // ──────────────────────────────────

  private isSpecUrl(url: string): boolean {
    return /swagger\.json|openapi\.json|api-docs/i.test(url);
  }

  private isSwaggerUiUrl(url: string): boolean {
    return /swagger.*\.(html?)$|swagger-ui|swagger\/index/i.test(url);
  }

  private getBaseFromUrl(url: string): string {
    try {
      const u = new URL(url);
      return u.origin;
    } catch {
      return '';
    }
  }

  // ──────────────────────────────────
  //  SPEC PARSING HELPERS
  // ──────────────────────────────────

  private resolveBaseUrl(spec: any, isV3: boolean): string {
    if (isV3) {
      if (spec.servers && spec.servers.length > 0) {
        return spec.servers[0].url.replace(/\/+$/, '');
      }
      return '';
    } else {
      const scheme = spec.schemes?.[0] || 'https';
      const host = spec.host || '';
      const basePath = spec.basePath || '';
      if (!host) return basePath;
      return `${scheme}://${host}${basePath}`.replace(/\/+$/, '');
    }
  }

  private buildRequest(
    method: string,
    path: string,
    operation: any,
    baseUrl: string,
    spec: any,
    isV3: boolean
  ): ApiRequest {
    const httpMethod = method.toUpperCase() as HttpMethod;
    const name = operation.summary || operation.operationId || `${httpMethod} ${path}`;

    const fullUrl = baseUrl + path;

    const params: KeyValuePair[] = [];
    const headers: KeyValuePair[] = [];
    const allParams = [...(operation.parameters || [])];

    for (const param of allParams) {
      const resolved = this.resolveRef(param, spec);

      if (resolved.in === 'query') {
        params.push(createKeyValuePair(
          resolved.name,
          resolved.example?.toString() || resolved.default?.toString() || '',
          !resolved.required ? false : true
        ));
      } else if (resolved.in === 'header') {
        headers.push(createKeyValuePair(
          resolved.name,
          resolved.example?.toString() || resolved.default?.toString() || '',
          true
        ));
      }
    }

    if (params.length === 0) params.push(createKeyValuePair());
    if (headers.length === 0) headers.push(createKeyValuePair());

    const body = createDefaultBody();
    if (isV3 && operation.requestBody) {
      const content = operation.requestBody.content || {};
      if (content['application/json']) {
        body.type = 'json';
        const schema = this.resolveRef(content['application/json'].schema || {}, spec);
        body.raw = JSON.stringify(this.generateSampleFromSchema(schema, spec), null, 2);
      } else if (content['application/x-www-form-urlencoded']) {
        body.type = 'urlencoded';
        const schema = this.resolveRef(content['application/x-www-form-urlencoded'].schema || {}, spec);
        if (schema.properties) {
          body.urlEncoded = Object.entries(schema.properties).map(([key, prop]: [string, any]) =>
            createKeyValuePair(key, prop.example?.toString() || prop.default?.toString() || '', true)
          );
        }
      } else if (content['multipart/form-data']) {
        body.type = 'formdata';
        const schema = this.resolveRef(content['multipart/form-data'].schema || {}, spec);
        if (schema.properties) {
          body.formData = Object.entries(schema.properties).map(([key, prop]: [string, any]) =>
            createKeyValuePair(key, prop.example?.toString() || prop.default?.toString() || '', true)
          );
        }
      } else if (content['application/xml'] || content['text/xml']) {
        body.type = 'xml';
        body.raw = '<!-- XML body -->';
      } else if (content['text/plain']) {
        body.type = 'text';
        body.raw = '';
      }
    } else if (!isV3) {
      const bodyParam = allParams.find((p: any) => this.resolveRef(p, spec).in === 'body');
      if (bodyParam) {
        const resolved = this.resolveRef(bodyParam, spec);
        body.type = 'json';
        const schema = this.resolveRef(resolved.schema || {}, spec);
        body.raw = JSON.stringify(this.generateSampleFromSchema(schema, spec), null, 2);
      }
    }

    return {
      id: generateId(),
      name,
      method: httpMethod,
      url: fullUrl,
      params,
      headers,
      auth: createDefaultAuth(),
      body,
    };
  }

  private resolveRef(obj: any, spec: any): any {
    if (!obj || !obj.$ref) return obj;
    const refPath = obj.$ref.replace(/^#\//, '').split('/');
    let resolved = spec;
    for (const part of refPath) {
      resolved = resolved?.[part];
    }
    return resolved || obj;
  }

  private generateSampleFromSchema(schema: any, spec: any, depth = 0): any {
    if (!schema || depth > 4) return {};
    schema = this.resolveRef(schema, spec);

    if (schema.example !== undefined) return schema.example;

    switch (schema.type) {
      case 'string':
        if (schema.enum) return schema.enum[0];
        if (schema.format === 'date') return '2025-01-01';
        if (schema.format === 'date-time') return '2025-01-01T00:00:00Z';
        if (schema.format === 'email') return 'user@example.com';
        if (schema.format === 'uri' || schema.format === 'url') return 'https://example.com';
        return schema.default || 'string';

      case 'integer':
      case 'number':
        return schema.default ?? (schema.minimum ?? 0);

      case 'boolean':
        return schema.default ?? true;

      case 'array':
        if (schema.items) {
          return [this.generateSampleFromSchema(schema.items, spec, depth + 1)];
        }
        return [];

      case 'object':
      default:
        if (schema.properties) {
          const obj: Record<string, any> = {};
          for (const [key, prop] of Object.entries<any>(schema.properties)) {
            obj[key] = this.generateSampleFromSchema(prop, spec, depth + 1);
          }
          return obj;
        }
        if (schema.allOf) {
          let merged: Record<string, any> = {};
          for (const sub of schema.allOf) {
            const resolved = this.generateSampleFromSchema(sub, spec, depth + 1);
            merged = { ...merged, ...resolved };
          }
          return merged;
        }
        if (schema.oneOf || schema.anyOf) {
          const variants = schema.oneOf || schema.anyOf;
          return this.generateSampleFromSchema(variants[0], spec, depth + 1);
        }
        return {};
    }
  }
}
