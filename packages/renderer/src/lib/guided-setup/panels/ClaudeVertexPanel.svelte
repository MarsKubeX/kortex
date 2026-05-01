<script lang="ts">
import { faArrowUpRightFromSquare, faFolderOpen } from '@fortawesome/free-solid-svg-icons';
import { Button, Checkbox, ErrorMessage, Input, Link } from '@podman-desktop/ui-svelte';
import { Icon } from '@podman-desktop/ui-svelte/icons';

import type { OnboardingState } from '../guided-setup-steps';

interface Props {
  onboarding?: OnboardingState;
}

let { onboarding }: Props = $props();

let projectId = $state('');
let region = $state('global');
let credentialsPath = $state('');
let mountClaudeConfig = $state(false);
let errorMessage = $state('');
let defaultGcloudPath = $state('~/.config/gcloud');

async function detectDefaultGcloudPath(): Promise<void> {
  const platform = await window.getOsPlatform();
  defaultGcloudPath = platform === 'win32' ? '%APPDATA%\\gcloud' : '~/.config/gcloud';
}

detectDefaultGcloudPath().catch(() => {});

const KDN_VERTEX_README = 'https://github.com/openkaiden/kdn/blob/main/README.md#claude-with-a-model-from-vertex-ai';

function openReadmeLink(): void {
  window.openExternal(KDN_VERTEX_README).catch(() => {});
}

async function browseCredentials(): Promise<void> {
  const result = await window.openDialog({
    title: 'Select Google Cloud credentials directory',
    selectors: ['openDirectory'],
  });
  if (result?.[0]) {
    credentialsPath = result[0];
  }
}

async function validate(): Promise<boolean> {
  errorMessage = '';

  if (!projectId.trim()) {
    errorMessage = 'Please enter your Google Cloud project ID.';
    return false;
  }

  if (!region.trim()) {
    errorMessage = 'Please enter a region (e.g. us-east5, europe-west1).';
    return false;
  }

  if (!credentialsPath.trim()) {
    errorMessage = 'Please provide the path to your Google Cloud credentials directory.';
    return false;
  }

  if (onboarding) {
    onboarding.vertexConfig = {
      projectId: projectId.trim(),
      region: region.trim(),
      credentialsPath: credentialsPath.trim(),
    };
  }

  return true;
}

$effect(() => {
  if (onboarding) {
    onboarding.beforeAdvance = validate;
  }
  return (): void => {
    if (onboarding?.beforeAdvance === validate) {
      onboarding.beforeAdvance = undefined;
    }
  };
});
</script>

<div
  class="rounded-xl border border-(--pd-content-divider) bg-(--pd-content-card-inset-bg) p-6"
  data-testid="claude-vertex-panel">
  <h3 class="text-xs font-bold uppercase tracking-wider text-(--pd-content-card-text) opacity-50 mb-3">
    Google Cloud Vertex AI
  </h3>
  <p class="text-xs text-(--pd-content-card-text) opacity-50 mb-4 leading-relaxed">
    These values map to <code class="font-mono">environment</code> entries for the Claude agent
    in <code class="font-mono">$PROJECT_DIR/.kaiden/workspace.json</code>.
    Run <code class="font-mono">gcloud auth application-default login</code> on the host before starting the workspace.
  </p>

  <div class="flex flex-col gap-4" data-testid="claude-vertex-form">
    <div class="flex flex-col gap-1.5">
      <label for="vertex-project-id" class="text-xs font-medium text-(--pd-content-card-text) font-mono">
        ANTHROPIC_VERTEX_PROJECT_ID
      </label>
      <Input
        id="vertex-project-id"
        placeholder="my-gcp-project-id"
        bind:value={projectId}
        aria-label="ANTHROPIC_VERTEX_PROJECT_ID" />
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="vertex-region" class="text-xs font-medium text-(--pd-content-card-text) font-mono">
        CLOUD_ML_REGION
      </label>
      <Input
        id="vertex-region"
        placeholder="us-east5"
        bind:value={region}
        aria-label="CLOUD_ML_REGION" />
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="vertex-credentials" class="text-xs font-medium text-(--pd-content-card-text)">
        Google Cloud credentials directory
      </label>
      <div class="flex flex-row grow space-x-1.5">
        <Input
          id="vertex-credentials"
          placeholder={defaultGcloudPath}
          bind:value={credentialsPath}
          aria-label="Google Cloud credentials path" />
        <Button type="secondary" aria-label="Browse credentials" icon={faFolderOpen} onclick={browseCredentials} />
      </div>
      <span class="text-[10px] text-(--pd-content-card-text) opacity-40">
        This directory will be mounted read-only into the workspace so Claude Code can
        authenticate with Vertex AI via application default credentials.
      </span>
    </div>

    <Checkbox
      bind:checked={mountClaudeConfig}
      title="Mount Claude config">Also mount ~/.claude and ~/.claude.json (optional; reuse host Claude Code settings)</Checkbox>

    <p class="text-[10px] text-(--pd-content-card-text) opacity-40 leading-relaxed">
      No <code class="font-mono">ANTHROPIC_API_KEY</code> is required when using Vertex;
      credentials come from your gcloud application default credentials.
    </p>

    {#if errorMessage}
      <ErrorMessage error={errorMessage} />
    {/if}

    <div class="pt-1">
    <Link class="flex flex-row w-fit items-center" on:click={openReadmeLink}>  <Icon class="ml-1 self-center" icon={faArrowUpRightFromSquare} />&nbsp;kdn README: Claude Code with a model from Vertex AI </Link>
    </div>
  </div>
</div>
