<script lang="ts">
import { StatusIcon } from '@podman-desktop/ui-svelte';

import type { CatalogModelInfo } from './models-utils';

interface Props {
  models: CatalogModelInfo[];
  selectedKey: string;
  radioName: string;
  heading: string;
  onselect: (model: CatalogModelInfo) => void;
  modelKey: (model: CatalogModelInfo) => string;
  subtitle?: (model: CatalogModelInfo) => string;
  statusMapper?: (connectionStatus: string) => string;
}

const defaultStatusMap: Record<string, string> = {
  started: 'RUNNING',
  starting: 'STARTING',
  stopped: 'CREATED',
  stopping: 'DELETING',
  failed: 'DEGRADED',
  unknown: 'RUNNING',
};

let {
  models,
  selectedKey,
  radioName,
  heading,
  onselect,
  modelKey: getKey,
  subtitle = (m: CatalogModelInfo): string => m.connectionName,
  statusMapper = (s: string): string => defaultStatusMap[s] ?? 'RUNNING',
}: Props = $props();

function handleKeydown(e: KeyboardEvent, model: CatalogModelInfo): void {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onselect(model);
  }
}
</script>

<div class="rounded-md border border-(--pd-content-divider) overflow-hidden">
  <table class="w-full text-sm" aria-label="{heading} models">
    <thead>
      <tr class="border-b border-(--pd-content-divider) bg-(--pd-content-card-inset-bg)">
        <th class="w-10 px-3 py-2 text-left text-xs font-medium text-(--pd-content-card-text) opacity-60">Status</th>
        <th class="px-3 py-2 text-left text-xs font-medium text-(--pd-content-card-text) opacity-60">Name</th>
        <th class="w-20 px-3 py-2 text-left text-xs font-medium text-(--pd-content-card-text) opacity-60">Size</th>
        <th class="w-28 px-3 py-2 text-left text-xs font-medium text-(--pd-content-card-text) opacity-60">Runtime</th>
        <th class="w-12 px-3 py-2 text-center text-xs font-medium text-(--pd-content-card-text) opacity-60">Use</th>
      </tr>
    </thead>
    <tbody>
      {#each models as model (getKey(model))}
        {@const key = getKey(model)}
        {@const isSelected = selectedKey === key}
        <tr
          role="button"
          tabindex="0"
          class="border-b border-(--pd-content-divider) last:border-b-0 transition-colors
            cursor-pointer hover:bg-(--pd-content-card-hover-inset-bg)
            {isSelected ? 'bg-(--pd-content-card-hover-inset-bg)' : ''}"
          onclick={onselect.bind(undefined, model)}
          onkeydown={(e: KeyboardEvent): void => handleKeydown(e, model)}
          data-testid="model-row-{model.label}">
          <td class="px-3 py-2">
            <StatusIcon status={statusMapper(model.connectionStatus)} />
          </td>
          <td class="px-3 py-2">
            <div class="font-medium text-(--pd-table-body-text-highlight)">{model.label}</div>
            <div class="text-[11px] text-(--pd-content-card-text) opacity-60">{subtitle(model)}</div>
          </td>
          <td class="px-3 py-2 text-(--pd-table-body-text)">—</td>
          <td class="px-3 py-2 text-(--pd-table-body-text)">{model.providerName}</td>
          <td class="px-3 py-2 text-center">
            <input
              type="radio"
              name={radioName}
              value={key}
              checked={isSelected}
              aria-label="Use {model.label}"
              class="accent-(--pd-button-primary-bg) w-4 h-4 cursor-pointer pointer-events-none" />
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
