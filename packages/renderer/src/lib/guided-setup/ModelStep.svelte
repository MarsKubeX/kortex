<script lang="ts">
import { Spinner, StatusIcon } from '@podman-desktop/ui-svelte';
import { untrack } from 'svelte';

import { type CatalogModelInfo, getCatalogModels } from '/@/lib/models/models-utils';
import { providerInfos } from '/@/stores/providers';

import { getAgentDefinition } from './agent-registry';
import type { CliAgent, GuidedSetupStepProps, OnboardingModelSelection } from './guided-setup-steps';

let { onboarding }: GuidedSetupStepProps = $props();

const agentToProviders: Record<CliAgent, string[]> = {
  opencode: ['ollama', 'ramalama', 'openshiftai'],
  claude: ['claude'],
  'claude-vertex': ['claude'],
  cursor: [],
  goose: [],
};

const statusMap: Record<string, string> = {
  started: 'RUNNING',
  starting: 'STARTING',
  stopped: 'CREATED',
  stopping: 'DELETING',
  failed: 'DEGRADED',
  unknown: 'RUNNING',
};

let agentTitle = $derived(getAgentDefinition(onboarding.agent).title);

let providerModels: CatalogModelInfo[] = $derived(
  getCatalogModels($providerInfos).filter(m => agentToProviders[onboarding.agent]?.includes(m.providerId)),
);

let vertexModels: CatalogModelInfo[] = $state([]);
let vertexLoading = $state(false);
let vertexError = $state('');

let allModels: CatalogModelInfo[] = $derived(onboarding.agent === 'claude-vertex' ? vertexModels : providerModels);

$effect(() => {
  if (onboarding.agent === 'claude-vertex' && onboarding.vertexConfig) {
    const { projectId, region, credentialsPath } = onboarding.vertexConfig;
    if (projectId && region && credentialsPath) {
      fetchVertexModels(projectId, region, credentialsPath).catch((e: unknown) => console.error(e));
    }
  }
});

async function fetchVertexModels(projectId: string, region: string, credentialsPath: string): Promise<void> {
  vertexLoading = true;
  vertexError = '';
  try {
    const models = await window.listVertexAiModels({ projectId, region, credentialsPath });
    vertexModels = models.map(m => ({
      providerId: 'claude',
      providerName: 'Anthropic (Vertex AI)',
      connectionName: 'vertex-ai',
      type: 'cloud' as const,
      label: m.name,
      connectionStatus: 'started' as const,
    }));
  } catch (err: unknown) {
    vertexError = err instanceof Error ? err.message : String(err);
    vertexModels = [];
  } finally {
    vertexLoading = false;
  }
}

let localModels = $derived(allModels.filter(m => m.type === 'local'));
let selfHostedModels = $derived(allModels.filter(m => m.type === 'self-hosted'));
let cloudModels = $derived(allModels.filter(m => m.type === 'cloud'));

let userSelectionLabel = $state(untrack(() => onboarding.model?.label ?? ''));

let effectiveModel: CatalogModelInfo | undefined = $derived.by(() => {
  if (userSelectionLabel) {
    const match = allModels.find(m => m.label === userSelectionLabel);
    if (match) return match;
  }
  return allModels.length > 0 ? allModels[0] : undefined;
});

$effect(() => {
  if (effectiveModel) {
    const selection: OnboardingModelSelection = {
      providerId: effectiveModel.providerId,
      label: effectiveModel.label,
    };
    onboarding.model = selection;
  } else {
    onboarding.model = undefined;
  }
});

function selectModel(label: string): void {
  userSelectionLabel = label;
}

function uniqueProviderNames(models: CatalogModelInfo[]): string {
  return [...new Set(models.map(m => m.providerName))].join(' & ');
}

function mapStatus(connectionStatus: string): string {
  return statusMap[connectionStatus] ?? 'RUNNING';
}

function statusLabel(connectionStatus: string, type: string): string {
  if (connectionStatus === 'started') return type === 'local' ? 'loaded in memory' : 'deployed';
  if (connectionStatus === 'stopped') return type === 'local' ? 'not loaded' : 'not deployed';
  if (connectionStatus === 'starting') return 'starting…';
  return connectionStatus;
}
</script>

<div class="mx-auto max-w-3xl py-4">
  <h2 class="text-xl font-semibold text-(--pd-content-card-text) mb-1">Default model for the agent</h2>
  <p class="text-sm text-(--pd-content-card-text) opacity-60 mb-6">
    This is the model {agentTitle} will use by default in new workspaces.
    Names match the <strong>Models</strong> catalog; enable or disable rows there.
    You can override per session later.
  </p>

  <div
    class="rounded-xl border border-(--pd-content-divider) bg-(--pd-content-card-inset-bg) p-6"
    data-testid="model-step-card">
    <p class="text-sm text-(--pd-content-card-text) opacity-70 mb-5">
      Same rows as <strong>Models</strong>. Click a line or use the <strong>Use</strong> control
      to pick your default for <strong>{onboarding.agent === 'opencode' ? 'local' : 'cloud'}</strong> models.
    </p>

    {#if vertexLoading}
      <div class="flex items-center justify-center py-12 text-center gap-3" data-testid="vertex-loading">
        <Spinner size="1.25em" />
        <p class="text-sm text-(--pd-content-card-text) opacity-60">Fetching models from Vertex AI…</p>
      </div>
    {:else if vertexError}
      <div class="py-6 text-center" data-testid="vertex-error">
        <p class="text-sm text-(--pd-state-error) mb-1">Failed to fetch Vertex AI models</p>
        <p class="text-xs text-(--pd-content-card-text) opacity-50">{vertexError}</p>
      </div>
    {:else if allModels.length === 0}
      <div class="flex items-center justify-center py-12 text-center" data-testid="model-step-empty">
        <div>
          <p class="text-sm text-(--pd-content-card-text) opacity-60">No models found</p>
          <p class="text-xs text-(--pd-content-card-text) opacity-40 mt-1">
            {#if onboarding.agent === 'claude-vertex'}
              Make sure you provided valid credentials and the Vertex AI API is enabled in your project.
            {:else}
              Make sure a compatible runtime is running with at least one model available.
            {/if}
          </p>
        </div>
      </div>
    {/if}

    {#if localModels.length > 0}
      <div class="mb-6" data-testid="local-models-section">
        <h4 class="text-xs font-bold uppercase tracking-wider text-(--pd-content-card-text) opacity-50 mb-3">
          Local · {uniqueProviderNames(localModels)}
        </h4>
        <div class="rounded-xl border border-(--pd-content-divider) bg-(--pd-content-card-bg) overflow-hidden">
          {#each localModels as model, idx (model.providerId + '/' + model.label)}
            {#if idx > 0}
              <div class="mx-3 border-t border-(--pd-content-divider) opacity-30"></div>
            {/if}
            <button
              class="w-full flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors text-left
                {effectiveModel?.label === model.label
                  ? 'bg-(--pd-content-card-hover-inset-bg)'
                  : 'hover:bg-(--pd-content-card-hover-inset-bg)'}"
              onclick={selectModel.bind(undefined, model.label)}
              aria-label={model.label}
              data-testid="model-row-{model.label}">
              <StatusIcon status={mapStatus(model.connectionStatus)} />
              <div class="min-w-0 flex-1">
                <span class="text-[13px] font-medium text-(--pd-table-body-text-highlight)">{model.label}</span>
                <div class="text-[11px] text-(--pd-table-body-text) mt-0.5">
                  {model.providerName} · {statusLabel(model.connectionStatus, model.type)}
                </div>
              </div>
              <div class="flex items-center gap-4 shrink-0 text-xs text-(--pd-table-body-text)">
                <span class="w-20">{model.providerName}</span>
                <input
                  type="radio"
                  name="model-selection"
                  value={model.label}
                  checked={effectiveModel?.label === model.label}
                  aria-label="Use {model.label}"
                  class="accent-(--pd-button-primary-bg) w-4 h-4 cursor-pointer pointer-events-none" />
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if selfHostedModels.length > 0}
      <div class="mb-6" data-testid="self-hosted-models-section">
        <h4 class="text-xs font-bold uppercase tracking-wider text-(--pd-content-card-text) opacity-50 mb-3">
          In-house · {uniqueProviderNames(selfHostedModels)}
        </h4>
        <div class="rounded-xl border border-(--pd-content-divider) bg-(--pd-content-card-bg) overflow-hidden">
          {#each selfHostedModels as model, idx (model.providerId + '/' + model.label)}
            {#if idx > 0}
              <div class="mx-3 border-t border-(--pd-content-divider) opacity-30"></div>
            {/if}
            <button
              class="w-full flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors text-left
                {effectiveModel?.label === model.label
                  ? 'bg-(--pd-content-card-hover-inset-bg)'
                  : 'hover:bg-(--pd-content-card-hover-inset-bg)'}"
              onclick={selectModel.bind(undefined, model.label)}
              aria-label={model.label}
              data-testid="model-row-{model.label}">
              <StatusIcon status={mapStatus(model.connectionStatus)} />
              <div class="min-w-0 flex-1">
                <span class="text-[13px] font-medium text-(--pd-table-body-text-highlight)">{model.label}</span>
                <div class="text-[11px] text-(--pd-table-body-text) mt-0.5">
                  {model.providerName} · {statusLabel(model.connectionStatus, model.type)}
                </div>
              </div>
              <div class="flex items-center gap-4 shrink-0 text-xs text-(--pd-table-body-text)">
                <span class="w-20">{model.providerName}</span>
                <input
                  type="radio"
                  name="model-selection"
                  value={model.label}
                  checked={effectiveModel?.label === model.label}
                  aria-label="Use {model.label}"
                  class="accent-(--pd-button-primary-bg) w-4 h-4 cursor-pointer pointer-events-none" />
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if cloudModels.length > 0}
      <div data-testid="cloud-models-section">
        <h4 class="text-xs font-bold uppercase tracking-wider text-(--pd-content-card-text) opacity-50 mb-3">
          Cloud · {uniqueProviderNames(cloudModels)}
        </h4>
        <div class="rounded-xl border border-(--pd-content-divider) bg-(--pd-content-card-bg) overflow-hidden">
          {#each cloudModels as model, idx (model.providerId + '/' + model.label)}
            {#if idx > 0}
              <div class="mx-3 border-t border-(--pd-content-divider) opacity-30"></div>
            {/if}
            <button
              class="w-full flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors text-left
                {effectiveModel?.label === model.label
                  ? 'bg-(--pd-content-card-hover-inset-bg)'
                  : 'hover:bg-(--pd-content-card-hover-inset-bg)'}"
              onclick={selectModel.bind(undefined, model.label)}
              aria-label={model.label}
              data-testid="model-row-{model.label}">
              <StatusIcon status={mapStatus(model.connectionStatus)} />
              <div class="min-w-0 flex-1">
                <span class="text-[13px] font-medium text-(--pd-table-body-text-highlight)">{model.label}</span>
                <div class="text-[11px] text-(--pd-table-body-text) mt-0.5">
                  {model.providerName}
                </div>
              </div>
              <div class="flex items-center gap-4 shrink-0 text-xs text-(--pd-table-body-text)">
                <span class="w-20">{model.providerName}</span>
                <input
                  type="radio"
                  name="model-selection"
                  value={model.label}
                  checked={effectiveModel?.label === model.label}
                  aria-label="Use {model.label}"
                  class="accent-(--pd-button-primary-bg) w-4 h-4 cursor-pointer pointer-events-none" />
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  {#if effectiveModel}
    <p class="text-sm text-(--pd-button-primary-bg) mt-4" data-testid="selected-model">
      Selected: {effectiveModel.label}
    </p>
  {/if}
</div>
