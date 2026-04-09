import { Component, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApiRequest, HttpMethod, AuthType, BodyType, KeyValuePair,
  createKeyValuePair, createDefaultAuth, createDefaultBody, deepClone, generateId
} from '../../models/api.models';
import { TabService } from '../../services/tab.service';
import { ApiService } from '../../services/api.service';
import { StorageService } from '../../services/storage.service';
import { EnvironmentService } from '../../services/environment.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-request-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './request-builder.component.html',
  styleUrl: './request-builder.component.css',
})
export class RequestBuilderComponent {
  tabService = inject(TabService);
  private apiService = inject(ApiService);
  private storage = inject(StorageService);
  private envService = inject(EnvironmentService);
  private toast = inject(ToastService);

  /** Current active tab (reactive) */
  tab = this.tabService.activeTab;

  /** Sub-tab within the request builder */
  activeSubTab: 'params' | 'auth' | 'headers' | 'body' = 'params';

  /** Body raw editor sub-type */
  bodyRawType: 'json' | 'text' | 'xml' | 'html' = 'json';

  /** JSON validation error */
  bodyError = '';

  /** Available methods */
  methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

  /** Auth dropdown */
  authTypes: { value: AuthType; label: string }[] = [
    { value: 'none', label: 'No Auth' },
    { value: 'basic', label: 'Basic Auth' },
    { value: 'bearer', label: 'Bearer Token' },
    { value: 'apikey', label: 'API Key' },
  ];

  /** Body type options */
  bodyTypes: { value: BodyType; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'json', label: 'JSON' },
    { value: 'text', label: 'Text' },
    { value: 'xml', label: 'XML' },
    { value: 'html', label: 'HTML' },
    { value: 'formdata', label: 'Form Data' },
    { value: 'urlencoded', label: 'x-www-form-urlencoded' },
    { value: 'graphql', label: 'GraphQL' },
  ];

  /** Save dropdown visibility */
  showSaveMenu = false;

  /** Collections list for save dropdown */
  collections = computed(() => this.storage.getCollections());

  // ═══════════════════════════════
  //  REQUEST FIELD UPDATES
  // ═══════════════════════════════

  get request(): ApiRequest | undefined {
    return this.tab()?.request;
  }

  updateField(field: string, value: any) {
    if (!this.request) return;
    this.tabService.updateActiveRequest({ [field]: value } as any);
  }

  updateMethod(method: HttpMethod) {
    this.tabService.updateActiveRequest({ method });
  }

  updateUrl(url: string) {
    this.tabService.updateActiveRequest({ url });
    // Sync URL query params to params editor
    this.syncUrlToParams(url);
  }

  updateName(name: string) {
    this.tabService.updateActiveRequest({ name });
  }

  // ═══════════════════════════════
  //  PARAMS ↔ URL SYNC
  // ═══════════════════════════════

  syncUrlToParams(url: string) {
    try {
      const urlObj = new URL(url);
      const params: KeyValuePair[] = [];
      urlObj.searchParams.forEach((value, key) => {
        params.push(createKeyValuePair(key, value));
      });
      if (params.length === 0) params.push(createKeyValuePair());
      this.tabService.updateActiveRequest({ params });
    } catch {
      // URL not valid yet, don't sync
    }
  }

  syncParamsToUrl() {
    if (!this.request) return;
    try {
      const urlObj = new URL(this.request.url.split('?')[0]);
      const enabledParams = this.request.params.filter((p) => p.enabled && p.key.trim());
      enabledParams.forEach((p) => urlObj.searchParams.set(p.key, p.value));
      this.tabService.updateActiveRequest({ url: urlObj.toString() });
    } catch {
      // Can't parse URL
      const base = this.request.url.split('?')[0];
      const enabledParams = this.request.params.filter((p) => p.enabled && p.key.trim());
      if (enabledParams.length > 0) {
        const qs = enabledParams.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
        this.tabService.updateActiveRequest({ url: base + '?' + qs });
      }
    }
  }

  // ═══════════════════════════════
  //  KEY-VALUE PAIR HELPERS
  // ═══════════════════════════════

  addPair(field: 'params' | 'headers') {
    if (!this.request) return;
    const list = [...this.request[field], createKeyValuePair()];
    this.tabService.updateActiveRequest({ [field]: list });
  }

  removePair(field: 'params' | 'headers', index: number) {
    if (!this.request) return;
    const list = [...this.request[field]];
    list.splice(index, 1);
    if (list.length === 0) list.push(createKeyValuePair());
    this.tabService.updateActiveRequest({ [field]: list });
    if (field === 'params') this.syncParamsToUrl();
  }

  updatePair(field: 'params' | 'headers', index: number, prop: string, value: any) {
    if (!this.request) return;
    const list = deepClone(this.request[field]);
    (list[index] as any)[prop] = value;
    this.tabService.updateActiveRequest({ [field]: list });
    if (field === 'params') {
      // Debounced URL sync
      setTimeout(() => this.syncParamsToUrl(), 100);
    }
  }

  togglePair(field: 'params' | 'headers', index: number) {
    if (!this.request) return;
    const list = deepClone(this.request[field]);
    list[index].enabled = !list[index].enabled;
    this.tabService.updateActiveRequest({ [field]: list });
    if (field === 'params') this.syncParamsToUrl();
  }

  // Body form helpers
  addBodyPair(field: 'formData' | 'urlEncoded') {
    if (!this.request) return;
    const body = deepClone(this.request.body);
    body[field].push(createKeyValuePair());
    this.tabService.updateActiveRequest({ body });
  }

  removeBodyPair(field: 'formData' | 'urlEncoded', index: number) {
    if (!this.request) return;
    const body = deepClone(this.request.body);
    body[field].splice(index, 1);
    if (body[field].length === 0) body[field].push(createKeyValuePair());
    this.tabService.updateActiveRequest({ body });
  }

  updateBodyPair(field: 'formData' | 'urlEncoded', index: number, prop: string, value: any) {
    if (!this.request) return;
    const body = deepClone(this.request.body);
    (body[field][index] as any)[prop] = value;
    this.tabService.updateActiveRequest({ body });
  }

  toggleBodyPair(field: 'formData' | 'urlEncoded', index: number) {
    if (!this.request) return;
    const body = deepClone(this.request.body);
    body[field][index].enabled = !body[field][index].enabled;
    this.tabService.updateActiveRequest({ body });
  }

  // ═══════════════════════════════
  //  AUTH
  // ═══════════════════════════════

  updateAuthType(type: AuthType) {
    if (!this.request) return;
    const auth = deepClone(this.request.auth);
    auth.type = type;
    this.tabService.updateActiveRequest({ auth });
  }

  updateAuthField(section: 'basic' | 'bearer' | 'apikey', field: string, value: string) {
    if (!this.request) return;
    const auth = deepClone(this.request.auth);
    (auth[section] as any)[field] = value;
    this.tabService.updateActiveRequest({ auth });
  }

  // ═══════════════════════════════
  //  BODY
  // ═══════════════════════════════

  updateBodyType(type: BodyType) {
    if (!this.request) return;
    const body = deepClone(this.request.body);
    body.type = type;
    if (['json', 'text', 'xml', 'html'].includes(type)) {
      this.bodyRawType = type as any;
    }
    this.tabService.updateActiveRequest({ body });
    this.bodyError = '';
  }

  updateBodyRaw(value: string) {
    if (!this.request) return;
    const body = deepClone(this.request.body);
    body.raw = value;
    this.tabService.updateActiveRequest({ body });
    if (this.request.body.type === 'json') this.validateJson(value);
  }

  updateGraphQL(field: 'query' | 'variables', value: string) {
    if (!this.request) return;
    const body = deepClone(this.request.body);
    body.graphql[field] = value;
    this.tabService.updateActiveRequest({ body });
  }

  validateJson(value: string) {
    if (!value.trim()) { this.bodyError = ''; return; }
    try { JSON.parse(value); this.bodyError = ''; } catch (e: any) { this.bodyError = e.message; }
  }

  formatJson() {
    if (!this.request?.body.raw.trim()) return;
    try {
      const parsed = JSON.parse(this.request.body.raw);
      const body = deepClone(this.request.body);
      body.raw = JSON.stringify(parsed, null, 2);
      this.tabService.updateActiveRequest({ body });
      this.bodyError = '';
      this.toast.info('JSON formatted');
    } catch (e: any) {
      this.bodyError = e.message;
    }
  }

  // ═══════════════════════════════
  //  SEND REQUEST
  // ═══════════════════════════════

  send() {
    const tab = this.tab();
    if (!tab || !tab.request.url.trim()) {
      this.toast.warning('Please enter a URL');
      return;
    }

    this.tabService.setActiveLoading(true);

    this.apiService.sendRequest(tab.request).subscribe({
      next: (response) => {
        this.tabService.setActiveResponse(response);
        // Add to history
        this.storage.addHistory({
          id: generateId(),
          request: deepClone(tab.request),
          statusCode: response.statusCode,
          responseTime: response.responseTime,
          timestamp: Date.now(),
        });
      },
      error: () => {
        this.tabService.setActiveLoading(false);
        this.toast.error('Request failed');
      },
    });
  }

  // ═══════════════════════════════
  //  SAVE REQUEST
  // ═══════════════════════════════

  save() {
    const tab = this.tab();
    if (!tab) return;

    if (tab.collectionId) {
      // Update existing
      this.storage.updateRequest(tab.collectionId, tab.request, tab.folderId || undefined);
      this.tabService.markActiveClean(tab.collectionId, tab.folderId);
      this.toast.success('Request saved');
      this.showSaveMenu = false;
    } else {
      // Show collection picker
      this.showSaveMenu = !this.showSaveMenu;
    }
  }

  saveToCollection(collectionId: string) {
    const tab = this.tab();
    if (!tab) return;
    this.storage.addRequest(collectionId, tab.request);
    this.tabService.markActiveClean(collectionId);
    this.toast.success('Request saved to collection');
    this.showSaveMenu = false;
  }

  // ═══════════════════════════════
  //  UI HELPERS
  // ═══════════════════════════════

  getMethodClass(): string {
    return this.request ? 'method-' + this.request.method.toLowerCase() : '';
  }

  getEnabledCount(list: KeyValuePair[]): number {
    return list?.filter((p) => p.enabled && p.key.trim()).length || 0;
  }

  onKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.send();
    }
  }
}
