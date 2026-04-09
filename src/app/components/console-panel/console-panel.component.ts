import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { ConsoleEntry } from '../../models/api.models';

@Component({
  selector: 'app-console-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="console">
      <div class="console-toolbar">
        <span class="console-title">Console</span>
        <div class="console-actions">
          <span class="console-count">{{ apiService.consoleLogs.length }} entries</span>
          <button class="btn-xs btn-ghost" (click)="apiService.clearConsole()">Clear</button>
        </div>
      </div>
      <div class="console-logs">
        @for (entry of apiService.consoleLogs; track entry.id) {
          <div class="log-entry" [ngClass]="'log-' + entry.type">
            <span class="log-time">{{ formatTime(entry.timestamp) }}</span>
            <span class="log-type-badge">{{ entry.type | uppercase }}</span>
            @if (entry.method) {
              <span class="log-method">{{ entry.method }}</span>
            }
            <span class="log-message">{{ entry.message }}</span>
          </div>
        }
        @if (apiService.consoleLogs.length === 0) {
          <div class="console-empty">Console output will appear here</div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .console { display: flex; flex-direction: column; height: 100%; background: var(--surface-primary); }
    .console-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 6px 14px; border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
    .console-title { font-size: 11px; font-weight: 600; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px; }
    .console-actions { display: flex; align-items: center; gap: 8px; }
    .console-count { font-size: 10px; color: var(--text-muted); }
    .console-logs { flex: 1; overflow-y: auto; font-family: 'JetBrains Mono', monospace; font-size: 11px; }
    .console-logs::-webkit-scrollbar { width: 4px; }
    .console-logs::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 4px; }
    .log-entry { display: flex; align-items: center; gap: 8px; padding: 4px 14px; border-bottom: 1px solid rgba(255,255,255,0.015); transition: background 0.1s; }
    .log-entry:hover { background: rgba(255,255,255,0.02); }
    .log-time { color: var(--text-muted); font-size: 10px; flex-shrink: 0; }
    .log-type-badge { font-size: 8px; font-weight: 700; padding: 1px 4px; border-radius: 2px; flex-shrink: 0; text-transform: uppercase; }
    .log-request .log-type-badge { background: rgba(var(--method-post-rgb),0.1); color: var(--method-post); }
    .log-response .log-type-badge { background: rgba(var(--status-success-rgb),0.1); color: var(--status-success); }
    .log-error .log-type-badge { background: rgba(var(--status-error-rgb),0.1); color: var(--status-error); }
    .log-info .log-type-badge { background: rgba(var(--accent-rgb),0.1); color: var(--accent); }
    .log-method { font-weight: 600; color: var(--text-secondary); font-size: 10px; }
    .log-message { color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .console-empty { padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px; font-family: 'Inter', sans-serif; }
    .btn-xs { font-size: 10px; padding: 3px 8px; border: none; border-radius: 3px; cursor: pointer; }
    .btn-ghost { background: rgba(255,255,255,0.03); color: var(--text-secondary); }
    .btn-ghost:hover { background: rgba(255,255,255,0.06); }
  `],
})
export class ConsolePanelComponent {
  apiService = inject(ApiService);

  formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
