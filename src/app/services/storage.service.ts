import { Injectable } from '@angular/core';
import {
  ApiCollection, ApiRequest, CollectionFolder, Environment, HistoryEntry,
  generateId, createDefaultRequest, deepClone
} from '../models/api.models';

/**
 * StorageService handles ALL localStorage persistence for the application.
 * Manages collections, environments, history, and user preferences.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly KEYS = {
    collections: 'sat-collections',
    environments: 'sat-environments',
    activeEnv: 'sat-active-env',
    history: 'sat-history',
    theme: 'sat-theme',
    sidebarWidth: 'sat-sidebar-width',
    consoleOpen: 'sat-console-open',
  };

  private readonly MAX_HISTORY = 100;

  // ──────────────────────────────────
  //  COLLECTIONS
  // ──────────────────────────────────

  getCollections(): ApiCollection[] {
    return this.read<ApiCollection[]>(this.KEYS.collections) || [];
  }

  saveCollections(collections: ApiCollection[]): void {
    this.write(this.KEYS.collections, collections);
  }

  addCollection(name: string, description = ''): ApiCollection[] {
    const collections = this.getCollections();
    collections.push({
      id: generateId(),
      name,
      description,
      requests: [],
      folders: [],
    });
    this.saveCollections(collections);
    return collections;
  }

  renameCollection(id: string, name: string): ApiCollection[] {
    const collections = this.getCollections();
    const col = collections.find((c) => c.id === id);
    if (col) col.name = name;
    this.saveCollections(collections);
    return collections;
  }

  deleteCollection(id: string): ApiCollection[] {
    const collections = this.getCollections().filter((c) => c.id !== id);
    this.saveCollections(collections);
    return collections;
  }

  duplicateCollection(id: string): ApiCollection[] {
    const collections = this.getCollections();
    const original = collections.find((c) => c.id === id);
    if (original) {
      const clone = deepClone(original);
      clone.id = generateId();
      clone.name = original.name + ' (Copy)';
      // Regenerate IDs for all nested items
      clone.requests.forEach((r) => (r.id = generateId()));
      clone.folders.forEach((f) => {
        f.id = generateId();
        f.requests.forEach((r) => (r.id = generateId()));
      });
      collections.push(clone);
      this.saveCollections(collections);
    }
    return this.getCollections();
  }

  // ──────────────────────────────────
  //  FOLDERS
  // ──────────────────────────────────

  addFolder(collectionId: string, name: string): ApiCollection[] {
    const collections = this.getCollections();
    const col = collections.find((c) => c.id === collectionId);
    if (col) {
      col.folders.push({ id: generateId(), name, requests: [] });
      this.saveCollections(collections);
    }
    return collections;
  }

  renameFolder(collectionId: string, folderId: string, name: string): ApiCollection[] {
    const collections = this.getCollections();
    const col = collections.find((c) => c.id === collectionId);
    const folder = col?.folders.find((f) => f.id === folderId);
    if (folder) folder.name = name;
    this.saveCollections(collections);
    return collections;
  }

  deleteFolder(collectionId: string, folderId: string): ApiCollection[] {
    const collections = this.getCollections();
    const col = collections.find((c) => c.id === collectionId);
    if (col) {
      col.folders = col.folders.filter((f) => f.id !== folderId);
      this.saveCollections(collections);
    }
    return collections;
  }

  // ──────────────────────────────────
  //  REQUESTS
  // ──────────────────────────────────

  addRequest(collectionId: string, request: ApiRequest, folderId?: string): ApiCollection[] {
    const collections = this.getCollections();
    const col = collections.find((c) => c.id === collectionId);
    if (!col) return collections;
    if (folderId) {
      const folder = col.folders.find((f) => f.id === folderId);
      if (folder) folder.requests.push(deepClone(request));
    } else {
      col.requests.push(deepClone(request));
    }
    this.saveCollections(collections);
    return collections;
  }

  updateRequest(collectionId: string, request: ApiRequest, folderId?: string): ApiCollection[] {
    const collections = this.getCollections();
    const col = collections.find((c) => c.id === collectionId);
    if (!col) return collections;

    if (folderId) {
      const folder = col.folders.find((f) => f.id === folderId);
      if (folder) {
        const idx = folder.requests.findIndex((r) => r.id === request.id);
        if (idx !== -1) folder.requests[idx] = deepClone(request);
      }
    } else {
      const idx = col.requests.findIndex((r) => r.id === request.id);
      if (idx !== -1) col.requests[idx] = deepClone(request);
    }
    this.saveCollections(collections);
    return collections;
  }

  deleteRequest(collectionId: string, requestId: string, folderId?: string): ApiCollection[] {
    const collections = this.getCollections();
    const col = collections.find((c) => c.id === collectionId);
    if (!col) return collections;

    if (folderId) {
      const folder = col.folders.find((f) => f.id === folderId);
      if (folder) folder.requests = folder.requests.filter((r) => r.id !== requestId);
    } else {
      col.requests = col.requests.filter((r) => r.id !== requestId);
    }
    this.saveCollections(collections);
    return collections;
  }

  duplicateRequest(collectionId: string, requestId: string, folderId?: string): ApiCollection[] {
    const collections = this.getCollections();
    const col = collections.find((c) => c.id === collectionId);
    if (!col) return collections;

    const sourceList = folderId
      ? col.folders.find((f) => f.id === folderId)?.requests
      : col.requests;
    if (!sourceList) return collections;

    const original = sourceList.find((r) => r.id === requestId);
    if (original) {
      const clone = deepClone(original);
      clone.id = generateId();
      clone.name = original.name + ' (Copy)';
      sourceList.push(clone);
      this.saveCollections(collections);
    }
    return this.getCollections();
  }

  // ──────────────────────────────────
  //  ENVIRONMENTS
  // ──────────────────────────────────

  getEnvironments(): Environment[] {
    return this.read<Environment[]>(this.KEYS.environments) || [];
  }

  saveEnvironments(envs: Environment[]): void {
    this.write(this.KEYS.environments, envs);
  }

  getActiveEnvironmentId(): string | null {
    return this.read<string>(this.KEYS.activeEnv) || null;
  }

  setActiveEnvironmentId(id: string | null): void {
    this.write(this.KEYS.activeEnv, id);
  }

  // ──────────────────────────────────
  //  HISTORY
  // ──────────────────────────────────

  getHistory(): HistoryEntry[] {
    return this.read<HistoryEntry[]>(this.KEYS.history) || [];
  }

  addHistory(entry: HistoryEntry): HistoryEntry[] {
    let history = this.getHistory();
    history.unshift(entry);
    if (history.length > this.MAX_HISTORY) {
      history = history.slice(0, this.MAX_HISTORY);
    }
    this.write(this.KEYS.history, history);
    return history;
  }

  clearHistory(): void {
    this.write(this.KEYS.history, []);
  }

  // ──────────────────────────────────
  //  PREFERENCES
  // ──────────────────────────────────

  getTheme(): string {
    return this.read<string>(this.KEYS.theme) || 'dark';
  }

  setTheme(theme: string): void {
    this.write(this.KEYS.theme, theme);
  }

  getConsoleOpen(): boolean {
    return this.read<boolean>(this.KEYS.consoleOpen) || false;
  }

  setConsoleOpen(open: boolean): void {
    this.write(this.KEYS.consoleOpen, open);
  }

  // ──────────────────────────────────
  //  IMPORT / EXPORT
  // ──────────────────────────────────

  exportCollections(): string {
    const data = {
      version: '1.0',
      app: 'smart-api-tester',
      exportedAt: new Date().toISOString(),
      collections: this.getCollections(),
    };
    return JSON.stringify(data, null, 2);
  }

  importCollections(jsonString: string): ApiCollection[] {
    try {
      const data = JSON.parse(jsonString);
      const imported: ApiCollection[] = data.collections || data;
      if (!Array.isArray(imported)) throw new Error('Invalid format');

      // Regenerate all IDs to avoid conflicts
      const existing = this.getCollections();
      imported.forEach((col) => {
        col.id = generateId();
        col.requests?.forEach((r) => (r.id = generateId()));
        col.folders?.forEach((f) => {
          f.id = generateId();
          f.requests?.forEach((r) => (r.id = generateId()));
        });
        // Ensure all fields exist
        col.folders = col.folders || [];
        col.description = col.description || '';
        existing.push(col);
      });

      this.saveCollections(existing);
      return existing;
    } catch (e) {
      throw new Error('Failed to import: Invalid JSON format');
    }
  }

  exportEnvironments(): string {
    return JSON.stringify({
      version: '1.0',
      environments: this.getEnvironments(),
    }, null, 2);
  }

  // ──────────────────────────────────
  //  HELPERS
  // ──────────────────────────────────

  private read<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, data: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`Failed to write to localStorage (key: ${key})`, e);
    }
  }
}
