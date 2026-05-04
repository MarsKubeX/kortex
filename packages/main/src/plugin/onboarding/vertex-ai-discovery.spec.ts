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

import * as fs from 'node:fs/promises';

import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { IPCHandle } from '/@/plugin/api.js';

import { VertexAiDiscovery } from './vertex-ai-discovery.js';

vi.mock(import('node:fs/promises'));

const ipcHandle: IPCHandle = vi.fn();

let discovery: VertexAiDiscovery;

const validCredentials = JSON.stringify({
  client_id: 'test-client-id',
  client_secret: 'test-client-secret',
  refresh_token: 'test-refresh-token',
  type: 'authorized_user',
});

beforeEach(() => {
  vi.resetAllMocks();
  discovery = new VertexAiDiscovery(ipcHandle);
});

describe('init', () => {
  test('registers vertex-ai:list-models IPC handler', () => {
    discovery.init();

    expect(ipcHandle).toHaveBeenCalledWith('vertex-ai:list-models', expect.any(Function));
  });
});

describe('listModels', () => {
  test('reads credentials, exchanges token, and fetches models', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(validCredentials);

    const tokenResponse = { access_token: 'test-access-token', expires_in: 3600, token_type: 'Bearer' };
    const modelsResponse = {
      publisherModels: [
        { name: 'publishers/anthropic/models/claude-sonnet-4-20250514' },
        { name: 'publishers/anthropic/models/claude-3-5-haiku-20241022' },
      ],
    };

    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(tokenResponse) });
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(modelsResponse) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await discovery.listModels({
      projectId: 'my-project',
      region: 'us-east5',
      credentialsDir: '/home/user/.config/gcloud',
    });

    expect(result).toEqual([
      { name: 'claude-sonnet-4-20250514', displayName: 'claude-sonnet-4-20250514' },
      { name: 'claude-3-5-haiku-20241022', displayName: 'claude-3-5-haiku-20241022' },
    ]);

    expect(fs.readFile).toHaveBeenCalledWith('/home/user/.config/gcloud/application_default_credentials.json', 'utf-8');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://us-east5-aiplatform.googleapis.com/v1beta1/publishers/anthropic/models',
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-access-token', 'x-goog-user-project': 'my-project' },
      }),
    );
  });

  test('expands tilde in credentials path', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(validCredentials);

    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'tok', expires_in: 3600, token_type: 'Bearer' }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ publisherModels: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const origHome = process.env['HOME'];
    process.env['HOME'] = '/home/testuser';

    try {
      await discovery.listModels({
        projectId: 'p',
        region: 'r',
        credentialsDir: '~/.config/gcloud',
      });

      expect(fs.readFile).toHaveBeenCalledWith(
        '/home/testuser/.config/gcloud/application_default_credentials.json',
        'utf-8',
      );
    } finally {
      if (origHome === undefined) {
        delete process.env['HOME'];
      } else {
        process.env['HOME'] = origHome;
      }
    }
  });

  test('throws on missing credential fields', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ client_id: 'only-id' }));

    await expect(discovery.listModels({ projectId: 'p', region: 'r', credentialsDir: '/path' })).rejects.toThrow(
      /missing required fields/,
    );
  });

  test('throws on token exchange failure', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(validCredentials);

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('invalid_grant'),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(discovery.listModels({ projectId: 'p', region: 'r', credentialsDir: '/path' })).rejects.toThrow(
      /Failed to exchange token: 401/,
    );
  });

  test('throws on model listing failure', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(validCredentials);

    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'tok', expires_in: 3600, token_type: 'Bearer' }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: () => Promise.resolve('permission denied'),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(discovery.listModels({ projectId: 'p', region: 'r', credentialsDir: '/path' })).rejects.toThrow(
      /Failed to list Vertex AI models: 403/,
    );
  });

  test('returns empty array when no publisherModels in response', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(validCredentials);

    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'tok', expires_in: 3600, token_type: 'Bearer' }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await discovery.listModels({ projectId: 'p', region: 'r', credentialsDir: '/path' });
    expect(result).toEqual([]);
  });
});
