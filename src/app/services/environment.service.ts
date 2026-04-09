import { Injectable, inject, signal, computed } from '@angular/core';
import {
  Environment, KeyValuePair, createKeyValuePair, generateId, deepClone
} from '../models/api.models';
import { StorageService } from './storage.service';

/**
 * EnvironmentService manages environments with variable substitution.
 * Supports {{variableName}} syntax in URLs, headers, and body.
 */
@Injectable({ providedIn: 'root' })
export class EnvironmentService {
  private storage = inject(StorageService);

  /** All environments */
  environments = signal<Environment[]>(this.storage.getEnvironments());

  /** Active environment ID */
  activeEnvironmentId = signal<string | null>(this.storage.getActiveEnvironmentId());

  /** Active environment (computed) */
  activeEnvironment = computed(() => {
    const id = this.activeEnvironmentId();
    return this.environments().find((e) => e.id === id) || null;
  });

  /** All variables from the active environment as a map */
  activeVariables = computed(() => {
    const env = this.activeEnvironment();
    if (!env) return new Map<string, string>();
    const map = new Map<string, string>();
    env.variables.filter((v) => v.enabled && v.key).forEach((v) => map.set(v.key, v.value));
    return map;
  });

  // ─── CRUD ───

  addEnvironment(name: string): void {
    const envs = [...this.environments()];
    envs.push({
      id: generateId(),
      name,
      variables: [createKeyValuePair()],
    });
    this.environments.set(envs);
    this.persist();
  }

  updateEnvironment(updated: Environment): void {
    const envs = this.environments().map((e) => (e.id === updated.id ? deepClone(updated) : e));
    this.environments.set(envs);
    this.persist();
  }

  deleteEnvironment(id: string): void {
    const envs = this.environments().filter((e) => e.id !== id);
    this.environments.set(envs);
    if (this.activeEnvironmentId() === id) {
      this.activeEnvironmentId.set(null);
      this.storage.setActiveEnvironmentId(null);
    }
    this.persist();
  }

  duplicateEnvironment(id: string): void {
    const original = this.environments().find((e) => e.id === id);
    if (original) {
      const clone = deepClone(original);
      clone.id = generateId();
      clone.name = original.name + ' (Copy)';
      const envs = [...this.environments(), clone];
      this.environments.set(envs);
      this.persist();
    }
  }

  setActive(id: string | null): void {
    this.activeEnvironmentId.set(id);
    this.storage.setActiveEnvironmentId(id);
  }

  // ─── Variable Substitution ───

  /** Replace {{variable}} patterns in a string with environment values */
  resolveVariables(text: string): string {
    if (!text) return text;
    const vars = this.activeVariables();
    return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return vars.has(varName) ? vars.get(varName)! : match;
    });
  }

  /** Get all variable names referenced in a string */
  extractVariables(text: string): string[] {
    const matches = text.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map((m) => m.replace(/\{|\}/g, '')))];
  }

  private persist(): void {
    this.storage.saveEnvironments(this.environments());
  }
}
