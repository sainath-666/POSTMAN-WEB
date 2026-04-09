import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApiCollection, ApiRequest, CollectionFolder, HistoryEntry, createDefaultRequest, generateId
} from '../../models/api.models';
import { StorageService } from '../../services/storage.service';
import { TabService } from '../../services/tab.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  storage = inject(StorageService);
  tabService = inject(TabService);
  toast = inject(ToastService);

  collections: ApiCollection[] = [];
  history: HistoryEntry[] = [];

  /** Active sidebar section */
  activeSection: 'collections' | 'history' = 'collections';

  /** Search query */
  searchQuery = '';

  /** Expanded collections/folders */
  expandedCollections = new Set<string>();
  expandedFolders = new Set<string>();

  /** Inline editing state */
  renamingId: string | null = null;
  renameValue = '';

  /** Context menu state */
  contextMenuTarget: { type: string; id: string; collectionId?: string; x: number; y: number } | null = null;

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.collections = this.storage.getCollections();
    this.history = this.storage.getHistory();

    // Create sample data if none exists
    if (this.collections.length === 0) {
      this.collections = this.storage.addCollection('My Collection');
      const req = createDefaultRequest('Get Posts');
      req.method = 'GET';
      req.url = 'https://jsonplaceholder.typicode.com/posts';
      this.collections = this.storage.addRequest(this.collections[0].id, req);
      this.expandedCollections.add(this.collections[0].id);
    }
  }

  // ═══════════════════════════════
  //  SEARCH
  // ═══════════════════════════════

  get filteredCollections(): ApiCollection[] {
    if (!this.searchQuery.trim()) return this.collections;
    const q = this.searchQuery.toLowerCase();
    return this.collections
      .map((col) => ({
        ...col,
        requests: col.requests.filter((r) =>
          r.name.toLowerCase().includes(q) || r.url.toLowerCase().includes(q)
        ),
        folders: col.folders.map((f) => ({
          ...f,
          requests: f.requests.filter((r) =>
            r.name.toLowerCase().includes(q) || r.url.toLowerCase().includes(q)
          ),
        })).filter((f) => f.requests.length > 0 || f.name.toLowerCase().includes(q)),
      }))
      .filter((col) =>
        col.requests.length > 0 || col.folders.length > 0 || col.name.toLowerCase().includes(q)
      );
  }

  get filteredHistory(): HistoryEntry[] {
    if (!this.searchQuery.trim()) return this.history;
    const q = this.searchQuery.toLowerCase();
    return this.history.filter(
      (h) => h.request.url.toLowerCase().includes(q) || h.request.method.toLowerCase().includes(q)
    );
  }

  // ═══════════════════════════════
  //  COLLECTION CRUD
  // ═══════════════════════════════

  createCollection() {
    const name = prompt('Collection name:');
    if (name?.trim()) {
      this.collections = this.storage.addCollection(name.trim());
      const created = this.collections[this.collections.length - 1];
      this.expandedCollections.add(created.id);
      this.toast.success(`Collection "${name.trim()}" created`);
    }
  }

  startRename(id: string, currentName: string, event: Event) {
    event.stopPropagation();
    this.renamingId = id;
    this.renameValue = currentName;
  }

  confirmRename(type: 'collection' | 'folder', id: string, collectionId?: string) {
    if (!this.renameValue.trim()) { this.renamingId = null; return; }
    if (type === 'collection') {
      this.collections = this.storage.renameCollection(id, this.renameValue.trim());
    } else if (type === 'folder' && collectionId) {
      this.collections = this.storage.renameFolder(collectionId, id, this.renameValue.trim());
    }
    this.renamingId = null;
    this.toast.info('Renamed successfully');
  }

  deleteCollection(id: string, name: string) {
    if (confirm(`Delete collection "${name}" and all its contents?`)) {
      this.collections = this.storage.deleteCollection(id);
      this.toast.warning(`Collection "${name}" deleted`);
    }
  }

  duplicateCollection(id: string) {
    this.collections = this.storage.duplicateCollection(id);
    this.toast.success('Collection duplicated');
  }

  // ═══════════════════════════════
  //  FOLDER CRUD
  // ═══════════════════════════════

  addFolder(collectionId: string) {
    const name = prompt('Folder name:');
    if (name?.trim()) {
      this.collections = this.storage.addFolder(collectionId, name.trim());
      this.expandedCollections.add(collectionId);
      this.toast.success('Folder created');
    }
  }

  deleteFolder(collectionId: string, folderId: string, name: string) {
    if (confirm(`Delete folder "${name}" and all its requests?`)) {
      this.collections = this.storage.deleteFolder(collectionId, folderId);
      this.toast.warning('Folder deleted');
    }
  }

  // ═══════════════════════════════
  //  REQUEST ACTIONS
  // ═══════════════════════════════

  addRequest(collectionId: string, folderId?: string) {
    const req = createDefaultRequest();
    this.collections = this.storage.addRequest(collectionId, req, folderId);
    this.tabService.openRequest(req, collectionId, folderId);
    this.expandedCollections.add(collectionId);
    if (folderId) this.expandedFolders.add(folderId);
  }

  openRequest(request: ApiRequest, collectionId: string, folderId?: string) {
    this.tabService.openRequest(request, collectionId, folderId);
  }

  deleteRequest(collectionId: string, requestId: string, name: string, folderId?: string) {
    if (confirm(`Delete request "${name}"?`)) {
      this.collections = this.storage.deleteRequest(collectionId, requestId, folderId);
      this.toast.warning('Request deleted');
    }
  }

  duplicateRequest(collectionId: string, requestId: string, folderId?: string) {
    this.collections = this.storage.duplicateRequest(collectionId, requestId, folderId);
    this.toast.success('Request duplicated');
  }

  openFromHistory(entry: HistoryEntry) {
    this.tabService.openFromHistory(entry.request);
  }

  clearHistory() {
    if (confirm('Clear all history?')) {
      this.storage.clearHistory();
      this.history = [];
      this.toast.info('History cleared');
    }
  }

  // ═══════════════════════════════
  //  IMPORT / EXPORT
  // ═══════════════════════════════

  exportCollections() {
    const json = this.storage.exportCollections();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-tester-collections-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success('Collections exported');
  }

  importCollections() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          this.collections = this.storage.importCollections(reader.result as string);
          this.toast.success('Collections imported successfully');
        } catch (err: any) {
          this.toast.error(err.message || 'Import failed');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // ═══════════════════════════════
  //  UI HELPERS
  // ═══════════════════════════════

  toggleCollection(id: string) {
    this.expandedCollections.has(id) ? this.expandedCollections.delete(id) : this.expandedCollections.add(id);
  }

  toggleFolder(id: string) {
    this.expandedFolders.has(id) ? this.expandedFolders.delete(id) : this.expandedFolders.add(id);
  }

  getTotalRequests(col: ApiCollection): number {
    return col.requests.length + col.folders.reduce((sum, f) => sum + f.requests.length, 0);
  }

  isActiveRequest(requestId: string): boolean {
    return this.tabService.activeTab()?.request?.id === requestId;
  }

  getMethodClass(method: string): string {
    return 'method-' + method.toLowerCase();
  }

  formatTime(timestamp: number): string {
    const d = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60000) return 'Just now';
    if (diffMs < 3600000) return Math.floor(diffMs / 60000) + 'm ago';
    if (diffMs < 86400000) return Math.floor(diffMs / 3600000) + 'h ago';
    return d.toLocaleDateString();
  }

  stopPropagation(event: Event) {
    event.stopPropagation();
  }
}
