import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiRequest, ApiResponse, ResponseCookie, ConsoleEntry, generateId } from '../models/api.models';
import { EnvironmentService } from './environment.service';

/**
 * ApiService handles HTTP request execution with full support for
 * authentication, body types, environment variables, and response parsing.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private envService = inject(EnvironmentService);

  /** Console log entries */
  consoleLogs: ConsoleEntry[] = [];

  /** Send an HTTP request with full configuration */
  sendRequest(request: ApiRequest): Observable<ApiResponse> {
    const startTime = performance.now();
    const resolvedUrl = this.buildUrl(request);

    // Build headers (auth + custom)
    let headers = this.buildHeaders(request);

    // Build body
    const body = this.buildBody(request);

    // Log to console
    this.logConsole('request', `${request.method} ${resolvedUrl}`, request.method, resolvedUrl);

    const options = {
      headers,
      observe: 'response' as const,
      responseType: 'text' as const,
    };

    let request$: Observable<HttpResponse<string>>;

    switch (request.method) {
      case 'POST':
        request$ = this.http.post(resolvedUrl, body, options);
        break;
      case 'PUT':
        request$ = this.http.put(resolvedUrl, body, options);
        break;
      case 'PATCH':
        request$ = this.http.patch(resolvedUrl, body, options);
        break;
      case 'DELETE':
        request$ = this.http.delete(resolvedUrl, options);
        break;
      case 'HEAD':
        request$ = this.http.head(resolvedUrl, options) as Observable<HttpResponse<string>>;
        break;
      case 'OPTIONS':
        request$ = this.http.options(resolvedUrl, options);
        break;
      case 'GET':
      default:
        request$ = this.http.get(resolvedUrl, options);
        break;
    }

    return request$.pipe(
      map((response) => {
        const apiResponse = this.buildResponse(response, startTime);
        this.logConsole('response', `${apiResponse.statusCode} ${apiResponse.statusText} — ${apiResponse.responseTime}ms`,
          request.method, resolvedUrl, apiResponse.statusCode);
        return apiResponse;
      }),
      catchError((error: HttpErrorResponse) => {
        const elapsed = Math.round(performance.now() - startTime);
        const rawBody = typeof error.error === 'string' ? error.error : JSON.stringify(error.error || error.message);
        const apiResponse: ApiResponse = {
          statusCode: error.status || 0,
          statusText: error.statusText || 'Network Error',
          headers: this.extractHeaders(error.headers),
          cookies: [],
          body: error.error || error.message,
          rawBody,
          responseTime: elapsed,
          size: new Blob([rawBody]).size,
        };
        this.logConsole('error', `${error.status || 0} ${error.statusText || 'Error'} — ${elapsed}ms`,
          request.method, resolvedUrl, error.status);
        return of(apiResponse);
      })
    );
  }

  /** Clear console logs */
  clearConsole(): void {
    this.consoleLogs = [];
  }

  // ──────────────────────────────────
  //  URL BUILDING
  // ──────────────────────────────────

  private buildUrl(request: ApiRequest): string {
    let url = this.envService.resolveVariables(request.url);

    // Add query params from the params array
    const enabledParams = request.params.filter((p) => p.enabled && p.key.trim());
    if (enabledParams.length > 0) {
      const searchParams = new URLSearchParams();
      // First, parse existing URL params
      try {
        const urlObj = new URL(url);
        urlObj.searchParams.forEach((v, k) => searchParams.set(k, v));
        // Add params from the params editor
        enabledParams.forEach((p) => {
          searchParams.set(
            this.envService.resolveVariables(p.key),
            this.envService.resolveVariables(p.value)
          );
        });
        urlObj.search = searchParams.toString();
        url = urlObj.toString();
      } catch {
        // If URL parsing fails, append manually
        const sep = url.includes('?') ? '&' : '?';
        const paramStr = enabledParams
          .map((p) => `${encodeURIComponent(this.envService.resolveVariables(p.key))}=${encodeURIComponent(this.envService.resolveVariables(p.value))}`)
          .join('&');
        url = url + sep + paramStr;
      }
    }

    // Add API key to query if configured
    if (request.auth.type === 'apikey' && request.auth.apikey.addTo === 'query') {
      const sep = url.includes('?') ? '&' : '?';
      url += `${sep}${encodeURIComponent(this.envService.resolveVariables(request.auth.apikey.key))}=${encodeURIComponent(this.envService.resolveVariables(request.auth.apikey.value))}`;
    }

    return url;
  }

  // ──────────────────────────────────
  //  HEADERS BUILDING
  // ──────────────────────────────────

  private buildHeaders(request: ApiRequest): HttpHeaders {
    let headers = new HttpHeaders();

    // Custom headers
    request.headers
      .filter((h) => h.enabled && h.key.trim())
      .forEach((h) => {
        headers = headers.set(
          this.envService.resolveVariables(h.key.trim()),
          this.envService.resolveVariables(h.value)
        );
      });

    // Auth headers
    switch (request.auth.type) {
      case 'basic': {
        const username = this.envService.resolveVariables(request.auth.basic.username);
        const password = this.envService.resolveVariables(request.auth.basic.password);
        const encoded = btoa(`${username}:${password}`);
        headers = headers.set('Authorization', `Basic ${encoded}`);
        break;
      }
      case 'bearer': {
        const token = this.envService.resolveVariables(request.auth.bearer.token);
        const prefix = request.auth.bearer.prefix || 'Bearer';
        headers = headers.set('Authorization', `${prefix} ${token}`);
        break;
      }
      case 'apikey': {
        if (request.auth.apikey.addTo === 'header') {
          headers = headers.set(
            this.envService.resolveVariables(request.auth.apikey.key),
            this.envService.resolveVariables(request.auth.apikey.value)
          );
        }
        break;
      }
    }

    // Content-Type for body types (if not already set)
    if (!headers.has('Content-Type') && request.method !== 'GET' && request.method !== 'HEAD') {
      switch (request.body.type) {
        case 'json':
          headers = headers.set('Content-Type', 'application/json');
          break;
        case 'xml':
          headers = headers.set('Content-Type', 'application/xml');
          break;
        case 'html':
          headers = headers.set('Content-Type', 'text/html');
          break;
        case 'text':
          headers = headers.set('Content-Type', 'text/plain');
          break;
        case 'urlencoded':
          headers = headers.set('Content-Type', 'application/x-www-form-urlencoded');
          break;
        case 'graphql':
          headers = headers.set('Content-Type', 'application/json');
          break;
      }
    }

    return headers;
  }

  // ──────────────────────────────────
  //  BODY BUILDING
  // ──────────────────────────────────

  private buildBody(request: ApiRequest): any {
    if (request.method === 'GET' || request.method === 'HEAD') return null;

    switch (request.body.type) {
      case 'none':
        return null;
      case 'json': {
        const raw = this.envService.resolveVariables(request.body.raw);
        try { return JSON.parse(raw); } catch { return raw; }
      }
      case 'text':
      case 'xml':
      case 'html':
        return this.envService.resolveVariables(request.body.raw);
      case 'urlencoded': {
        const params = new URLSearchParams();
        request.body.urlEncoded
          .filter((p) => p.enabled && p.key.trim())
          .forEach((p) => params.set(
            this.envService.resolveVariables(p.key),
            this.envService.resolveVariables(p.value)
          ));
        return params.toString();
      }
      case 'formdata': {
        const formData = new FormData();
        request.body.formData
          .filter((p) => p.enabled && p.key.trim())
          .forEach((p) => formData.append(
            this.envService.resolveVariables(p.key),
            this.envService.resolveVariables(p.value)
          ));
        return formData;
      }
      case 'graphql': {
        const query = this.envService.resolveVariables(request.body.graphql.query);
        let variables = {};
        try { variables = JSON.parse(this.envService.resolveVariables(request.body.graphql.variables)); } catch {}
        return JSON.stringify({ query, variables });
      }
      default:
        return null;
    }
  }

  // ──────────────────────────────────
  //  RESPONSE PARSING
  // ──────────────────────────────────

  private buildResponse(response: HttpResponse<string>, startTime: number): ApiResponse {
    const elapsed = Math.round(performance.now() - startTime);
    const rawBody = response.body || '';
    const headers = this.extractHeaders(response.headers);
    const cookies = this.parseCookies(response.headers);

    let body: any = rawBody;
    try { body = JSON.parse(rawBody); } catch {}

    return {
      statusCode: response.status,
      statusText: response.statusText || 'OK',
      headers,
      cookies,
      body,
      rawBody,
      responseTime: elapsed,
      size: new Blob([rawBody]).size,
    };
  }

  private extractHeaders(httpHeaders: any): Record<string, string> {
    const result: Record<string, string> = {};
    if (httpHeaders && httpHeaders.keys) {
      httpHeaders.keys().forEach((key: string) => {
        result[key] = httpHeaders.get(key) || '';
      });
    }
    return result;
  }

  private parseCookies(httpHeaders: any): ResponseCookie[] {
    // Browser restricts Set-Cookie headers in CORS, but we try to parse what's available
    const cookies: ResponseCookie[] = [];
    const cookieHeader = httpHeaders?.get?.('set-cookie');
    if (!cookieHeader) return cookies;

    cookieHeader.split(',').forEach((cookieStr: string) => {
      const parts = cookieStr.split(';').map((p: string) => p.trim());
      const [nameValue, ...attrs] = parts;
      const [name, ...valueParts] = nameValue.split('=');
      const value = valueParts.join('=');

      const cookie: ResponseCookie = {
        name: name?.trim() || '',
        value: value || '',
        domain: '',
        path: '/',
        expires: '',
        httpOnly: false,
        secure: false,
        sameSite: '',
      };

      attrs.forEach((attr) => {
        const [aKey, ...aValParts] = attr.split('=');
        const aVal = aValParts.join('=');
        switch (aKey.toLowerCase()) {
          case 'domain': cookie.domain = aVal; break;
          case 'path': cookie.path = aVal; break;
          case 'expires': cookie.expires = aVal; break;
          case 'httponly': cookie.httpOnly = true; break;
          case 'secure': cookie.secure = true; break;
          case 'samesite': cookie.sameSite = aVal; break;
        }
      });

      if (cookie.name) cookies.push(cookie);
    });

    return cookies;
  }

  // ──────────────────────────────────
  //  CONSOLE LOGGING
  // ──────────────────────────────────

  private logConsole(type: ConsoleEntry['type'], message: string, method?: any, url?: string, statusCode?: number): void {
    this.consoleLogs.unshift({
      id: generateId(),
      type,
      timestamp: Date.now(),
      method,
      url,
      statusCode,
      message,
    });
    // Keep max 200 entries
    if (this.consoleLogs.length > 200) {
      this.consoleLogs = this.consoleLogs.slice(0, 200);
    }
  }
}
