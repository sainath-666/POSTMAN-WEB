import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiCollection, ApiRequest } from '../../models/api.models';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  @Input() collections: ApiCollection[] = [];
  @Input() activeRequestId: string = '';
  @Output() collectionsChange = new EventEmitter<ApiCollection[]>();
  @Output() requestSelected = new EventEmitter<{ collection: ApiCollection; request: ApiRequest }>();
  @Output() newRequestClicked = new EventEmitter<string>(); // emits collectionId

  private storage = inject(StorageService);
  private toast = inject(ToastService);

  /** Track which collections are expanded in the sidebar */
  expandedCollections = new Set<string>();

  /** ID and new name of the collection currently being renamed */
  renamingCollectionId: string | null = null;
  renameValue: string = '';

  /** Toggle collection expand/collapse */
  toggleCollection(id: string): void {
    if (this.expandedCollections.has(id)) {
      this.expandedCollections.delete(id);
    } else {
      this.expandedCollections.add(id);
    }
  }

  /** Create a new collection with a prompted name */
  createCollection(): void {
    const name = prompt('Enter collection name:');
    if (name && name.trim()) {
      const updated = this.storage.addCollection(name.trim());
      this.collectionsChange.emit(updated);
      // Auto-expand the new collection
      const newCol = updated[updated.length - 1];
      this.expandedCollections.add(newCol.id);
      this.toast.success(`Collection "${name.trim()}" created`);
    }
  }

  /** Start inline rename */
  startRename(collection: ApiCollection, event: Event): void {
    event.stopPropagation();
    this.renamingCollectionId = collection.id;
    this.renameValue = collection.name;
  }

  /** Confirm rename */
  confirmRename(id: string): void {
    if (this.renameValue.trim()) {
      const updated = this.storage.renameCollection(id, this.renameValue.trim());
      this.collectionsChange.emit(updated);
      this.toast.info('Collection renamed');
    }
    this.renamingCollectionId = null;
  }

  /** Cancel rename */
  cancelRename(): void {
    this.renamingCollectionId = null;
  }

  /** Delete a collection with confirmation */
  deleteCollection(id: string, name: string, event: Event): void {
    event.stopPropagation();
    if (confirm(`Delete collection "${name}" and all its requests?`)) {
      const updated = this.storage.deleteCollection(id);
      this.collectionsChange.emit(updated);
      this.toast.warning(`Collection "${name}" deleted`);
    }
  }

  /** Handle clicking on a saved request */
  onRequestClick(collection: ApiCollection, request: ApiRequest): void {
    this.requestSelected.emit({ collection, request });
  }

  /** Handle "New Request" button within a collection */
  onNewRequest(collectionId: string, event: Event): void {
    event.stopPropagation();
    this.newRequestClicked.emit(collectionId);
  }

  /** Delete a request from a collection */
  deleteRequest(collectionId: string, request: ApiRequest, event: Event): void {
    event.stopPropagation();
    if (confirm(`Delete request "${request.name}"?`)) {
      const updated = this.storage.deleteRequest(collectionId, request.id);
      this.collectionsChange.emit(updated);
      this.toast.warning(`Request "${request.name}" deleted`);
    }
  }

  /** Get method badge color class */
  getMethodClass(method: string): string {
    const map: Record<string, string> = {
      GET: 'method-get',
      POST: 'method-post',
      PUT: 'method-put',
      DELETE: 'method-delete',
      PATCH: 'method-patch',
    };
    return map[method] || 'method-get';
  }
}
