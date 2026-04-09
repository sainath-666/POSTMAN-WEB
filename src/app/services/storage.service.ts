import { Injectable } from '@angular/core';
import { ApiCollection, ApiRequest } from '../models/api.models';

/**
 * StorageService handles all localStorage operations for persisting
 * collections and requests. Uses JSON stringify/parse for serialization.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly STORAGE_KEY = 'smart-api-tester-collections';

  /** Generate a unique ID for collections and requests */
  generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }

  /** Load all collections from localStorage */
  getCollections(): ApiCollection[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      console.error('Failed to parse collections from localStorage');
      return [];
    }
  }

  /** Save all collections to localStorage */
  saveCollections(collections: ApiCollection[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(collections));
    } catch (e) {
      console.error('Failed to save collections to localStorage', e);
    }
  }

  /** Add a new collection */
  addCollection(name: string): ApiCollection[] {
    const collections = this.getCollections();
    const newCollection: ApiCollection = {
      id: this.generateId(),
      name,
      requests: [],
    };
    collections.push(newCollection);
    this.saveCollections(collections);
    return collections;
  }

  /** Rename a collection */
  renameCollection(id: string, newName: string): ApiCollection[] {
    const collections = this.getCollections();
    const collection = collections.find((c) => c.id === id);
    if (collection) {
      collection.name = newName;
      this.saveCollections(collections);
    }
    return collections;
  }

  /** Delete a collection */
  deleteCollection(id: string): ApiCollection[] {
    let collections = this.getCollections();
    collections = collections.filter((c) => c.id !== id);
    this.saveCollections(collections);
    return collections;
  }

  /** Add a request to a collection */
  addRequest(collectionId: string, request: ApiRequest): ApiCollection[] {
    const collections = this.getCollections();
    const collection = collections.find((c) => c.id === collectionId);
    if (collection) {
      collection.requests.push(request);
      this.saveCollections(collections);
    }
    return collections;
  }

  /** Update an existing request within a collection */
  updateRequest(collectionId: string, request: ApiRequest): ApiCollection[] {
    const collections = this.getCollections();
    const collection = collections.find((c) => c.id === collectionId);
    if (collection) {
      const idx = collection.requests.findIndex((r) => r.id === request.id);
      if (idx !== -1) {
        collection.requests[idx] = request;
        this.saveCollections(collections);
      }
    }
    return collections;
  }

  /** Delete a request from a collection */
  deleteRequest(collectionId: string, requestId: string): ApiCollection[] {
    const collections = this.getCollections();
    const collection = collections.find((c) => c.id === collectionId);
    if (collection) {
      collection.requests = collection.requests.filter((r) => r.id !== requestId);
      this.saveCollections(collections);
    }
    return collections;
  }
}
