import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabService } from '../../services/tab.service';
import { CodeGeneratorService } from '../../services/code-generator.service';
import { ToastService } from '../../services/toast.service';
import { ApiResponse, CodeLanguage } from '../../models/api.models';

@Component({
  selector: 'app-response-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './response-viewer.component.html',
  styleUrl: './response-viewer.component.css',
})
export class ResponseViewerComponent {
  tabService = inject(TabService);
  private codeGen = inject(CodeGeneratorService);
  private toast = inject(ToastService);

  tab = this.tabService.activeTab;

  /** Active response sub-tab */
  activeSubTab: 'body' | 'headers' | 'cookies' = 'body';

  /** Body display mode */
  bodyView: 'pretty' | 'raw' | 'preview' = 'pretty';

  /** Code generation modal */
  showCodeGen = false;
  codeLanguage: CodeLanguage = 'curl';
  generatedCode = '';

  /** Code languages */
  codeLanguages: { value: CodeLanguage; label: string }[] = [
    { value: 'curl', label: 'cURL' },
    { value: 'javascript-fetch', label: 'JavaScript - Fetch' },
    { value: 'javascript-axios', label: 'JavaScript - Axios' },
    { value: 'python', label: 'Python - Requests' },
    { value: 'php', label: 'PHP - cURL' },
    { value: 'csharp', label: 'C# - HttpClient' },
  ];

  get response(): ApiResponse | null | undefined {
    return this.tab()?.response;
  }

  get isLoading(): boolean {
    return this.tab()?.isLoading || false;
  }

  // ═══════════════════════════════
  //  STATUS
  // ═══════════════════════════════

  getStatusClass(): string {
    if (!this.response) return '';
    const c = this.response.statusCode;
    if (c >= 200 && c < 300) return 'status-success';
    if (c >= 300 && c < 400) return 'status-redirect';
    if (c >= 400 && c < 500) return 'status-warning';
    if (c >= 500) return 'status-error';
    return 'status-error';
  }

  getStatusIcon(): string {
    if (!this.response) return '';
    const c = this.response.statusCode;
    if (c >= 200 && c < 300) return '✓';
    if (c >= 400) return '✕';
    return '→';
  }

  // ═══════════════════════════════
  //  BODY FORMATTING
  // ═══════════════════════════════

  getFormattedBody(): string {
    if (!this.response) return '';
    try {
      if (typeof this.response.body === 'object') {
        return JSON.stringify(this.response.body, null, 2);
      }
      const parsed = JSON.parse(this.response.body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return typeof this.response.body === 'string' ? this.response.body : String(this.response.body);
    }
  }

  getRawBody(): string {
    return this.response?.rawBody || '';
  }

  getDisplayBody(): string {
    if (this.bodyView === 'raw') return this.getRawBody();
    return this.getFormattedBody();
  }

  // ═══════════════════════════════
  //  SIZE FORMATTING
  // ═══════════════════════════════

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  // ═══════════════════════════════
  //  HEADERS & COOKIES
  // ═══════════════════════════════

  getHeaderEntries(): { key: string; value: string }[] {
    if (!this.response) return [];
    return Object.entries(this.response.headers).map(([key, value]) => ({ key, value }));
  }

  // ═══════════════════════════════
  //  COPY
  // ═══════════════════════════════

  copyBody() {
    const text = this.bodyView === 'raw' ? this.getRawBody() : this.getFormattedBody();
    navigator.clipboard.writeText(text).then(() => {
      this.toast.success('Copied to clipboard');
    }).catch(() => {
      this.toast.error('Failed to copy');
    });
  }

  copyText(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.toast.success('Copied');
    });
  }

  // ═══════════════════════════════
  //  CODE GENERATION
  // ═══════════════════════════════

  openCodeGen() {
    const tab = this.tab();
    if (!tab) return;
    this.showCodeGen = true;
    this.generateCode();
  }

  generateCode() {
    const tab = this.tab();
    if (!tab) return;
    this.generatedCode = this.codeGen.generate(tab.request, this.codeLanguage);
  }

  copyCode() {
    navigator.clipboard.writeText(this.generatedCode).then(() => {
      this.toast.success('Code copied to clipboard');
    });
  }

  closeCodeGen() {
    this.showCodeGen = false;
  }

  onLanguageChange(lang: CodeLanguage) {
    this.codeLanguage = lang;
    this.generateCode();
  }
}
