// fluxer-import.js
// Lê ./exported/messages.json (gerado pelo discord-export.js) e reenvia
// cada mensagem no canal do Fluxer, usando um Webhook para mostrar o
// nome e avatar de quem enviou originalmente no Discord.
// Rodar: node fluxer-import.js

import 'dotenv/config';
import { Client, Webhook } from '@fluxerjs/core';
import fs from 'node:fs/promises';
import path from 'node:path';

const FLUXER_TOKEN = process.env.FLUXER_BOT_TOKEN;
const FLUXER_CHANNEL_ID = process.env.FLUXER_CHANNEL_ID;

if (!FLUXER_TOKEN || !FLUXER_CHANNEL_ID) {
  console.error('Defina FLUXER_BOT_TOKEN e FLUXER_CHANNEL_ID no .env');
  process.exit(1);
}

const OUT_DIR = path.resolve('./exported');
const IN_FILE = path.join(OUT_DIR, 'messages.json');

// Delay entre mensagens para não tomar rate limit (ajuste se precisar)
const DELAY_MS = 1200;
const WEBHOOK_NAME = 'Discord Import';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getOrCreateWebhook(client, channel) {
  const existing = await channel.fetchWebhooks();
  const found = existing.find((w) => w.name === WEBHOOK_NAME);
  if (found?.token) return found;

  // fetchWebhooks costuma não trazer o token de volta, então se já existe
  // um webhook com esse nome mas sem token, criamos um novo mesmo assim.
  console.log('Criando novo webhook no canal do Fluxer...');
  return channel.createWebhook({ name: WEBHOOK_NAME });
}

async function main() {
  const raw = await fs.readFile(IN_FILE, 'utf-8');
  const messages = JSON.parse(raw);

  console.log(`${messages.length} mensagens para reenviar.`);

  const client = new Client();
  await client.login(FLUXER_TOKEN);

  const channel = await client.channels.fetch(FLUXER_CHANNEL_ID);
  if (!channel?.createWebhook) {
    throw new Error('Canal do Fluxer não encontrado ou não suporta webhooks.');
  }

  const webhookMeta = await getOrCreateWebhook(client, channel);
  const webhook = Webhook.fromToken(client, webhookMeta.id, webhookMeta.token);

  let sent = 0;
  for (const msg of messages) {
    const payload = {
      username: msg.author.displayName || msg.author.username,
      avatarUrl: msg.author.avatarUrl,
    };

    if (msg.content?.trim()) {
      payload.content = msg.content;
    }

    if (msg.attachments?.length) {
      payload.files = [];
      for (const att of msg.attachments) {
        try {
          const filePath = path.join(OUT_DIR, att.localPath);
          const data = await fs.readFile(filePath);
          payload.files.push({ name: att.name, data });
        } catch (err) {
          console.warn(`  aviso: não achei o arquivo local de "${att.name}" (${msg.id}):`, err.message);
        }
      }
    }

    // Fluxer, assim como Discord, geralmente exige content OU files
    if (!payload.content && (!payload.files || payload.files.length === 0)) {
      payload.content = '(mensagem vazia)';
    }

    try {
      await webhook.send(payload);
      sent++;
      process.stdout.write(`\r  ${sent}/${messages.length} reenviadas...`);
    } catch (err) {
      console.error(`\nErro ao reenviar mensagem ${msg.id}:`, err.message);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nConcluído. ${sent}/${messages.length} mensagens reenviadas.`);
  client.destroy?.();
  process.exit(0);
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
