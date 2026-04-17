<script lang="ts">
import { faCircleCheck, faDesktop, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@podman-desktop/ui-svelte';
import { Icon } from '@podman-desktop/ui-svelte/icons';

import AgentTileCard from './AgentTileCard.svelte';
import type { AgentTileData, GuidedSetupStepProps } from './guided-setup-steps';

let { title, description, onboarding }: GuidedSetupStepProps = $props();

const agent: AgentTileData = {
  key: 'opencode',
  cliAgent: 'opencode',
  title: 'OpenCode',
  description:
    'Open-source agent on your machine \u2014 local models via Ollama or Ramalama, or cloud APIs (OpenAI, Gemini, and other providers OpenCode supports).',
  icon: faDesktop,
  iconBgClass: 'bg-gray-700',
  recommended: true,
};

type ProbeStatus = 'idle' | 'checking' | 'detected' | 'not-found';
let probeStatus: ProbeStatus = $state('idle');

$effect(() => {
  onboarding.agent = agent.cliAgent;
  onboarding.agentVariant = agent.key;
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
  if (probeStatus === 'idle') {
    probeLocalRuntime().catch((err: unknown) => {
      console.error('Local runtime probe failed', err);
    });
  }
});
</script>

<div class="mx-auto max-w-3xl py-4">
  <h2 class="text-xl font-semibold text-(--pd-content-card-text) mb-1">{title}</h2>
  <p class="text-sm text-(--pd-content-card-text) opacity-60 mb-6">
    {description} The API notes below update for your choice. You can change this later in settings.
  </p>

  <div class="max-w-xs mb-8">
    <AgentTileCard {agent} selected={true} />
  </div>
    <div class="rounded-xl border border-(--pd-content-divider) bg-(--pd-content-card-inset-bg) p-6" data-testid="opencode-panel">
      <h3 class="text-xs font-bold uppercase tracking-wider text-(--pd-content-card-text) opacity-50 mb-3">
        Local Runtime
      </h3>
      <p class="text-xs text-(--pd-content-card-text) opacity-50 mb-4 leading-relaxed">
        We probe for a local OpenAI-compatible server (typically <strong>Ollama</strong> on port 11434 or <strong>Ramalama</strong>). Results update the default-model step.
      </p>

      {#if probeStatus === 'checking'}
        <div class="flex items-center gap-3 rounded-lg bg-(--pd-content-card-bg) p-4" role="status" aria-live="polite" data-testid="probe-checking">
          <div class="h-5 w-5 animate-spin rounded-full border-2 border-(--pd-content-card-text) border-t-transparent" aria-hidden="true"></div>
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
              <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" class="text-amber-200 font-semibold hover:underline">Ollama</a>
              or
              <a href="https://github.com/containers/ramalama" target="_blank" rel="noopener noreferrer" class="text-amber-200 font-semibold hover:underline">Ramalama</a>,
              pull at least one model, then run <strong>Check again</strong>.
            </p>
            <Button type="secondary" class="mt-3" aria-label="Check again" onclick={handleRetryProbe}>Check again</Button>
          </div>
        </div>
      {/if}
    </div>
</div>
