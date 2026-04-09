import { Component, EventEmitter, inject, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Environment, KeyValuePair, createKeyValuePair, deepClone, generateId } from '../../models/api.models';
import { EnvironmentService } from '../../services/environment.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-environment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="close.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Manage Environments</h3>
          <button class="btn-icon" (click)="close.emit()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="modal-content">
          <!-- Environment List (left) -->
          <div class="env-list">
            <div class="env-list-header">
              <span>Environments</span>
              <button class="btn-xs btn-accent" (click)="addEnvironment()">+ New</button>
            </div>
            @for (env of envService.environments(); track env.id) {
              <div class="env-item" [class.active]="selectedEnvId === env.id" (click)="selectEnv(env)">
                <div class="env-item-info">
                  <span class="env-name">{{ env.name }}</span>
                  <span class="env-count">{{ env.variables.length }} vars</span>
                </div>
                <div class="env-item-actions">
                  <button class="btn-icon-xs" title="Duplicate" (click)="$event.stopPropagation(); envService.duplicateEnvironment(env.id)">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  </button>
                  <button class="btn-icon-xs btn-danger" title="Delete" (click)="$event.stopPropagation(); deleteEnv(env)">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
              </div>
            }
            @if (envService.environments().length === 0) {
              <div class="env-empty">No environments yet</div>
            }
          </div>

          <!-- Variable Editor (right) -->
          <div class="env-editor">
            @if (editingEnv) {
              <div class="env-editor-header">
                <input class="env-name-input" [(ngModel)]="editingEnv.name" placeholder="Environment Name" (ngModelChange)="markDirty()" />
                <button class="btn btn-save" (click)="saveEnv()">Save</button>
              </div>
              <div class="var-header">
                <span class="var-col">Variable</span>
                <span class="var-col">Value</span>
                <span class="var-act"></span>
              </div>
              <div class="var-list">
                @for (v of editingEnv.variables; track v.id; let i = $index) {
                  <div class="var-row" [class.disabled]="!v.enabled">
                    <input type="checkbox" class="var-check" [checked]="v.enabled" (change)="v.enabled = !v.enabled; markDirty()" />
                    <input class="var-input" [(ngModel)]="v.key" placeholder="Variable name" (ngModelChange)="markDirty()" />
                    <input class="var-input" [(ngModel)]="v.value" placeholder="Value" (ngModelChange)="markDirty()" />
                    <button class="btn-icon-xs btn-danger" (click)="removeVar(i)">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                }
              </div>
              <button class="btn-xs btn-ghost" (click)="addVar()">+ Add Variable</button>
            } @else {
              <div class="env-empty-editor">
                <p>Select an environment to edit its variables</p>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; }
    .modal { background: var(--surface-elevated); border: 1px solid var(--border-color); border-radius: 12px; width: 90%; max-width: 860px; height: 70vh; display: flex; flex-direction: column; box-shadow: var(--shadow-lg); animation: modalIn 0.2s ease; }
    @keyframes modalIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border-color); }
    .modal-header h3 { margin: 0; font-size: 15px; font-weight: 600; color: var(--text-primary); }
    .modal-content { flex: 1; display: flex; overflow: hidden; }
    .env-list { width: 220px; border-right: 1px solid var(--border-color); overflow-y: auto; padding: 8px; }
    .env-list-header { display: flex; align-items: center; justify-content: space-between; padding: 4px 8px 8px; font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
    .env-item { display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; border-radius: 5px; cursor: pointer; transition: background 0.12s; margin-bottom: 2px; }
    .env-item:hover { background: rgba(255,255,255,0.03); }
    .env-item.active { background: rgba(var(--accent-rgb),0.1); }
    .env-item-info { display: flex; flex-direction: column; gap: 2px; }
    .env-name { font-size: 12px; color: var(--text-primary); font-weight: 500; }
    .env-count { font-size: 10px; color: var(--text-muted); }
    .env-item-actions { display: flex; gap: 2px; opacity: 0; transition: opacity 0.12s; }
    .env-item:hover .env-item-actions { opacity: 1; }
    .env-empty { padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px; }
    .env-editor { flex: 1; display: flex; flex-direction: column; padding: 12px 16px; overflow-y: auto; }
    .env-editor-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .env-name-input { flex: 1; background: transparent; border: none; border-bottom: 1px solid var(--border-color); color: var(--text-primary); font-size: 15px; font-weight: 600; padding: 4px 0; outline: none; }
    .env-name-input:focus { border-bottom-color: var(--accent); }
    .var-header { display: flex; gap: 8px; padding: 0 0 6px 26px; font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .var-col { flex: 1; }
    .var-act { width: 28px; }
    .var-list { display: flex; flex-direction: column; gap: 3px; margin-bottom: 10px; }
    .var-row { display: flex; align-items: center; gap: 6px; }
    .var-row.disabled { opacity: 0.4; }
    .var-check { width: 14px; height: 14px; accent-color: var(--accent); cursor: pointer; }
    .var-input { flex: 1; background: var(--surface-secondary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); font-size: 11px; padding: 6px 8px; outline: none; font-family: 'JetBrains Mono', monospace; }
    .var-input:focus { border-color: var(--accent); }
    .env-empty-editor { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 13px; }
    .btn-icon { display: flex; align-items: center; justify-content: center; background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px; border-radius: 4px; }
    .btn-icon:hover { color: var(--text-primary); background: rgba(255,255,255,0.06); }
    .btn-icon-xs { display: flex; align-items: center; justify-content: center; background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 2px; border-radius: 3px; }
    .btn-icon-xs:hover { color: var(--text-primary); background: rgba(255,255,255,0.06); }
    .btn-danger:hover { color: var(--status-error) !important; }
    .btn { display: flex; align-items: center; gap: 5px; border: none; padding: 6px 14px; border-radius: 5px; font-size: 11px; font-weight: 500; cursor: pointer; }
    .btn-save { background: var(--accent); color: #fff; }
    .btn-save:hover { filter: brightness(1.1); }
    .btn-xs { font-size: 10px; padding: 3px 8px; border: none; border-radius: 3px; cursor: pointer; }
    .btn-accent { background: rgba(var(--accent-rgb),0.12); color: var(--accent); }
    .btn-accent:hover { background: rgba(var(--accent-rgb),0.2); }
    .btn-ghost { background: rgba(255,255,255,0.03); color: var(--text-secondary); }
    .btn-ghost:hover { background: rgba(255,255,255,0.06); }
  `],
})
export class EnvironmentModalComponent {
  @Output() close = new EventEmitter<void>();

  envService = inject(EnvironmentService);
  private toast = inject(ToastService);

  selectedEnvId: string | null = null;
  editingEnv: Environment | null = null;
  dirty = false;

  addEnvironment() {
    const name = prompt('Environment name:');
    if (name?.trim()) {
      this.envService.addEnvironment(name.trim());
      this.toast.success('Environment created');
    }
  }

  selectEnv(env: Environment) {
    this.selectedEnvId = env.id;
    this.editingEnv = deepClone(env);
    this.dirty = false;
  }

  deleteEnv(env: Environment) {
    if (confirm(`Delete environment "${env.name}"?`)) {
      this.envService.deleteEnvironment(env.id);
      if (this.selectedEnvId === env.id) {
        this.editingEnv = null;
        this.selectedEnvId = null;
      }
      this.toast.warning('Environment deleted');
    }
  }

  addVar() {
    if (this.editingEnv) {
      this.editingEnv.variables.push(createKeyValuePair());
      this.dirty = true;
    }
  }

  removeVar(index: number) {
    if (this.editingEnv) {
      this.editingEnv.variables.splice(index, 1);
      this.dirty = true;
    }
  }

  markDirty() {
    this.dirty = true;
  }

  saveEnv() {
    if (this.editingEnv) {
      this.envService.updateEnvironment(this.editingEnv);
      this.dirty = false;
      this.toast.success('Environment saved');
    }
  }
}
