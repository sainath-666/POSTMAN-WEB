import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiResponse } from '../../models/api.models';

@Component({
  selector: 'app-response-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './response-viewer.component.html',
  styleUrl: './response-viewer.component.css',
})
export class ResponseViewerComponent {
  @Input() response: ApiResponse | null = null;
  @Input() isLoading: boolean = false;

  /** Toggle between formatted and raw view */
  showRaw: boolean = false;

  /** Get the CSS class for the status code badge */
  getStatusClass(): string {
    if (!this.response) return '';
    const code = this.response.statusCode;
    if (code >= 200 && code < 300) return 'status-success';
    if (code >= 400 && code < 500) return 'status-warning';
    if (code >= 500) return 'status-error';
    if (code === 0) return 'status-error';
    return 'status-info';
  }

  /** Format the response body as pretty JSON or plain text */
  getFormattedBody(): string {
    if (!this.response) return '';
    try {
      if (typeof this.response.body === 'object') {
        return JSON.stringify(this.response.body, null, 2);
      }
      // Try parsing as JSON for formatting
      const parsed = JSON.parse(this.response.body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return typeof this.response.body === 'string'
        ? this.response.body
        : String(this.response.body);
    }
  }

  /** Get raw response body as string */
  getRawBody(): string {
    if (!this.response) return '';
    if (typeof this.response.body === 'object') {
      return JSON.stringify(this.response.body);
    }
    return String(this.response.body);
  }

  /** Toggle raw/formatted view */
  toggleRaw(): void {
    this.showRaw = !this.showRaw;
  }

  /** Copy response body to clipboard */
  copyBody(): void {
    const text = this.showRaw ? this.getRawBody() : this.getFormattedBody();
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback: use textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  }

  /** Get response body size in a human readable format */
  getBodySize(): string {
    const text = this.getRawBody();
    const bytes = new Blob([text]).size;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /** Get response header entries as an array */
  getHeaderEntries(): { key: string; value: string }[] {
    if (!this.response) return [];
    return Object.entries(this.response.headers).map(([key, value]) => ({ key, value }));
  }
}
