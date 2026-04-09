import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabService } from '../../services/tab.service';
import { RequestTab } from '../../models/api.models';

@Component({
  selector: 'app-tab-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tab-bar">
      <div class="tabs-scroll">
        @for (tab of tabService.tabs(); track tab.id) {
          <div
            class="tab"
            [class.active]="tab.id === tabService.activeTabId()"
            (click)="tabService.setActiveTab(tab.id)"
            (dblclick)="renameTab(tab)"
          >
            <span class="tab-method" [ngClass]="'m-' + tab.request.method.toLowerCase()">{{ tab.request.method }}</span>
            <span class="tab-name">{{ tab.name || 'Untitled' }}</span>
            @if (tab.isDirty) {
              <span class="tab-dirty">●</span>
            }
            <button class="tab-close" (click)="closeTab(tab.id, $event)" title="Close tab">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        }
      </div>
      <button class="tab-add" (click)="tabService.openNewTab()" title="New Tab (Ctrl+T)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; flex-shrink: 0; }
    .tab-bar { display: flex; align-items: stretch; background: var(--surface-elevated); border-bottom: 1px solid var(--border-color); height: 38px; overflow: hidden; }
    .tabs-scroll { display: flex; flex: 1; overflow-x: auto; overflow-y: hidden; }
    .tabs-scroll::-webkit-scrollbar { height: 0; }
    .tab { display: flex; align-items: center; gap: 6px; padding: 0 12px; min-width: 120px; max-width: 200px; border-right: 1px solid var(--border-color); cursor: pointer; transition: background 0.12s; position: relative; flex-shrink: 0; font-size: 12px; }
    .tab:hover { background: rgba(255,255,255,0.03); }
    .tab.active { background: var(--surface-primary); border-bottom: 2px solid var(--accent); }
    .tab.active::after { content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 1px; background: var(--surface-primary); }
    .tab-method { font-size: 8px; font-weight: 700; font-family: 'JetBrains Mono', monospace; flex-shrink: 0; }
    .m-get { color: var(--method-get); } .m-post { color: var(--method-post); } .m-put { color: var(--method-put); }
    .m-delete { color: var(--method-delete); } .m-patch { color: var(--method-patch); } .m-head { color: var(--method-head); } .m-options { color: var(--method-options); }
    .tab-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-secondary); flex: 1; }
    .tab.active .tab-name { color: var(--text-primary); font-weight: 500; }
    .tab-dirty { color: var(--accent); font-size: 8px; flex-shrink: 0; }
    .tab-close { display: flex; align-items: center; justify-content: center; background: none; border: none; color: var(--text-muted); padding: 2px; border-radius: 3px; cursor: pointer; opacity: 0; transition: all 0.12s; flex-shrink: 0; }
    .tab:hover .tab-close, .tab.active .tab-close { opacity: 1; }
    .tab-close:hover { background: rgba(255,255,255,0.1); color: var(--status-error); }
    .tab-add { display: flex; align-items: center; justify-content: center; background: none; border: none; border-left: 1px solid var(--border-color); color: var(--text-muted); padding: 0 12px; cursor: pointer; transition: all 0.12s; flex-shrink: 0; }
    .tab-add:hover { background: rgba(255,255,255,0.04); color: var(--text-primary); }
  `],
})
export class TabBarComponent {
  tabService = inject(TabService);

  closeTab(id: string, event: Event) {
    event.stopPropagation();
    this.tabService.closeTab(id);
  }

  renameTab(tab: RequestTab) {
    const name = prompt('Tab name:', tab.name);
    if (name?.trim()) {
      this.tabService.updateActiveRequest({ name: name.trim() });
    }
  }
}
