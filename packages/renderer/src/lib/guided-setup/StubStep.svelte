<script lang="ts">
import type { GuidedSetupStepProps } from './guided-setup-steps';

let { stepId, title, description }: Omit<GuidedSetupStepProps, 'onboarding'> = $props();
</script>

<div data-testid="stub-step-{stepId}">{title} - {description}</div>
