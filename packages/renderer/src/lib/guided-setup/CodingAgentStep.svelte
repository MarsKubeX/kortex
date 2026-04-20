<script lang="ts">
import { faClaude } from '@fortawesome/free-brands-svg-icons';
import { faCircleCheck, faCloud, faDesktop, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { Button, Checkbox, Link, Spinner } from '@podman-desktop/ui-svelte';
import { Icon } from '@podman-desktop/ui-svelte/icons';
import { untrack } from 'svelte';

import type { CardSelectorOption } from '/@/lib/ui/CardSelector.svelte';
import CardSelector from '/@/lib/ui/CardSelector.svelte';
import PasswordInput from '/@/lib/ui/PasswordInput.svelte';

import type { AgentVariant, CliAgent, GuidedSetupStepProps } from './guided-setup-steps';

let { title, description, onboarding }: GuidedSetupStepProps = $props();

const variantToCliAgent: Record<AgentVariant, CliAgent> = {
  opencode: 'opencode',
  claude: 'claude',
  'claude-vertex': 'claude',
};

const agentOptions: CardSelectorOption[] = [
  {
    value: 'opencode',
    title: 'OpenCode',
    badge: 'Recommended',
    description:
      'Open-source agent on your machine \u2014 local models via Ollama or Ramalama, or cloud APIs (OpenAI, Gemini, and other providers OpenCode supports).',
    icon: faDesktop,
  },
  {
    value: 'claude',
    title: 'Claude Code',
    badge: 'Anthropic',
    description: 'Anthropic Claude in the terminal \u2014 uses the Anthropic API or your org bridge.',
    icon: faClaude,
  },
  {
    value: 'claude-vertex',
    title: 'Claude Code + Vertex AI',
    badge: 'Vertex AI',
    description: 'Claude Code with models served on Google Cloud Vertex AI instead of the Anthropic API.',
    icon: faCloud,
  },
];

let selectedVariant = $state(untrack(() => onboarding.agentVariant));
let anthropicApiKey = $state(untrack(() => onboarding.anthropicApiKey));
let vertexProjectId = $state(untrack(() => onboarding.vertexProjectId));
let vertexRegion = $state(untrack(() => onboarding.vertexRegion));
let vertexMountGcloud = $state(untrack(() => onboarding.vertexMountGcloud));
let vertexMountClaudeConfig = $state(untrack(() => onboarding.vertexMountClaudeConfig));

type ProbeStatus = 'idle' | 'checking' | 'detected' | 'not-found';
let probeStatus: ProbeStatus = $state('idle');

$effect(() => {
  const cliAgent = variantToCliAgent[selectedVariant as AgentVariant];
  if (cliAgent) {
    onboarding.agent = cliAgent;
    onboarding.agentVariant = selectedVariant as AgentVariant;
  }
  onboarding.anthropicApiKey = anthropicApiKey;
  onboarding.vertexProjectId = vertexProjectId;
  onboarding.vertexRegion = vertexRegion;
  onboarding.vertexMountGcloud = vertexMountGcloud;
  onboarding.vertexMountClaudeConfig = vertexMountClaudeConfig;
});

async function probeOllama(): Promise<boolean> {
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags', {
      signal: AbortSignal.timeout(4000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function probeRamalama(): Promise<boolean> {
  try {
    const providers = await window.getProviderInfos();
    return providers.some(p => p.id === 'ramalama' && p.inferenceConnections.length > 0);
  } catch {
    return false;
  }
}

async function probeLocalRuntime(): Promise<void> {
  probeStatus = 'checking';
  const [ollama, ramalama] = await Promise.all([probeOllama(), probeRamalama()]);
  probeStatus = ollama || ramalama ? 'detected' : 'not-found';
}

function handleRetryProbe(): void {
  probeLocalRuntime().catch((err: unknown) => {
    console.error('Local runtime probe failed', err);
  });
}

$effect(() => {
  if (selectedVariant === 'opencode' && probeStatus === 'idle') {
    probeLocalRuntime().catch((err: unknown) => {
      console.error('Local runtime probe failed', err);
    });
  }
});
</script>

<div class="mx-auto max-w-3xl py-4">
  <h2 class="text-xl font-semibold text-(--pd-content-card-text) mb-1">{title}</h2>
  <p class="text-sm text-(--pd-content-card-text) opacity-60 mb-6">
    {description}
  </p>

  <div class="mb-8">
    <CardSelector label="Coding agent" options={agentOptions} bind:selected={selectedVariant} required />
  </div>

  {#if selectedVariant === 'opencode'}
    <div class="rounded-xl border border-(--pd-content-divider) bg-(--pd-content-card-inset-bg) p-6" data-testid="opencode-panel">
      <h3 class="text-xs font-bold uppercase tracking-wider text-(--pd-content-card-text) opacity-50 mb-3">
        Local Runtime
      </h3>
      <p class="text-xs text-(--pd-content-card-text) opacity-50 mb-4 leading-relaxed">
        We probe for a local OpenAI-compatible server (typically <strong>Ollama</strong> on port 11434 or <strong>Ramalama</strong>). Results update the default-model step.
      </p>

      {#if probeStatus === 'checking'}
        <div class="flex items-center gap-3 rounded-lg bg-(--pd-content-card-bg) p-4" role="status" aria-live="polite" data-testid="probe-checking">
          <Spinner size="1.25em" />
          <div>
            <strong class="text-sm text-(--pd-content-card-text)">Checking local runtimes\u2026</strong>
            <p class="text-xs text-(--pd-content-card-text) opacity-50 mt-0.5">Looking for Ollama or Ramalama on this machine.</p>
          </div>
        </div>
      {:else if probeStatus === 'detected'}
        <div class="flex items-center gap-3 rounded-lg bg-green-900/20 border border-green-700/30 p-4" role="status" aria-live="polite" data-testid="probe-detected">
          <Icon icon={faCircleCheck} size="lg" class="text-green-400" />
          <div>
            <strong class="text-sm text-green-300">Local runtime detected</strong>
            <p class="text-xs text-green-300/70 mt-0.5">You can pick a default from the local catalog on the next step.</p>
          </div>
        </div>
      {:else if probeStatus === 'not-found'}
        <div class="flex items-start gap-3 rounded-lg bg-amber-900/20 border border-amber-700/30 p-4" role="alert" data-testid="probe-not-found">
          <Icon icon={faTriangleExclamation} size="lg" class="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong class="text-sm text-amber-300">No local model server detected</strong>
            <p class="text-xs text-amber-300/70 mt-1 leading-relaxed">
              Install and start
              <Link on:click={(): Promise<void> => window.openExternal('https://ollama.com')}>Ollama</Link>
              or
              <Link on:click={(): Promise<void> => window.openExternal('https://github.com/containers/ramalama')}>Ramalama</Link>,
              pull at least one model, then run <strong>Check again</strong>.
            </p>
            <Button type="secondary" class="mt-3" aria-label="Check again" onclick={handleRetryProbe}>Check again</Button>
          </div>
        </div>
      {/if}
    </div>
  {:else if selectedVariant === 'claude'}
    <div class="rounded-xl border border-(--pd-content-divider) bg-(--pd-content-card-inset-bg) p-6" data-testid="claude-panel">
      <h3 class="text-xs font-bold uppercase tracking-wider text-(--pd-content-card-text) opacity-50 mb-3">
        API &amp; Credentials
      </h3>
      <p class="text-xs text-(--pd-content-card-text) opacity-50 mb-4 leading-relaxed">
        Claude Code uses the <strong>Anthropic API</strong> unless your team routes traffic elsewhere.
        Optionally store a key now (encrypted as <code class="text-xs bg-(--pd-content-card-bg) px-1.5 py-0.5 rounded">ANTHROPIC_API_KEY</code>).
      </p>
      <div>
        <span class="text-xs font-bold uppercase tracking-wider text-(--pd-content-card-text) opacity-50">API key (optional)</span>
        <PasswordInput
          id="anthropic-api-key"
          placeholder="sk-ant-..."
          bind:password={anthropicApiKey} />
      </div>
    </div>
  {:else if selectedVariant === 'claude-vertex'}
    <div class="rounded-xl border border-(--pd-content-divider) bg-(--pd-content-card-inset-bg) p-6" data-testid="vertex-panel">
      <h3 class="text-xs font-bold uppercase tracking-wider text-(--pd-content-card-text) opacity-50 mb-3">
        Vertex AI &amp; <code class="text-xs bg-(--pd-content-card-bg) px-1.5 py-0.5 rounded">agents.json</code>
      </h3>
      <p class="text-xs text-(--pd-content-card-text) opacity-50 mb-4 leading-relaxed">
        These values map to <code class="text-xs bg-(--pd-content-card-bg) px-1.5 py-0.5 rounded">environment</code> entries for the Claude agent in
        <code class="text-xs bg-(--pd-content-card-bg) px-1.5 py-0.5 rounded">~/.kdn/config/agents.json</code>.
        Run <code class="text-xs bg-(--pd-content-card-bg) px-1.5 py-0.5 rounded">gcloud auth application-default login</code> on the host before starting the workspace.
      </p>
      <div class="flex flex-col gap-4">
        <label class="block">
          <span class="text-xs font-bold uppercase tracking-wider text-(--pd-content-card-text) opacity-50">CLAUDE_CODE_USE_VERTEX</span>
          <input
            type="text"
            class="mt-1 w-full rounded-lg border border-(--pd-content-divider) bg-(--pd-content-card-bg) px-3 py-2 text-sm text-(--pd-content-card-text) opacity-60"
            value="1"
            readonly
            data-testid="vertex-use-vertex-input" />
        </label>
        <label class="block">
          <span class="text-xs font-bold uppercase tracking-wider text-(--pd-content-card-text) opacity-50">ANTHROPIC_VERTEX_PROJECT_ID</span>
          <input
            type="text"
            class="mt-1 w-full rounded-lg border border-(--pd-content-divider) bg-(--pd-content-card-bg) px-3 py-2 text-sm text-(--pd-content-card-text) placeholder:opacity-40 focus:outline-none focus:border-(--pd-content-card-border-selected)"
            placeholder="my-gcp-project-id"
            bind:value={vertexProjectId}
            data-testid="vertex-project-id-input"
            autocomplete="off" />
        </label>
        <label class="block">
          <span class="text-xs font-bold uppercase tracking-wider text-(--pd-content-card-text) opacity-50">CLOUD_ML_REGION</span>
          <input
            type="text"
            class="mt-1 w-full rounded-lg border border-(--pd-content-divider) bg-(--pd-content-card-bg) px-3 py-2 text-sm text-(--pd-content-card-text) placeholder:opacity-40 focus:outline-none focus:border-(--pd-content-card-border-selected)"
            placeholder="us-east5"
            bind:value={vertexRegion}
            data-testid="vertex-region-input"
            autocomplete="off" />
        </label>
      </div>

      <div class="mt-5">
        <p class="text-xs text-(--pd-content-card-text) opacity-50 mb-3">
          Mounts (add under <code class="text-xs bg-(--pd-content-card-bg) px-1.5 py-0.5 rounded">claude.mounts</code> in the same file):
        </p>
        <div class="flex flex-col gap-2">
          <Checkbox
            title="Mount gcloud credentials"
            bind:checked={vertexMountGcloud}>
            <span class="text-xs text-(--pd-content-card-text)">
              Mount <code class="text-xs bg-(--pd-content-card-bg) px-1.5 py-0.5 rounded">$HOME/.config/gcloud</code> read-only for application default credentials
            </span>
          </Checkbox>
          <Checkbox
            title="Mount Claude config"
            bind:checked={vertexMountClaudeConfig}>
            <span class="text-xs text-(--pd-content-card-text)">
              Also mount <code class="text-xs bg-(--pd-content-card-bg) px-1.5 py-0.5 rounded">~/.claude</code> and
              <code class="text-xs bg-(--pd-content-card-bg) px-1.5 py-0.5 rounded">~/.claude.json</code> (optional; reuse host Claude Code settings)
            </span>
          </Checkbox>
        </div>
      </div>

      <p class="text-xs text-(--pd-content-card-text) opacity-40 mt-4 leading-relaxed">
        No <code class="text-xs bg-(--pd-content-card-bg) px-1.5 py-0.5 rounded">ANTHROPIC_API_KEY</code> is required when using Vertex — credentials come from the mounted gcloud config.
      </p>
    </div>
  {/if}
</div>
