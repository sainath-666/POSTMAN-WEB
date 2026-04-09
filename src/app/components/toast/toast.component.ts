import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [ngClass]="'toast-' + toast.type">
          <span class="toast-icon">
            @switch (toast.type) {
              @case ('success') { ✓ }
              @case ('error') { ✕ }
              @case ('warning') { ⚠ }
              @case ('info') { ℹ }
            }
          </span>
          <span class="toast-message">{{ toast.message }}</span>
          <button class="toast-close" (click)="toastService.dismiss(toast.id)">×</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container { position: fixed; bottom: 32px; right: 20px; z-index: 10000; display: flex; flex-direction: column-reverse; gap: 6px; max-width: 380px; }
    .toast { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-radius: 8px; font-size: 12px; color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,0.35); animation: toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1); backdrop-filter: blur(16px); }
    .toast-success { background: linear-gradient(135deg, rgba(76,175,80,0.92), rgba(56,142,60,0.92)); }
    .toast-error { background: linear-gradient(135deg, rgba(244,67,54,0.92), rgba(211,47,47,0.92)); }
    .toast-warning { background: linear-gradient(135deg, rgba(255,193,7,0.92), rgba(245,166,35,0.92)); color: #1a1a2e; }
    .toast-info { background: linear-gradient(135deg, rgba(99,102,241,0.92), rgba(79,70,229,0.92)); }
    .toast-icon { font-size: 14px; font-weight: 700; flex-shrink: 0; }
    .toast-message { flex: 1; font-weight: 500; }
    .toast-close { background: none; border: none; color: inherit; font-size: 16px; cursor: pointer; padding: 0 2px; opacity: 0.7; flex-shrink: 0; }
    .toast-close:hover { opacity: 1; }
    @keyframes toastIn { from { transform: translateX(100%) scale(0.85); opacity: 0; } to { transform: translateX(0) scale(1); opacity: 1; } }
  `],
})
export class ToastComponent {
  toastService = inject(ToastService);
}
