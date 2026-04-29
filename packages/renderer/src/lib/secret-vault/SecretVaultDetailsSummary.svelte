<script lang="ts">
import DetailsCell from '/@/lib/details/DetailsCell.svelte';
import DetailsTable from '/@/lib/details/DetailsTable.svelte';
import DetailsTitle from '/@/lib/details/DetailsTitle.svelte';
import { getServiceLabel } from '/@/lib/secret-vault/secret-vault-utils';
import { agentWorkspaces } from '/@/stores/agent-workspaces.svelte';
import type { AgentWorkspaceConfiguration } from '/@api/agent-workspace-info';
import type { SecretVaultInfo } from '/@api/secret-vault/secret-vault-info';

interface Props {
  secretInfo: SecretVaultInfo | undefined;
}

let { secretInfo }: Props = $props();

interface UsedByEntry {
  name: string;
  kind: string;
}

let usedBy: UsedByEntry[] = $state([]);

function workspaceUsesSecret(config: AgentWorkspaceConfiguration, secretName: string): boolean {
  if (config.secrets?.includes(secretName)) return true;
  if (config.environment?.some(e => e.secret === secretName)) return true;
  return false;
}

$effect(() => {
  const name = secretInfo?.name;
  if (!name) {
    usedBy = [];
    return;
  }

  const workspaces = $agentWorkspaces;
  let current = true;

  Promise.all(
    workspaces.map(async ws => {
      try {
        const config = await window.getAgentWorkspaceConfiguration(ws.id);
        if (workspaceUsesSecret(config, name)) {
          return { name: ws.name, kind: 'Workspace' } satisfies UsedByEntry;
        }
      } catch {
        // skip workspaces whose configuration cannot be read
      }
      return undefined;
    }),
  )
    .then(results => {
      if (current) {
        usedBy = results.filter((r): r is UsedByEntry => r !== undefined);
      }
    })
    .catch(() => {
      if (current) usedBy = [];
    });

  return (): void => {
    current = false;
  };
});
</script>

<div class="h-min">
  <DetailsTable>
    {#if secretInfo?.type}
      <tr>
        <DetailsCell>Type</DetailsCell>
        <DetailsCell>{getServiceLabel(secretInfo.type)}</DetailsCell>
      </tr>
    {/if}
    {#if secretInfo?.description}
      <tr>
        <DetailsCell>Description</DetailsCell>
        <DetailsCell>{secretInfo.description}</DetailsCell>
      </tr>
    {/if}
    {#if secretInfo?.hosts?.length}
      <tr>
        <DetailsCell>Hosts</DetailsCell>
        <DetailsCell>{secretInfo.hosts.join(', ')}</DetailsCell>
      </tr>
    {/if}
    {#if secretInfo?.path}
      <tr>
        <DetailsCell>Path</DetailsCell>
        <DetailsCell>{secretInfo.path}</DetailsCell>
      </tr>
    {/if}
    {#if secretInfo?.header}
      <tr>
        <DetailsCell>Header</DetailsCell>
        <DetailsCell>{secretInfo.header}</DetailsCell>
      </tr>
    {/if}
    {#if secretInfo?.headerTemplate}
      <tr>
        <DetailsCell>Header template</DetailsCell>
        <DetailsCell>{secretInfo.headerTemplate}</DetailsCell>
      </tr>
    {/if}
    {#if secretInfo?.envs?.length}
      <tr>
        <DetailsTitle>Environment variables</DetailsTitle>
      </tr>
      {#each secretInfo.envs as env (env)}
        <tr>
          <DetailsCell>{env}</DetailsCell>
          <DetailsCell></DetailsCell>
        </tr>
      {/each}
    {/if}
    {#if usedBy.length}
      <tr>
        <DetailsTitle>Used by</DetailsTitle>
      </tr>
      {#each usedBy as entry (entry.name)}
        <tr>
          <DetailsCell>{entry.name}</DetailsCell>
          <DetailsCell>{entry.kind}</DetailsCell>
        </tr>
      {/each}
    {/if}
  </DetailsTable>
</div>
