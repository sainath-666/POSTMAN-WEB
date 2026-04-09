import { Injectable, inject, signal, computed } from '@angular/core';
import {
  RequestTab, ApiRequest, ApiResponse, createDefaultRequest, generateId, deepClone
} from '../models/api.models';

/**
 * TabService manages the tabbed interface for multiple simultaneous requests.
 * Uses Angular signals for reactive state management.
 */
@Injectable({ providedIn: 'root' })
export class TabService {
  /** All open tabs */
  tabs = signal<RequestTab[]>([]);

  /** Currently active tab ID */
  activeTabId = signal<string>('');

  /** Currently active tab (computed) */
  activeTab = computed(() => this.tabs().find((t) => t.id === this.activeTabId()) || null);

  /** Number of open tabs */
  tabCount = computed(() => this.tabs().length);

  constructor() {
    // Open a default tab on init
    this.openNewTab();
  }

  /** Open a new blank tab */
  openNewTab(): void {
    const request = createDefaultRequest();
    const tab: RequestTab = {
      id: generateId(),
      name: 'Untitled Request',
      request,
      response: null,
      isLoading: false,
      isDirty: false,
      collectionId: null,
      folderId: null,
    };
    this.tabs.update((tabs) => [...tabs, tab]);
    this.activeTabId.set(tab.id);
  }

  /** Open a saved request in a tab (reuse existing tab if same request) */
  openRequest(request: ApiRequest, collectionId: string, folderId?: string | null): void {
    // Check if this request is already open in a tab
    const existing = this.tabs().find(
      (t) => t.request.id === request.id && t.collectionId === collectionId
    );
    if (existing) {
      this.activeTabId.set(existing.id);
      return;
    }

    const tab: RequestTab = {
      id: generateId(),
      name: request.name,
      request: deepClone(request),
      response: null,
      isLoading: false,
      isDirty: false,
      collectionId,
      folderId: folderId || null,
    };
    this.tabs.update((tabs) => [...tabs, tab]);
    this.activeTabId.set(tab.id);
  }

  /** Open a history entry in a new tab */
  openFromHistory(request: ApiRequest): void {
    const tab: RequestTab = {
      id: generateId(),
      name: request.name || request.url || 'History Request',
      request: deepClone(request),
      response: null,
      isLoading: false,
      isDirty: false,
      collectionId: null,
      folderId: null,
    };
    this.tabs.update((tabs) => [...tabs, tab]);
    this.activeTabId.set(tab.id);
  }

  /** Close a tab */
  closeTab(tabId: string): void {
    const tabs = this.tabs();
    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;

    const newTabs = tabs.filter((t) => t.id !== tabId);

    if (newTabs.length === 0) {
      // Always keep at least one tab
      this.openNewTab();
      return;
    }

    this.tabs.set(newTabs);

    // If closed tab was active, switch to neighbor
    if (this.activeTabId() === tabId) {
      const newIdx = Math.min(idx, newTabs.length - 1);
      this.activeTabId.set(newTabs[newIdx].id);
    }
  }

  /** Switch to a tab */
  setActiveTab(tabId: string): void {
    this.activeTabId.set(tabId);
  }

  /** Update the request data of the active tab */
  updateActiveRequest(partial: Partial<ApiRequest>): void {
    const tabId = this.activeTabId();
    this.tabs.update((tabs) =>
      tabs.map((t) => {
        if (t.id !== tabId) return t;
        return {
          ...t,
          request: { ...t.request, ...partial },
          name: partial.name || t.name,
          isDirty: true,
        };
      })
    );
  }

  /** Set the full request on the active tab */
  setActiveRequest(request: ApiRequest): void {
    const tabId = this.activeTabId();
    this.tabs.update((tabs) =>
      tabs.map((t) => {
        if (t.id !== tabId) return t;
        return { ...t, request: deepClone(request), name: request.name, isDirty: true };
      })
    );
  }

  /** Set response on the active tab */
  setActiveResponse(response: ApiResponse): void {
    const tabId = this.activeTabId();
    this.tabs.update((tabs) =>
      tabs.map((t) => (t.id === tabId ? { ...t, response, isLoading: false } : t))
    );
  }

  /** Set loading state on the active tab */
  setActiveLoading(loading: boolean): void {
    const tabId = this.activeTabId();
    this.tabs.update((tabs) =>
      tabs.map((t) => (t.id === tabId ? { ...t, isLoading: loading } : t))
    );
  }

  /** Mark active tab as clean (saved) */
  markActiveClean(collectionId: string, folderId?: string | null): void {
    const tabId = this.activeTabId();
    this.tabs.update((tabs) =>
      tabs.map((t) => {
        if (t.id !== tabId) return t;
        return { ...t, isDirty: false, collectionId, folderId: folderId || null };
      })
    );
  }

  /** Duplicate the active tab */
  duplicateActiveTab(): void {
    const tab = this.activeTab();
    if (!tab) return;
    const newRequest = deepClone(tab.request);
    newRequest.id = generateId();
    newRequest.name = tab.request.name + ' (Copy)';
    const newTab: RequestTab = {
      ...deepClone(tab),
      id: generateId(),
      name: newRequest.name,
      request: newRequest,
      collectionId: null,
      folderId: null,
      isDirty: true,
    };
    this.tabs.update((tabs) => [...tabs, newTab]);
    this.activeTabId.set(newTab.id);
  }

  /** Close all tabs except the active one */
  closeOtherTabs(): void {
    const activeId = this.activeTabId();
    this.tabs.update((tabs) => tabs.filter((t) => t.id === activeId));
  }
}
