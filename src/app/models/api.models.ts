/**
 * Data models for the Smart API Tester application.
 * These interfaces define the shape of requests, collections, and API responses.
 */

/** Represents a single key-value header pair */
export interface ApiHeader {
  key: string;
  value: string;
}

/** Represents a saved API request */
export interface ApiRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: ApiHeader[];
  body: string;
}

/** Represents a collection of API requests */
export interface ApiCollection {
  id: string;
  name: string;
  requests: ApiRequest[];
}

/** Supported HTTP methods */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** Represents the response from an API call */
export interface ApiResponse {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  responseTime: number;
}

/** Toast notification types */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

/** Toast notification model */
export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}
