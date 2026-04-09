import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiRequest, ApiResponse, ApiHeader } from '../models/api.models';

/**
 * ApiService handles the execution of HTTP requests using Angular's HttpClient.
 * It dynamically constructs requests based on the user's configuration.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  /**
   * Send an HTTP request and return a normalized ApiResponse.
   * Measures response time and handles errors gracefully.
   */
  sendRequest(request: ApiRequest): Observable<ApiResponse> {
    const startTime = performance.now();

    // Build headers
    let headers = new HttpHeaders();
    request.headers
      .filter((h) => h.key.trim() !== '')
      .forEach((h) => {
        headers = headers.set(h.key.trim(), h.value);
      });

    // Parse body for non-GET requests
    let body: any = null;
    if (request.method !== 'GET' && request.body) {
      try {
        body = JSON.parse(request.body);
      } catch {
        body = request.body; // Send as raw string if not valid JSON
      }
    }

    const options = {
      headers,
      observe: 'response' as const,
      responseType: 'text' as const,
    };

    let request$: Observable<HttpResponse<string>>;

    switch (request.method) {
      case 'GET':
        request$ = this.http.get(request.url, options);
        break;
      case 'POST':
        request$ = this.http.post(request.url, body, options);
        break;
      case 'PUT':
        request$ = this.http.put(request.url, body, options);
        break;
      case 'DELETE':
        request$ = this.http.delete(request.url, options);
        break;
      case 'PATCH':
        request$ = this.http.patch(request.url, body, options);
        break;
      default:
        request$ = this.http.get(request.url, options);
    }

    return request$.pipe(
      map((response) => this.buildApiResponse(response, startTime)),
      catchError((error: HttpErrorResponse) => {
        const elapsed = Math.round(performance.now() - startTime);
        const apiResponse: ApiResponse = {
          statusCode: error.status || 0,
          statusText: error.statusText || 'Unknown Error',
          headers: {},
          body: error.error || error.message,
          responseTime: elapsed,
        };
        return of(apiResponse);
      })
    );
  }

  /** Convert HttpResponse to our ApiResponse model */
  private buildApiResponse(response: HttpResponse<string>, startTime: number): ApiResponse {
    const elapsed = Math.round(performance.now() - startTime);

    // Extract headers into a plain object
    const headers: Record<string, string> = {};
    response.headers.keys().forEach((key) => {
      headers[key] = response.headers.get(key) || '';
    });

    // Try parsing body as JSON
    let body: any = response.body;
    try {
      body = JSON.parse(response.body || '');
    } catch {
      // Keep as string if not JSON
    }

    return {
      statusCode: response.status,
      statusText: response.statusText,
      headers,
      body,
      responseTime: elapsed,
    };
  }
}
