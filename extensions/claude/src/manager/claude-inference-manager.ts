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

import { createHash } from 'node:crypto';

import { createAnthropic } from '@ai-sdk/anthropic';
import AnthropicClient from '@anthropic-ai/sdk';
import type { Disposable, InferenceModel, Provider, ProviderConnectionStatus, SecretStorage } from '@openkaiden/api';
import { inject, injectable } from 'inversify';

import { ClaudeProviderSymbol, SecretStorageSymbol } from '/@/inject/symbol';

export const TOKENS_KEY = 'claude:tokens';
export const CONNECTION_INFOS_KEY = 'claude:infos';
export const TOKEN_SEPARATOR = ',';
const INFO_SEPARATOR = '|';

const DEFAULT_BASE_URL = 'https://api.anthropic.com';

interface ConnectionInfo {
  apiKey: string;
  baseURL: string;
}

@injectable()
export class ClaudeInferenceManager {
  @inject(ClaudeProviderSymbol)
  private claudeProvider: Provider;

  @inject(SecretStorageSymbol)
  private secrets: SecretStorage;

  private connections: Map<string, Disposable> = new Map();

  async init(): Promise<void> {
    this.claudeProvider.setInferenceProviderConnectionFactory({
      connectionTypes: ['cloud'],
      create: this.factory.bind(this),
    });
    await this.restoreConnections();
  }

  private async restoreConnections(): Promise<void> {
    const connectionInfos = await this.getConnectionInfos();
    for (const info of connectionInfos) {
      try {
        await this.registerInferenceProviderConnection({ token: info.apiKey, baseURL: info.baseURL });
      } catch (err: unknown) {
        console.error(`Claude: failed to restore connection for baseURL ${info.baseURL}`, err);
      }
    }
  }

  /**
   * Reads connection infos from the new `claude:infos` key.
   * Falls back to the legacy `claude:tokens` key (API-key-only entries default to the Anthropic API).
   */
  private async getConnectionInfos(): Promise<ConnectionInfo[]> {
    let raw: string | undefined;
    try {
      raw = await this.secrets.get(CONNECTION_INFOS_KEY);
    } catch (err: unknown) {
      console.error('Claude: something went wrong while trying to get connection infos from secret storage', err);
    }

    if (raw) {
      return raw.split(TOKEN_SEPARATOR).map(entry => {
        const [apiKey, baseURL] = entry.split(INFO_SEPARATOR);
        return { apiKey, baseURL: baseURL || DEFAULT_BASE_URL };
      });
    }

    // Migrate legacy token-only storage
    try {
      raw = await this.secrets.get(TOKENS_KEY);
    } catch (err: unknown) {
      console.error('Claude: something went wrong while trying to get tokens from secret storage', err);
    }
    if (!raw) return [];

    const infos = raw.split(TOKEN_SEPARATOR).map(apiKey => ({ apiKey, baseURL: DEFAULT_BASE_URL }));
    // Persist in the new format and clean up legacy key
    await this.saveConnectionInfos(infos);
    await this.secrets.delete(TOKENS_KEY);
    return infos;
  }

  private async saveConnectionInfos(infos: ConnectionInfo[]): Promise<void> {
    const raw = infos.map(i => `${i.apiKey}${INFO_SEPARATOR}${i.baseURL}`).join(TOKEN_SEPARATOR);
    await this.secrets.store(CONNECTION_INFOS_KEY, raw);
  }

  private async saveConnectionInfo(apiKey: string, baseURL: string): Promise<void> {
    const existing = await this.getConnectionInfos();
    await this.saveConnectionInfos([...existing, { apiKey, baseURL }]);
  }

  private getTokenHash(token: string): string {
    const sha256 = createHash('sha256');
    return sha256.update(token).digest('hex');
  }

  private async removeConnectionInfo(apiKey: string, baseURL: string): Promise<void> {
    const infos = await this.getConnectionInfos();
    const filtered = infos.filter(i => i.apiKey !== apiKey || i.baseURL !== baseURL);
    await this.saveConnectionInfos(filtered);
  }

  private async registerInferenceProviderConnection({
    token,
    baseURL,
  }: {
    token: string;
    baseURL: string;
  }): Promise<void> {
    const tokenHash = this.getTokenHash(token);

    if (this.connections.has(tokenHash)) {
      throw new Error(`connection already exists for token ${this.maskKey(token)}`);
    }

    const isCustomBaseURL = baseURL !== DEFAULT_BASE_URL;

    const anthropic = createAnthropic({
      apiKey: token,
      ...(isCustomBaseURL && { baseURL }),
    });

    const clean = async (): Promise<void> => {
      this.connections.get(tokenHash)?.dispose();
      this.connections.delete(tokenHash);
      await this.removeConnectionInfo(token, baseURL);
    };

    let status: ProviderConnectionStatus = 'unknown';
    let models: InferenceModel[] = [];

    try {
      models = await this.getAnthropicModels(token, baseURL);
    } catch (err: unknown) {
      status = 'stopped';
    }

    const connectionName = isCustomBaseURL ? baseURL : this.maskKey(token);

    const connectionDisposable = this.claudeProvider.registerInferenceProviderConnection({
      name: connectionName,
      type: isCustomBaseURL ? 'self-hosted' : 'cloud',
      llmMetadata: {
        name: 'anthropic',
      },
      ...(isCustomBaseURL && { endpoint: baseURL }),
      sdk: anthropic,
      status(): ProviderConnectionStatus {
        return status;
      },
      lifecycle: {
        delete: clean.bind(this),
      },
      models,
      credentials(): Record<string, string> {
        return {
          [TOKENS_KEY]: token,
        };
      },
    });
    this.connections.set(tokenHash, connectionDisposable);
  }

  private async getAnthropicModels(token: string, baseURL: string): Promise<Array<{ label: string }>> {
    const isCustomBaseURL = baseURL !== DEFAULT_BASE_URL;
    const client = new AnthropicClient({
      apiKey: token,
      ...(isCustomBaseURL && { baseURL }),
    });
    const models: InferenceModel[] = [];
    for await (const model of client.models.list()) {
      if (model.id) {
        models.push({ label: model.id });
      }
    }
    return models;
  }

  private maskKey(name: string): string {
    if (!name || name.length <= 3) return name;
    return name.slice(0, 3) + '*'.repeat(name.length - 3);
  }

  private async factory(params: { [p: string]: unknown }): Promise<void> {
    const apiKey = params['claude.factory.apiKey'];
    if (!apiKey || typeof apiKey !== 'string') throw new Error('invalid apiKey');

    const rawBaseURL = params['claude.factory.baseURL'];
    const baseURL = typeof rawBaseURL === 'string' && rawBaseURL.trim() ? rawBaseURL.trim() : DEFAULT_BASE_URL;

    await this.saveConnectionInfo(apiKey, baseURL);
    await this.registerInferenceProviderConnection({ token: apiKey, baseURL });
  }

  dispose(): void {
    this.connections.forEach(disposable => disposable.dispose());
    this.connections.clear();
  }
}
