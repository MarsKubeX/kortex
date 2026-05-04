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
import type { Writable } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { providerInfos } from '/@/stores/providers';
import type { ProviderInfo } from '/@api/provider-info';

import type { OnboardingState } from './guided-setup-steps';
import ModelStep from './ModelStep.svelte';

vi.mock(import('/@/stores/providers'), async () => {
  const { writable } = await import('svelte/store');
  return {
    providerInfos: writable<ProviderInfo[]>([]),
    fetchProviders: vi.fn().mockResolvedValue([]),
  };
});

let onboarding: OnboardingState;

function setProviders(providers: Partial<ProviderInfo>[]): void {
  (providerInfos as Writable<ProviderInfo[]>).set(providers as ProviderInfo[]);
}

function ollamaProvider(...modelLabels: string[]): Partial<ProviderInfo> {
  return {
    id: 'ollama',
    name: 'Ollama',
    inferenceConnections: [
      {
        connectionType: 'inference',
        name: 'ollama',
        type: 'local',
        status: 'started',
        models: modelLabels.map(label => ({ label })),
      },
    ],
  };
}

function ramalamaProvider(...modelLabels: string[]): Partial<ProviderInfo> {
  return {
    id: 'ramalama',
    name: 'Ramalama',
    inferenceConnections: [
      {
        connectionType: 'inference',
        name: 'ramalama',
        type: 'local',
        status: 'started',
        models: modelLabels.map(label => ({ label })),
      },
    ],
  };
}

function openshiftAiProvider(...modelLabels: string[]): Partial<ProviderInfo> {
  return {
    id: 'openshiftai',
    name: 'OpenShift AI',
    inferenceConnections: [
      {
        connectionType: 'inference',
        name: 'https://my-cluster/v1',
        type: 'self-hosted',
        status: 'unknown',
        models: modelLabels.map(label => ({ label })),
      },
    ],
  };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.resetAllMocks();
  onboarding = { agent: 'opencode', model: undefined };
  setProviders([]);
  vi.stubGlobal('listVertexAiModels', vi.fn().mockResolvedValue([]));
});

function renderStep(overrides: Partial<OnboardingState> = {}): void {
  Object.assign(onboarding, overrides);
  render(ModelStep, {
    stepId: 'model',
    title: 'Model',
    description: 'Select the default model.',
    onboarding,
  });
}

describe('rendering', () => {
  test('renders the step title and description', () => {
    renderStep();

    expect(screen.getByText('Default model for the agent')).toBeInTheDocument();
    expect(screen.getByText(/will use by default in new workspaces/)).toBeInTheDocument();
  });

  test('renders the model card container', () => {
    renderStep();

    expect(screen.getByTestId('model-step-card')).toBeInTheDocument();
  });

  test('includes agent name in description', () => {
    renderStep();

    expect(screen.getByText(/OpenCode/)).toBeInTheDocument();
  });

  test('shows empty state when no models are available', () => {
    renderStep();

    expect(screen.getByTestId('model-step-empty')).toBeInTheDocument();
    expect(screen.getByText('No models found')).toBeInTheDocument();
  });
});

describe('local models', () => {
  test('shows local models section when Ollama models are available', () => {
    setProviders([ollamaProvider('qwen3-code', 'llama3.2:3b')]);

    renderStep();

    expect(screen.getByTestId('local-models-section')).toBeInTheDocument();
    expect(screen.getByText('qwen3-code')).toBeInTheDocument();
    expect(screen.getByText('llama3.2:3b')).toBeInTheDocument();
  });

  test('shows combined provider names in section header', () => {
    setProviders([ollamaProvider('model-a'), ramalamaProvider('model-b')]);

    renderStep();

    expect(screen.getByText(/Local · Ollama & Ramalama/)).toBeInTheDocument();
  });

  test('shows provider name and status in model subtitle', () => {
    setProviders([ollamaProvider('qwen3-code')]);

    renderStep();

    expect(screen.getByText(/Ollama · loaded in memory/)).toBeInTheDocument();
  });

  test('auto-selects the first model', async () => {
    setProviders([ollamaProvider('qwen3-code', 'llama3.2:3b')]);

    renderStep();

    await waitFor(() => {
      expect(screen.getByTestId('selected-model')).toHaveTextContent('Selected: qwen3-code');
    });
  });

  test('updates onboarding.model when auto-selecting', async () => {
    setProviders([ollamaProvider('qwen3-code')]);

    renderStep();

    await waitFor(() => {
      expect(onboarding.model).toEqual(expect.objectContaining({ providerId: 'ollama', label: 'qwen3-code' }));
    });
  });
});

describe('model selection', () => {
  test('clicking a model row selects it', async () => {
    setProviders([ollamaProvider('qwen3-code', 'llama3.2:3b')]);

    renderStep();

    const row = screen.getByTestId('model-row-llama3.2:3b');
    await fireEvent.click(row);

    await waitFor(() => {
      expect(screen.getByTestId('selected-model')).toHaveTextContent('Selected: llama3.2:3b');
    });
  });

  test('updates onboarding.model when a model is clicked', async () => {
    setProviders([ollamaProvider('qwen3-code', 'llama3.2:3b')]);

    renderStep();

    const row = screen.getByTestId('model-row-llama3.2:3b');
    await fireEvent.click(row);

    await waitFor(() => {
      expect(onboarding.model).toEqual(expect.objectContaining({ providerId: 'ollama', label: 'llama3.2:3b' }));
    });
  });

  test('radio input is checked for selected model', async () => {
    setProviders([ollamaProvider('qwen3-code', 'llama3.2:3b')]);

    renderStep();

    await waitFor(() => {
      const selectedRadio = screen.getByRole('radio', { name: 'Use qwen3-code' });
      expect(selectedRadio).toBeChecked();
    });

    const unselectedRadio = screen.getByRole('radio', { name: 'Use llama3.2:3b' });
    expect(unselectedRadio).not.toBeChecked();
  });

  test('restores previous selection when re-mounting', async () => {
    setProviders([ollamaProvider('qwen3-code', 'llama3.2:3b')]);

    renderStep({ model: { providerId: 'ollama', label: 'llama3.2:3b' } });

    await waitFor(() => {
      expect(screen.getByTestId('selected-model')).toHaveTextContent('Selected: llama3.2:3b');
    });
  });
});

describe('self-hosted models', () => {
  test('shows In-house section when OpenShift AI models are available', () => {
    setProviders([openshiftAiProvider('ibm-granite-3.3-8b-instruct')]);

    renderStep();

    expect(screen.getByTestId('self-hosted-models-section')).toBeInTheDocument();
    expect(screen.getByText('ibm-granite-3.3-8b-instruct')).toBeInTheDocument();
  });

  test('shows OpenShift AI in section header', () => {
    setProviders([openshiftAiProvider('my-model')]);

    renderStep();

    expect(screen.getByText(/In-house · OpenShift AI/)).toBeInTheDocument();
  });

  test('can select self-hosted models', async () => {
    setProviders([ollamaProvider('qwen3-code'), openshiftAiProvider('granite-model')]);

    renderStep();

    const row = screen.getByTestId('model-row-granite-model');
    await fireEvent.click(row);

    await waitFor(() => {
      expect(onboarding.model).toEqual(expect.objectContaining({ providerId: 'openshiftai', label: 'granite-model' }));
    });
  });
});

describe('mixed providers', () => {
  test('shows both local and self-hosted sections', () => {
    setProviders([ollamaProvider('qwen3-code'), openshiftAiProvider('granite-model')]);

    renderStep();

    expect(screen.getByTestId('local-models-section')).toBeInTheDocument();
    expect(screen.getByTestId('self-hosted-models-section')).toBeInTheDocument();
  });

  test('does not show empty state when models exist', () => {
    setProviders([ollamaProvider('qwen3-code')]);

    renderStep();

    expect(screen.queryByTestId('model-step-empty')).not.toBeInTheDocument();
  });
});

describe('agent filtering', () => {
  test('filters models by agent provider mapping', () => {
    setProviders([
      ollamaProvider('local-model'),
      {
        id: 'claude',
        name: 'Claude',
        inferenceConnections: [
          {
            connectionType: 'inference',
            name: 'claude',
            type: 'cloud',
            status: 'started',
            models: [{ label: 'claude-sonnet-4-20250514' }],
          },
        ],
      } as unknown as ProviderInfo,
    ]);

    renderStep({ agent: 'opencode' });

    expect(screen.getByText('local-model')).toBeInTheDocument();
    expect(screen.queryByText('claude-sonnet-4-20250514')).not.toBeInTheDocument();
  });

  test('shows claude models when agent is claude', () => {
    setProviders([
      ollamaProvider('local-model'),
      {
        id: 'claude',
        name: 'Claude',
        inferenceConnections: [
          {
            connectionType: 'inference',
            name: 'claude',
            type: 'cloud',
            status: 'started',
            models: [{ label: 'claude-sonnet-4-20250514' }],
          },
        ],
      } as unknown as ProviderInfo,
    ]);

    renderStep({ agent: 'claude' });

    expect(screen.queryByText('local-model')).not.toBeInTheDocument();
    expect(screen.getByText('claude-sonnet-4-20250514')).toBeInTheDocument();
  });
});

describe('vertex AI models', () => {
  test('fetches models from Vertex AI when agent is claude-vertex', async () => {
    vi.mocked(window.listVertexAiModels).mockResolvedValue([
      { name: 'claude-sonnet-4-20250514', displayName: 'claude-sonnet-4-20250514' },
      { name: 'claude-3-5-haiku-20241022', displayName: 'claude-3-5-haiku-20241022' },
    ]);

    renderStep({
      agent: 'claude-vertex',
      vertexConfig: { projectId: 'my-proj', region: 'us-east5', credentialsPath: '/gcloud' },
    });

    await waitFor(() => {
      expect(screen.getByText('claude-sonnet-4-20250514')).toBeInTheDocument();
      expect(screen.getByText('claude-3-5-haiku-20241022')).toBeInTheDocument();
    });

    expect(window.listVertexAiModels).toHaveBeenCalledWith({
      projectId: 'my-proj',
      region: 'us-east5',
      credentialsPath: '/gcloud',
    });
  });

  test('shows loading state while fetching vertex models', async () => {
    let resolveModels: (v: unknown) => void;
    const pending = new Promise(resolve => {
      resolveModels = resolve;
    });
    vi.mocked(window.listVertexAiModels).mockReturnValue(pending as ReturnType<typeof window.listVertexAiModels>);

    renderStep({
      agent: 'claude-vertex',
      vertexConfig: { projectId: 'p', region: 'r', credentialsPath: '/c' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('vertex-loading')).toBeInTheDocument();
    });
    expect(screen.getByText(/Fetching models from Vertex AI/)).toBeInTheDocument();

    resolveModels!([]);
  });

  test('shows error state when vertex fetch fails', async () => {
    vi.mocked(window.listVertexAiModels).mockRejectedValue(new Error('permission denied'));

    renderStep({
      agent: 'claude-vertex',
      vertexConfig: { projectId: 'p', region: 'r', credentialsPath: '/c' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('vertex-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Failed to fetch Vertex AI models')).toBeInTheDocument();
    expect(screen.getByText('permission denied')).toBeInTheDocument();
  });

  test('shows empty state when vertex returns no models', async () => {
    vi.mocked(window.listVertexAiModels).mockResolvedValue([]);

    renderStep({
      agent: 'claude-vertex',
      vertexConfig: { projectId: 'p', region: 'r', credentialsPath: '/c' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('model-step-empty')).toBeInTheDocument();
    });
    expect(screen.getByText(/valid credentials/)).toBeInTheDocument();
  });

  test('does not fetch vertex models when config is incomplete', () => {
    renderStep({
      agent: 'claude-vertex',
      vertexConfig: { projectId: '', region: 'us-east5', credentialsPath: '/c' },
    });

    expect(window.listVertexAiModels).not.toHaveBeenCalled();
  });

  test('auto-selects first vertex model', async () => {
    vi.mocked(window.listVertexAiModels).mockResolvedValue([
      { name: 'claude-sonnet-4-20250514', displayName: 'claude-sonnet-4-20250514' },
    ]);

    renderStep({
      agent: 'claude-vertex',
      vertexConfig: { projectId: 'p', region: 'r', credentialsPath: '/c' },
    });

    await waitFor(() => {
      expect(onboarding.model).toEqual(
        expect.objectContaining({ providerId: 'claude', label: 'claude-sonnet-4-20250514' }),
      );
    });
  });
});
