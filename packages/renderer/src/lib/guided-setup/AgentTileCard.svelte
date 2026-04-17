<script lang="ts">
import { Icon } from '@podman-desktop/ui-svelte/icons';

import type { AgentTileData } from './guided-setup-steps';

interface Props {
  agent: AgentTileData;
  selected: boolean;
  onclick?: () => void;
}

let { agent, selected, onclick }: Props = $props();
</script>

<button
  class="relative flex flex-col rounded-lg p-4 pb-10 text-left cursor-pointer transition-colors border-2
    {selected
      ? 'border-(--pd-content-card-border-selected) bg-(--pd-content-card-hover-inset-bg)'
      : 'border-(--pd-content-card-border) bg-(--pd-content-card-inset-bg) hover:bg-(--pd-content-card-hover-inset-bg)'}"
  role="option"
  aria-selected={selected}
  aria-label={agent.title}
  {onclick}>
  <div class="w-10 h-10 rounded-lg flex items-center justify-center mb-3 {agent.iconBgClass}">
    <Icon icon={agent.icon} size="lg" />
  </div>
  <span class="text-sm font-semibold text-(--pd-content-card-text) mb-1">{agent.title}</span>
  <span class="text-xs text-(--pd-content-card-text) opacity-50 leading-relaxed">{agent.description}</span>
  {#if agent.recommended}
    <span
      class="absolute bottom-3 left-4 text-[10px] font-bold uppercase tracking-wider text-green-400 bg-green-400/10 px-2 py-0.5 rounded"
      >Recommended</span>
  {/if}
</button>
