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
import * as os from 'node:os';
import * as path from 'node:path';

import { inject, injectable } from 'inversify';

import { IPCHandle } from '/@/plugin/api.js';
import type { VertexAiModelInfo, VertexAiModelListRequest } from '/@api/vertex-ai-info.js';

interface ApplicationDefaultCredentials {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  type: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface VertexModelResponse {
  publisherModels?: Array<{
    name: string;
    versionId?: string;
  }>;
}

@injectable()
export class VertexAiDiscovery {
  constructor(
    @inject(IPCHandle)
    private readonly ipcHandle: IPCHandle,
  ) {}

  async listModels(request: VertexAiModelListRequest): Promise<VertexAiModelInfo[]> {
    const credentials = await this.readCredentials(request.credentialsDir);
    const accessToken = await this.exchangeToken(credentials);
    return this.fetchModels(request.projectId, request.region, accessToken);
  }

  private async readCredentials(credentialsDir: string): Promise<ApplicationDefaultCredentials> {
    const resolvedDir = credentialsDir.replace(/^~/, os.homedir());
    const credFile = path.join(resolvedDir, 'application_default_credentials.json');
    const raw = await fs.readFile(credFile, 'utf-8');
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid credentials file format');
    }

    const creds = parsed as Record<string, unknown>;
    if (!creds['client_id'] || !creds['client_secret'] || !creds['refresh_token']) {
      throw new Error(
        'Credentials file is missing required fields. Run "gcloud auth application-default login" first.',
      );
    }

    return parsed as ApplicationDefaultCredentials;
  }

  private async exchangeToken(credentials: ApplicationDefaultCredentials): Promise<string> {
    const body = new URLSearchParams({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      refresh_token: credentials.refresh_token,
      grant_type: 'refresh_token',
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to exchange token: ${response.status} ${text}`);
    }

    const data = (await response.json()) as TokenResponse;
    return data.access_token;
  }

  private async fetchModels(projectId: string, region: string, accessToken: string): Promise<VertexAiModelInfo[]> {
    const url = `https://${region}-aiplatform.googleapis.com/v1beta1/publishers/anthropic/models`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-goog-user-project': projectId,
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to list Vertex AI models: ${response.status} ${text}`);
    }

    const data = (await response.json()) as VertexModelResponse;
    if (!data.publisherModels || !Array.isArray(data.publisherModels)) {
      return [];
    }

    return data.publisherModels.map(m => {
      const modelId = m.name.split('/').pop() ?? m.name;
      return {
        name: modelId,
        displayName: modelId,
      };
    });
  }

  init(): void {
    this.ipcHandle(
      'vertex-ai:list-models',
      async (_listener: unknown, request: VertexAiModelListRequest): Promise<VertexAiModelInfo[]> => {
        return this.listModels(request);
      },
    );
  }
}
