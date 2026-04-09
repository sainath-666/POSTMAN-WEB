import { Injectable, signal } from '@angular/core';
import { Toast, ToastType } from '../models/api.models';

/**
 * ToastService manages toast notifications displayed to the user.
 * Uses Angular signals for reactive state management.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  /** Reactive list of active toasts */
  toasts = signal<Toast[]>([]);

  /** Show a toast notification */
  show(message: string, type: ToastType = 'info', duration: number = 3000): void {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    const toast: Toast = { id, message, type };
    this.toasts.update((current) => [...current, toast]);

    // Auto-dismiss after duration
    setTimeout(() => this.dismiss(id), duration);
  }

  /** Dismiss a specific toast */
  dismiss(id: string): void {
    this.toasts.update((current) => current.filter((t) => t.id !== id));
  }

  // Convenience methods
  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error', 5000);
  }

  info(message: string): void {
    this.show(message, 'info');
  }

  warning(message: string): void {
    this.show(message, 'warning', 4000);
  }
}
