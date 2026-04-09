import { Component, EventEmitter, Input, Output, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiRequest, ApiHeader, HttpMethod, ApiCollection, ApiResponse } from '../../models/api.models';
import { ApiService } from '../../services/api.service';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-request-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './request-builder.component.html',
  styleUrl: './request-builder.component.css',
})
export class RequestBuilderComponent implements OnChanges {
  /** The request loaded for editing (null = blank new request) */
  @Input() request: ApiRequest | null = null;

  /** The collection this request belongs to (for save operations) */
  @Input() activeCollectionId: string | null = null;

  /** All collections (for Save-to dropdown) */
  @Input() collections: ApiCollection[] = [];

  /** Emitted when collections change (after save/update) */
  @Output() collectionsChange = new EventEmitter<ApiCollection[]>();

  /** Emitted when an API response is received */
  @Output() responseReceived = new EventEmitter<ApiResponse>();

  /** Emitted when loading state changes */
  @Output() loadingChange = new EventEmitter<boolean>();

  /** Emitted when active request changes (after save) */
  @Output() requestSaved = new EventEmitter<{ collectionId: string; request: ApiRequest }>();

  private apiService = inject(ApiService);
  private storage = inject(StorageService);
  private toast = inject(ToastService);

  // Form state
  requestName: string = 'New Request';
  method: HttpMethod = 'GET';
  url: string = '';
  headers: ApiHeader[] = [{ key: '', value: '' }];
  body: string = '';
  activeTab: 'headers' | 'body' = 'headers';
  isLoading: boolean = false;
  bodyError: string = '';
  editingExisting: boolean = false;
  editingRequestId: string = '';

  // Available HTTP methods
  methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  // Save-to collection
  saveToCollectionId: string = '';
  showSaveDropdown: boolean = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['request'] && this.request) {
      this.loadRequest(this.request);
    }
  }

  /** Load a request into the builder form */
  private loadRequest(req: ApiRequest): void {
    this.requestName = req.name;
    this.method = req.method;
    this.url = req.url;
    this.headers = req.headers.length > 0 ? [...req.headers.map((h) => ({ ...h }))] : [{ key: '', value: '' }];
    this.body = req.body || '';
    this.editingExisting = true;
    this.editingRequestId = req.id;
    this.bodyError = '';
  }

  /** Reset the form for a new request */
  resetForm(): void {
    this.requestName = 'New Request';
    this.method = 'GET';
    this.url = '';
    this.headers = [{ key: '', value: '' }];
    this.body = '';
    this.activeTab = 'headers';
    this.editingExisting = false;
    this.editingRequestId = '';
    this.bodyError = '';
  }

  /** Switch between Headers and Body tabs */
  setTab(tab: 'headers' | 'body'): void {
    this.activeTab = tab;
  }

  /** Add a new empty header row */
  addHeader(): void {
    this.headers.push({ key: '', value: '' });
  }

  /** Remove a header row */
  removeHeader(index: number): void {
    this.headers.splice(index, 1);
    if (this.headers.length === 0) {
      this.headers.push({ key: '', value: '' });
    }
  }

  /** Validate JSON body */
  validateBody(): void {
    if (!this.body.trim()) {
      this.bodyError = '';
      return;
    }
    try {
      JSON.parse(this.body);
      this.bodyError = '';
    } catch (e: any) {
      this.bodyError = 'Invalid JSON: ' + e.message;
    }
  }

  /** Format/prettify the JSON body */
  formatBody(): void {
    if (!this.body.trim()) return;
    try {
      const parsed = JSON.parse(this.body);
      this.body = JSON.stringify(parsed, null, 2);
      this.bodyError = '';
      this.toast.info('JSON formatted');
    } catch (e: any) {
      this.bodyError = 'Cannot format: ' + e.message;
    }
  }

  /** Send the HTTP request */
  sendRequest(): void {
    if (!this.url.trim()) {
      this.toast.warning('Please enter a URL');
      return;
    }

    this.isLoading = true;
    this.loadingChange.emit(true);

    const req: ApiRequest = {
      id: this.editingRequestId || this.storage.generateId(),
      name: this.requestName,
      method: this.method,
      url: this.url.trim(),
      headers: this.headers.filter((h) => h.key.trim() !== ''),
      body: this.body,
    };

    this.apiService.sendRequest(req).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.loadingChange.emit(false);
        this.responseReceived.emit(response);
      },
      error: () => {
        this.isLoading = false;
        this.loadingChange.emit(false);
        this.toast.error('Request failed unexpectedly');
      },
    });
  }

  /** Save or update the request in a collection */
  saveRequest(): void {
    const targetCollectionId = this.activeCollectionId || this.saveToCollectionId;

    if (!targetCollectionId) {
      this.showSaveDropdown = true;
      this.toast.warning('Select a collection to save to');
      return;
    }

    if (!this.requestName.trim()) {
      this.toast.warning('Please enter a request name');
      return;
    }

    const req: ApiRequest = {
      id: this.editingExisting ? this.editingRequestId : this.storage.generateId(),
      name: this.requestName.trim(),
      method: this.method,
      url: this.url.trim(),
      headers: this.headers.filter((h) => h.key.trim() !== ''),
      body: this.body,
    };

    let updated: ApiCollection[];
    if (this.editingExisting) {
      updated = this.storage.updateRequest(targetCollectionId, req);
      this.toast.success('Request updated');
    } else {
      updated = this.storage.addRequest(targetCollectionId, req);
      this.editingExisting = true;
      this.editingRequestId = req.id;
      this.toast.success('Request saved');
    }

    this.collectionsChange.emit(updated);
    this.requestSaved.emit({ collectionId: targetCollectionId, request: req });
    this.showSaveDropdown = false;
  }

  /** Save to a specific collection (from dropdown) */
  saveToCollection(collectionId: string): void {
    this.saveToCollectionId = collectionId;
    this.showSaveDropdown = false;
    this.saveRequest();
  }

  /** Get CSS class for the currently selected method */
  getMethodClass(): string {
    return 'method-' + this.method.toLowerCase();
  }
}
