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

import type { IconDefinition } from '@fortawesome/fontawesome-common-types';
import { faRobot } from '@fortawesome/free-solid-svg-icons';
import type { Component } from 'svelte';

import CodingAgentStep from './CodingAgentStep.svelte';
import ModelStep from './ModelStep.svelte';

export type CliAgent = 'opencode' | 'claude' | 'claude-vertex' | 'cursor' | 'goose';

export interface VertexConfig {
  projectId: string;
  region: string;
  credentialsPath: string;
  mountClaudeConfig?: boolean;
}

export interface OnboardingModelSelection {
  providerId: string;
  label: string;
}

export interface OnboardingState {
  agent: CliAgent;
  model: OnboardingModelSelection | undefined;
  vertexConfig?: VertexConfig;
  /** Secret name created during Claude API key setup (e.g. 'anthropic'). */
  secretName?: string;
  beforeAdvance?: () => Promise<boolean>;
}

export interface GuidedSetupStepProps {
  stepId: string;
  title: string;
  description: string;
  onboarding: OnboardingState;
}

export interface GuidedSetupStep {
  id: string;
  title: string;
  description: string;
  icon: IconDefinition;
  component: Component<GuidedSetupStepProps>;
  isComplete: () => boolean;
  isSkippable: boolean;
}

export function createDefaultOnboardingState(): OnboardingState {
  return {
    agent: 'opencode',
    model: undefined,
  };
}

export const guidedSetupSteps: GuidedSetupStep[] = [
  {
    id: 'coding-agent',
    title: 'Coding agent',
    description:
      'Pick the default coding agent runtime. The API notes below update for your choice. You can change this later in settings.',
    icon: faRobot,
    component: CodingAgentStep,
    isComplete: (): boolean => false,
    isSkippable: true,
  },
  {
    id: 'model',
    title: 'Model',
    description: 'Select the default model for the chosen agent.',
    icon: faRobot,
    component: ModelStep,
    isComplete: (): boolean => false,
    isSkippable: true,
  },
];
