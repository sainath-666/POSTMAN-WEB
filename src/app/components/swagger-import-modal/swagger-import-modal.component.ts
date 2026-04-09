import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SwaggerService } from '../../services/swagger.service';
import { ToastService } from '../../services/toast.service';
import { ApiCollection } from '../../models/api.models';

@Component({
  selector: 'app-swagger-import-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './swagger-import-modal.component.html',
  styleUrl: './swagger-import-modal.component.css',
})
export class SwaggerImportModalComponent {
  private swagger = inject(SwaggerService);
  private toast = inject(ToastService);

  /** Emitted when user closes modal */
  close = output<void>();

  /** Emitted after successful import with updated collections */
  imported = output<ApiCollection[]>();

  /** URL input */
  swaggerUrl = '';

  /** State */
  isLoading = false;
  isPreviewing = false;
  error = '';

  /** Preview data */
  previewCollection: ApiCollection | null = null;
  previewSpec: any = null;

  /** Per-folder expanded state for preview */
  expandedFolders = new Set<string>();

  async onPreview() {
    if (!this.swaggerUrl.trim()) {
      this.error = 'Please enter a Swagger/OpenAPI URL';
      return;
    }

    this.error = '';
    this.isPreviewing = true;
    this.previewCollection = null;
    this.previewSpec = null;

    try {
      const { spec, collection } = await this.swagger.previewFromUrl(this.swaggerUrl.trim());
      this.previewSpec = spec;
      this.previewCollection = collection;

      // Auto-expand all folders for visibility
      for (const f of collection.folders) {
        this.expandedFolders.add(f.id);
      }
    } catch (err: any) {
      this.error = err.message || 'Failed to fetch or parse the Swagger spec.';
    } finally {
      this.isPreviewing = false;
    }
  }

  async onImport() {
    if (!this.swaggerUrl.trim()) {
      this.error = 'Please enter a Swagger/OpenAPI URL';
      return;
    }

    this.error = '';
    this.isLoading = true;

    try {
      const { collection, collections } = await this.swagger.importFromUrl(this.swaggerUrl.trim());
      const totalRequests = collection.requests.length +
        collection.folders.reduce((sum, f) => sum + f.requests.length, 0);
      this.toast.success(`Imported "${collection.name}" with ${totalRequests} endpoints`);
      this.imported.emit(collections);
      this.close.emit();
    } catch (err: any) {
      this.error = err.message || 'Failed to import. Check the URL and try again.';
    } finally {
      this.isLoading = false;
    }
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.close.emit();
    }
  }

  toggleFolder(id: string) {
    this.expandedFolders.has(id) ? this.expandedFolders.delete(id) : this.expandedFolders.add(id);
  }

  getMethodClass(method: string): string {
    return 'method-' + method.toLowerCase();
  }

  getTotalEndpoints(): number {
    if (!this.previewCollection) return 0;
    return this.previewCollection.requests.length +
      this.previewCollection.folders.reduce((sum, f) => sum + f.requests.length, 0);
  }

  onPaste(event: ClipboardEvent) {
    // After paste, auto-trigger preview
    setTimeout(() => {
      if (this.swaggerUrl.trim()) {
        this.onPreview();
      }
    }, 100);
  }
}
