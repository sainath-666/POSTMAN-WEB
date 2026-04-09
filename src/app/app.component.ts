import { Component, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { TabBarComponent } from './components/tab-bar/tab-bar.component';
import { RequestBuilderComponent } from './components/request-builder/request-builder.component';
import { ResponseViewerComponent } from './components/response-viewer/response-viewer.component';
import { ConsolePanelComponent } from './components/console-panel/console-panel.component';
import { EnvironmentModalComponent } from './components/environment-modal/environment-modal.component';
import { ToastComponent } from './components/toast/toast.component';
import { TabService } from './services/tab.service';
import { EnvironmentService } from './services/environment.service';
import { StorageService } from './services/storage.service';
import { ToastService } from './services/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SidebarComponent,
    TabBarComponent,
    RequestBuilderComponent,
    ResponseViewerComponent,
    ConsolePanelComponent,
    EnvironmentModalComponent,
    ToastComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class App {
  tabService = inject(TabService);
  envService = inject(EnvironmentService);
  storage = inject(StorageService);
  toast = inject(ToastService);

  /** UI state */
  sidebarOpen = true;
  consoleOpen = false;
  showEnvModal = false;
  theme: 'dark' | 'light' = 'dark';

  constructor() {
    // Load preferences
    this.consoleOpen = this.storage.getConsoleOpen();
    this.theme = this.storage.getTheme() as 'dark' | 'light';
    this.applyTheme();
  }

  /** Global keyboard shortcuts */
  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    const ctrl = event.ctrlKey || event.metaKey;

    // Ctrl+T: New tab
    if (ctrl && event.key === 't') {
      event.preventDefault();
      this.tabService.openNewTab();
    }
    // Ctrl+W: Close tab
    if (ctrl && event.key === 'w') {
      event.preventDefault();
      const tab = this.tabService.activeTab();
      if (tab) this.tabService.closeTab(tab.id);
    }
    // Ctrl+Enter: Send request (handled in request builder)
    // Ctrl+S: Save request
    if (ctrl && event.key === 's') {
      event.preventDefault();
      // Trigger save from request builder via custom event
    }
    // Ctrl+E: Toggle environment
    if (ctrl && event.key === 'e') {
      event.preventDefault();
      this.showEnvModal = !this.showEnvModal;
    }
    // Ctrl+`: Toggle console
    if (ctrl && event.key === '`') {
      event.preventDefault();
      this.toggleConsole();
    }
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleConsole() {
    this.consoleOpen = !this.consoleOpen;
    this.storage.setConsoleOpen(this.consoleOpen);
  }

  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    this.storage.setTheme(this.theme);
    this.applyTheme();
  }

  private applyTheme() {
    document.documentElement.setAttribute('data-theme', this.theme);
  }

  setActiveEnvironment(id: string | null) {
    this.envService.setActive(id);
  }
}
