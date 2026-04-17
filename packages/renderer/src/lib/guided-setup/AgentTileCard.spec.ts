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

import { faCloud, faDesktop } from '@fortawesome/free-solid-svg-icons';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, expect, test, vi } from 'vitest';

import AgentTileCard from './AgentTileCard.svelte';
import type { AgentTileData } from './guided-setup-steps';

const baseAgent: AgentTileData = {
  key: 'opencode',
  cliAgent: 'opencode',
  title: 'OpenCode',
  description: 'An open-source agent.',
  icon: faDesktop,
  iconBgClass: 'bg-gray-700',
  recommended: false,
};

beforeEach(() => {
  vi.resetAllMocks();
});

test('renders title and description', () => {
  render(AgentTileCard, { agent: baseAgent, selected: false });

  expect(screen.getByText('OpenCode')).toBeInTheDocument();
  expect(screen.getByText('An open-source agent.')).toBeInTheDocument();
});

test('has correct aria-label from title', () => {
  render(AgentTileCard, { agent: baseAgent, selected: false });

  expect(screen.getByRole('option', { name: 'OpenCode' })).toBeInTheDocument();
});

test('shows aria-selected true when selected', () => {
  render(AgentTileCard, { agent: baseAgent, selected: true });

  expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'true');
});

test('shows aria-selected false when not selected', () => {
  render(AgentTileCard, { agent: baseAgent, selected: false });

  expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'false');
});

test('shows Recommended badge when agent is recommended', () => {
  const recommended = { ...baseAgent, recommended: true };
  render(AgentTileCard, { agent: recommended, selected: false });

  expect(screen.getByText('Recommended')).toBeInTheDocument();
});

test('does not show Recommended badge when agent is not recommended', () => {
  render(AgentTileCard, { agent: baseAgent, selected: false });

  expect(screen.queryByText('Recommended')).not.toBeInTheDocument();
});

test('calls onclick when clicked', async () => {
  const clickHandler = vi.fn();
  render(AgentTileCard, { agent: baseAgent, selected: false, onclick: clickHandler });

  await fireEvent.click(screen.getByRole('option'));

  expect(clickHandler).toHaveBeenCalledOnce();
});

test('renders without onclick handler', () => {
  render(AgentTileCard, { agent: baseAgent, selected: false });

  expect(screen.getByRole('option')).toBeInTheDocument();
});

test('applies selected border class when selected', () => {
  render(AgentTileCard, { agent: baseAgent, selected: true });

  const tile = screen.getByRole('option');
  expect(tile.className).toContain('border-(--pd-content-card-border-selected)');
});

test('applies unselected border class when not selected', () => {
  render(AgentTileCard, { agent: baseAgent, selected: false });

  const tile = screen.getByRole('option');
  expect(tile.className).toContain('border-(--pd-content-card-border)');
});

test('renders with different agent data', () => {
  const vertexAgent: AgentTileData = {
    key: 'claude-vertex',
    cliAgent: 'claude',
    title: 'Claude Code + Vertex AI',
    description: 'Claude with Vertex.',
    icon: faCloud,
    iconBgClass: 'bg-blue-900/30',
    recommended: false,
  };
  render(AgentTileCard, { agent: vertexAgent, selected: false });

  expect(screen.getByText('Claude Code + Vertex AI')).toBeInTheDocument();
  expect(screen.getByText('Claude with Vertex.')).toBeInTheDocument();
});
