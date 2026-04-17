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

test('renders all three agent tiles', () => {
  renderStep();

  expect(screen.getByRole('option', { name: 'OpenCode' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Claude Code' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Claude Code + Vertex AI' })).toBeInTheDocument();
});

test('OpenCode is selected by default', () => {
  renderStep();

  const tile = screen.getByRole('option', { name: 'OpenCode' });
  expect(tile).toHaveAttribute('aria-selected', 'true');
});

test('shows Recommended badge on OpenCode', () => {
  renderStep();

  expect(screen.getByText('Recommended')).toBeInTheDocument();
});

test('clicking Claude Code selects it and hides OpenCode panel', async () => {
  renderStep();

  const claudeTile = screen.getByRole('option', { name: 'Claude Code' });
  await fireEvent.click(claudeTile);

  expect(claudeTile).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('option', { name: 'OpenCode' })).toHaveAttribute('aria-selected', 'false');
  expect(screen.queryByTestId('opencode-panel')).not.toBeInTheDocument();
});

test('clicking Claude Code sets onboarding agent to claude', async () => {
  renderStep();

  await fireEvent.click(screen.getByRole('option', { name: 'Claude Code' }));

  expect(onboarding.agent).toBe('claude');
  expect(onboarding.agentVariant).toBe('claude');
});

test('clicking Claude Code + Vertex AI sets agent to claude with vertex variant', async () => {
  renderStep();

  await fireEvent.click(screen.getByRole('option', { name: 'Claude Code + Vertex AI' }));

  expect(onboarding.agent).toBe('claude');
  expect(onboarding.agentVariant).toBe('claude-vertex');
});

test('shows local runtime panel when OpenCode is selected', () => {
  renderStep();

  expect(screen.getByTestId('opencode-panel')).toBeInTheDocument();
  expect(screen.getByText('Local Runtime')).toBeInTheDocument();
});

test('shows probe checking state on mount with OpenCode selected', async () => {
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

test('listbox has correct aria-label', () => {
  renderStep();

  expect(screen.getByRole('listbox', { name: 'Coding agent' })).toBeInTheDocument();
});

test('shows Claude API key panel when Claude Code is selected', async () => {
  renderStep();

  await fireEvent.click(screen.getByRole('option', { name: 'Claude Code' }));

  expect(screen.getByTestId('claude-panel')).toBeInTheDocument();
  expect(screen.getByTestId('anthropic-api-key-input')).toBeInTheDocument();
});

test('Claude API key input updates onboarding state', async () => {
  renderStep();

  await fireEvent.click(screen.getByRole('option', { name: 'Claude Code' }));

  const input = screen.getByTestId('anthropic-api-key-input');
  await fireEvent.input(input, { target: { value: 'sk-ant-test123' } });

  await waitFor(() => {
    expect(onboarding.anthropicApiKey).toBe('sk-ant-test123');
  });
});

test('shows Vertex AI panel when Claude Code + Vertex AI is selected', async () => {
  renderStep();

  await fireEvent.click(screen.getByRole('option', { name: 'Claude Code + Vertex AI' }));

  expect(screen.getByTestId('vertex-panel')).toBeInTheDocument();
  expect(screen.getByTestId('vertex-use-vertex-input')).toBeInTheDocument();
  expect(screen.getByTestId('vertex-project-id-input')).toBeInTheDocument();
  expect(screen.getByTestId('vertex-region-input')).toBeInTheDocument();
  expect(screen.getByTestId('vertex-mount-gcloud')).toBeInTheDocument();
  expect(screen.getByTestId('vertex-mount-claude-config')).toBeInTheDocument();
});

test('Vertex AI inputs update onboarding state', async () => {
  renderStep();

  await fireEvent.click(screen.getByRole('option', { name: 'Claude Code + Vertex AI' }));

  const projectInput = screen.getByTestId('vertex-project-id-input');
  await fireEvent.input(projectInput, { target: { value: 'my-project' } });

  const regionInput = screen.getByTestId('vertex-region-input');
  await fireEvent.input(regionInput, { target: { value: 'europe-west4' } });

  await waitFor(() => {
    expect(onboarding.vertexProjectId).toBe('my-project');
    expect(onboarding.vertexRegion).toBe('europe-west4');
  });
});

test('Vertex region has default value', async () => {
  renderStep();

  await fireEvent.click(screen.getByRole('option', { name: 'Claude Code + Vertex AI' }));

  const regionInput: HTMLInputElement = screen.getByTestId('vertex-region-input');
  expect(regionInput.value).toBe('us-east5');
});

test('CLAUDE_CODE_USE_VERTEX is read-only with value 1', async () => {
  renderStep();

  await fireEvent.click(screen.getByRole('option', { name: 'Claude Code + Vertex AI' }));

  const input: HTMLInputElement = screen.getByTestId('vertex-use-vertex-input');
  expect(input.value).toBe('1');
  expect(input).toHaveAttribute('readonly');
});

test('gcloud mount checkbox is checked by default', async () => {
  renderStep();

  await fireEvent.click(screen.getByRole('option', { name: 'Claude Code + Vertex AI' }));

  const checkbox: HTMLInputElement = screen.getByTestId('vertex-mount-gcloud');
  expect(checkbox.checked).toBe(true);
});

test('claude config mount checkbox is unchecked by default', async () => {
  renderStep();

  await fireEvent.click(screen.getByRole('option', { name: 'Claude Code + Vertex AI' }));

  const checkbox: HTMLInputElement = screen.getByTestId('vertex-mount-claude-config');
  expect(checkbox.checked).toBe(false);
});

test('toggling mount checkboxes updates onboarding state', async () => {
  renderStep();

  await fireEvent.click(screen.getByRole('option', { name: 'Claude Code + Vertex AI' }));

  const gcloudCheckbox = screen.getByTestId('vertex-mount-gcloud');
  await fireEvent.click(gcloudCheckbox);

  const claudeConfigCheckbox = screen.getByTestId('vertex-mount-claude-config');
  await fireEvent.click(claudeConfigCheckbox);

  await waitFor(() => {
    expect(onboarding.vertexMountGcloud).toBe(false);
    expect(onboarding.vertexMountClaudeConfig).toBe(true);
  });
});
