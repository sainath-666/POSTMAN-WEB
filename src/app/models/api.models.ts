/**
 * ═══════════════════════════════════════════════════════
 *  Smart API Tester — Complete Data Models
 *  Full-featured Postman-equivalent type definitions.
 * ═══════════════════════════════════════════════════════
 */

// ─── HTTP Methods ───
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

// ─── Key-Value Pair (reusable for params, headers, form data, env vars) ───
export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  description: string;
  enabled: boolean;
}

// ─── Authentication ───
export type AuthType = 'none' | 'basic' | 'bearer' | 'apikey';

export interface BasicAuth {
  username: string;
  password: string;
}

export interface BearerAuth {
  token: string;
  prefix: string; // default "Bearer"
}

export interface ApiKeyAuth {
  key: string;
  value: string;
  addTo: 'header' | 'query';
}

export interface AuthConfig {
  type: AuthType;
  basic: BasicAuth;
  bearer: BearerAuth;
  apikey: ApiKeyAuth;
}

// ─── Request Body ───
export type BodyType = 'none' | 'json' | 'text' | 'xml' | 'html' | 'formdata' | 'urlencoded' | 'graphql';

export interface GraphQLBody {
  query: string;
  variables: string;
}

export interface RequestBody {
  type: BodyType;
  raw: string;
  formData: KeyValuePair[];
  urlEncoded: KeyValuePair[];
  graphql: GraphQLBody;
}

// ─── API Request ───
export interface ApiRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  auth: AuthConfig;
  body: RequestBody;
}

// ─── Collection Folder ───
export interface CollectionFolder {
  id: string;
  name: string;
  requests: ApiRequest[];
}

// ─── Collection ───
export interface ApiCollection {
  id: string;
  name: string;
  description: string;
  requests: ApiRequest[];
  folders: CollectionFolder[];
}

// ─── Cookie (parsed from Set-Cookie headers) ───
export interface ResponseCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string;
}

// ─── API Response ───
export interface ApiResponse {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  cookies: ResponseCookie[];
  body: any;
  rawBody: string;
  responseTime: number;
  size: number;
}

// ─── Tab ───
export interface RequestTab {
  id: string;
  name: string;
  request: ApiRequest;
  response: ApiResponse | null;
  isLoading: boolean;
  isDirty: boolean;
  collectionId: string | null;
  folderId: string | null;
}

// ─── Environment ───
export interface Environment {
  id: string;
  name: string;
  variables: KeyValuePair[];
}

// ─── History Entry ───
export interface HistoryEntry {
  id: string;
  request: ApiRequest;
  statusCode: number;
  responseTime: number;
  timestamp: number;
}

// ─── Console Entry ───
export type ConsoleEntryType = 'request' | 'response' | 'error' | 'info';

export interface ConsoleEntry {
  id: string;
  type: ConsoleEntryType;
  timestamp: number;
  method?: HttpMethod;
  url?: string;
  statusCode?: number;
  message: string;
  details?: string;
}

// ─── Toast ───
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

// ─── Code Generation ───
export type CodeLanguage = 'curl' | 'javascript-fetch' | 'javascript-axios' | 'python' | 'php' | 'csharp';

// ─── Factory Functions ───

/** Create a new empty KeyValuePair */
export function createKeyValuePair(key = '', value = '', enabled = true): KeyValuePair {
  return {
    id: generateId(),
    key,
    value,
    description: '',
    enabled,
  };
}

/** Create a default AuthConfig */
export function createDefaultAuth(): AuthConfig {
  return {
    type: 'none',
    basic: { username: '', password: '' },
    bearer: { token: '', prefix: 'Bearer' },
    apikey: { key: '', value: '', addTo: 'header' },
  };
}

/** Create a default RequestBody */
export function createDefaultBody(): RequestBody {
  return {
    type: 'none',
    raw: '',
    formData: [createKeyValuePair()],
    urlEncoded: [createKeyValuePair()],
    graphql: { query: '', variables: '{}' },
  };
}

/** Create a blank API request */
export function createDefaultRequest(name = 'Untitled Request'): ApiRequest {
  return {
    id: generateId(),
    name,
    method: 'GET',
    url: '',
    params: [createKeyValuePair()],
    headers: [createKeyValuePair()],
    auth: createDefaultAuth(),
    body: createDefaultBody(),
  };
}

/** Generate a unique ID */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/** Deep clone any object */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
