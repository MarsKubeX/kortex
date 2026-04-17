/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, expect, test, vi } from 'vitest';

import CodingAgentStep from './CodingAgentStep.svelte';
import type { OnboardingState } from './guided-setup-steps';
import { createDefaultOnboardingState } from './guided-setup-steps';

let onboarding: OnboardingState;

function stubOllama(ok: boolean): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok }));
}

function stubRamalama(hasConnections: boolean): void {
  const providers = hasConnections ? [{ id: 'ramalama', inferenceConnections: [{ status: 'started' }] }] : [];
  (window as unknown as Record<string, unknown>).getProviderInfos = vi.fn().mockResolvedValue(providers);
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.resetAllMocks();
  onboarding = createDefaultOnboardingState();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no server')));
  stubRamalama(false);
});

function renderStep(overrides: Partial<OnboardingState> = {}): void {
  Object.assign(onboarding, overrides);
  render(CodingAgentStep, {
    stepId: 'coding-agent',
    title: 'Choose your coding agent',
    description: 'Pick one runtime for kdn.',
    onboarding,
  });
}

test('renders the OpenCode tile', () => {
  renderStep();

  expect(screen.getByRole('option', { name: 'OpenCode' })).toBeInTheDocument();
});

test('does not render Claude or Vertex tiles', () => {
  renderStep();

  expect(screen.queryByRole('option', { name: 'Claude Code' })).not.toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'Claude Code + Vertex AI' })).not.toBeInTheDocument();
});

test('OpenCode is selected', () => {
  renderStep();

  const tile = screen.getByRole('option', { name: 'OpenCode' });
  expect(tile).toHaveAttribute('aria-selected', 'true');
});

test('shows Recommended badge on OpenCode', () => {
  renderStep();

  expect(screen.getByText('Recommended')).toBeInTheDocument();
});

test('sets onboarding agent to opencode', async () => {
  renderStep();

  await waitFor(() => {
    expect(onboarding.agent).toBe('opencode');
    expect(onboarding.agentVariant).toBe('opencode');
  });
});

test('shows local runtime panel', () => {
  renderStep();

  expect(screen.getByTestId('opencode-panel')).toBeInTheDocument();
  expect(screen.getByText('Local Runtime')).toBeInTheDocument();
});

test('shows probe checking state on mount', async () => {
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
  (window as unknown as Record<string, unknown>).getProviderInfos = vi.fn().mockReturnValue(new Promise(() => {}));

  renderStep();

  await waitFor(() => {
    expect(screen.getByTestId('probe-checking')).toBeInTheDocument();
  });
});

test('shows detected state when Ollama responds successfully', async () => {
  stubOllama(true);

  renderStep();

  await waitFor(() => {
    expect(screen.getByTestId('probe-detected')).toBeInTheDocument();
  });
});

test('shows detected state when Ramalama has inference connections', async () => {
  stubRamalama(true);

  renderStep();

  await waitFor(() => {
    expect(screen.getByTestId('probe-detected')).toBeInTheDocument();
  });
});

test('shows not-found state when both probes fail', async () => {
  renderStep();

  await waitFor(() => {
    expect(screen.getByTestId('probe-not-found')).toBeInTheDocument();
  });
});

test('Check again button retries the probe', async () => {
  renderStep();

  await waitFor(() => {
    expect(screen.getByTestId('probe-not-found')).toBeInTheDocument();
  });

  stubOllama(true);

  await fireEvent.click(screen.getByRole('button', { name: 'Check again' }));

  await waitFor(() => {
    expect(screen.getByTestId('probe-detected')).toBeInTheDocument();
  });
});

test('step title and description are rendered', () => {
  renderStep();

  expect(screen.getByText('Choose your coding agent')).toBeInTheDocument();
});
