<script lang="ts">
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { Tab } from '@podman-desktop/ui-svelte';
import { router } from 'tinro';

import { withConfirmation } from '/@/lib/dialogs/messagebox-utils';
import DetailsPage from '/@/lib/ui/DetailsPage.svelte';
import ListItemButtonIcon from '/@/lib/ui/ListItemButtonIcon.svelte';
import { getTabUrl, isTabSelected } from '/@/lib/ui/Util';
import Route from '/@/Route.svelte';
import { secretVaultInfos } from '/@/stores/secret-vault';
import type { SecretVaultInfo } from '/@api/secret-vault/secret-vault-info';

import SecretVaultDetailsSummary from './SecretVaultDetailsSummary.svelte';

interface Props {
  id: string;
}

let { id }: Props = $props();

const secretInfo: SecretVaultInfo | undefined = $derived($secretVaultInfos.find(s => s.id === id));

function handleRemove(): void {
  withConfirmation(
    async () => {
      try {
        await window.removeSecret(id);
        router.goto('/secret-vault');
      } catch (error: unknown) {
        console.error('Failed to remove secret', error);
      }
    },
    `remove secret ${secretInfo?.name ?? id}`,
  );
}
</script>

<DetailsPage title={secretInfo?.name ?? id}>
  {#snippet actionsSnippet()}
    <ListItemButtonIcon title="Remove Secret" onClick={handleRemove} icon={faTrash} />
  {/snippet}
  {#snippet tabsSnippet()}
    <Tab title="Summary" selected={isTabSelected($router.path, 'summary')} url={getTabUrl($router.path, 'summary')} />
  {/snippet}
  {#snippet contentSnippet()}
    <Route path="/summary" breadcrumb="Summary" navigationHint="tab">
      <SecretVaultDetailsSummary {secretInfo} />
    </Route>
  {/snippet}
</DetailsPage>
