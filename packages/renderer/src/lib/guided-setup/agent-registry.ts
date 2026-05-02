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
import { faClaude, faGoogle } from '@fortawesome/free-brands-svg-icons';
import { faDesktop, faRobot } from '@fortawesome/free-solid-svg-icons';
import type { Component } from 'svelte';

import type { CliAgent } from './guided-setup-steps';
import ClaudePanel from './panels/ClaudePanel.svelte';
import ClaudeVertexPanel from './panels/ClaudeVertexPanel.svelte';
import OpenCodePanel from './panels/OpenCodePanel.svelte';

export interface AgentDefinition {
  cliName: CliAgent;
  /**
   * The CLI agent name used for filtering against `kdn info` output.
   * Allows UI variants (e.g. `claude-vertex`) to match their parent CLI agent (`claude`).
   * Falls back to {@link cliName} when omitted.
   */
  cliAgent?: string;
  title: string;
  icon: IconDefinition;
  colorClass: string;
  description?: string;
  badge?: string;
  panel?: Component;
  /** Compound selector in the form `extensionId:providerId` (e.g. `kaiden.claude:claude`). */
  providerSelector?: string;
  secretType?: string;
}

const DEFAULT_DEFINITION: Omit<AgentDefinition, 'cliName' | 'title'> = {
  icon: faRobot,
  colorClass: 'bg-gradient-to-br from-purple-500 to-purple-600',
};

export const agentDefinitions: AgentDefinition[] = [
  {
    cliName: 'opencode',
    title: 'OpenCode',
    icon: faDesktop,
    colorClass: 'bg-gradient-to-br from-green-500 to-green-600',
    description:
      'Open-source agent on your machine - local models via Ollama or Ramalama, or cloud APIs (OpenAI, Gemini, and other providers OpenCode supports).',
    badge: 'Recommended',
    panel: OpenCodePanel,
  },
  {
    cliName: 'claude',
    title: 'Claude Code',
    description: 'Anthropic\u2019s cloud agent \u2014 connect with an API key to access Claude models.',
    badge: 'Cloud',
    icon: faClaude,
    colorClass: 'bg-gradient-to-br from-amber-600 to-amber-500',
    panel: ClaudePanel,
    providerSelector: 'kaiden.claude:claude',
    secretType: 'anthropic',
  },
  {
    cliName: 'claude-vertex',
    cliAgent: 'claude',
    title: 'Claude on Vertex AI',
    description: 'Run Claude Code through Google Cloud Vertex AI using your GCP project credentials.',
    badge: 'Vertex AI',
    icon: faGoogle,
    colorClass: 'bg-gradient-to-br from-blue-500 to-blue-600',
    panel: ClaudeVertexPanel,
  },
];

export type ResolvedAgentDefinition = Omit<AgentDefinition, 'cliName'> & { cliName: string };

const agentMap = new Map<string, AgentDefinition>(agentDefinitions.map(d => [d.cliName, d]));

export function getAgentDefinition(name: string): ResolvedAgentDefinition {
  return agentMap.get(name) ?? { ...DEFAULT_DEFINITION, cliName: name, title: name };
}
