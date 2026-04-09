import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { RequestBuilderComponent } from './components/request-builder/request-builder.component';
import { ResponseViewerComponent } from './components/response-viewer/response-viewer.component';
import { ToastComponent } from './components/toast/toast.component';
import { StorageService } from './services/storage.service';
import { ToastService } from './services/toast.service';
import { ApiCollection, ApiRequest, ApiResponse } from './models/api.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    RequestBuilderComponent,
    ResponseViewerComponent,
    ToastComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class App implements OnInit {
  @ViewChild(RequestBuilderComponent) requestBuilder!: RequestBuilderComponent;

  private storage = inject(StorageService);
  private toast = inject(ToastService);

  /** All collections loaded from localStorage */
  collections: ApiCollection[] = [];

  /** Currently active request being edited */
  activeRequest: ApiRequest | null = null;

  /** ID of the collection the active request belongs to */
  activeCollectionId: string | null = null;

  /** ID of the active request (for sidebar highlighting) */
  activeRequestId: string = '';

  /** API response from the last request */
  response: ApiResponse | null = null;

  /** Loading state for API calls */
  isLoading: boolean = false;

  /** Mobile sidebar toggle */
  sidebarOpen: boolean = true;

  ngOnInit(): void {
    this.collections = this.storage.getCollections();

    // If no collections exist, create a sample one
    if (this.collections.length === 0) {
      this.createSampleData();
    }
  }

  /** Create sample data for first-time users */
  private createSampleData(): void {
    const sampleRequest: ApiRequest = {
      id: this.storage.generateId(),
      name: 'Get Posts',
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/posts',
      headers: [],
      body: '',
    };

    this.collections = this.storage.addCollection('Sample Collection');
    const collection = this.collections[0];
    this.collections = this.storage.addRequest(collection.id, sampleRequest);
    this.toast.info('Welcome! A sample collection has been created.');
  }

  /** Handle collection list changes from sidebar */
  onCollectionsChange(collections: ApiCollection[]): void {
    this.collections = collections;
  }

  /** Handle request selection from sidebar */
  onRequestSelected(event: { collection: ApiCollection; request: ApiRequest }): void {
    this.activeRequest = { ...event.request };
    this.activeCollectionId = event.collection.id;
    this.activeRequestId = event.request.id;
    this.response = null;
  }

  /** Handle "New Request" from sidebar */
  onNewRequest(collectionId: string): void {
    this.activeCollectionId = collectionId;
    this.activeRequest = null;
    this.activeRequestId = '';
    this.response = null;
    if (this.requestBuilder) {
      this.requestBuilder.resetForm();
    }
  }

  /** Handle response from API call */
  onResponseReceived(response: ApiResponse): void {
    this.response = response;
  }

  /** Handle loading state changes */
  onLoadingChange(loading: boolean): void {
    this.isLoading = loading;
  }

  /** Handle request saved event */
  onRequestSaved(event: { collectionId: string; request: ApiRequest }): void {
    this.activeCollectionId = event.collectionId;
    this.activeRequestId = event.request.id;
    this.activeRequest = { ...event.request };
  }

  /** Toggle sidebar on mobile */
  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }
}
