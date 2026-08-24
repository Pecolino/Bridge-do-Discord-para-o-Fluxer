// discord-export.js
// Lê TODO o histórico de um canal do Discord e salva em ./exported/messages.json
// Também baixa as imagens/anexos para ./exported/images, porque os links do
// CDN do Discord (cdn.discordapp.com) expiram (têm um parâmetro "ex=" de validade).
// Rodar: node discord-export.js

import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

if (!TOKEN || !CHANNEL_ID) {
  console.error('Defina DISCORD_BOT_TOKEN e DISCORD_CHANNEL_ID no .env');
  process.exit(1);
}

const OUT_DIR = path.resolve('./exported');
const IMAGES_DIR = path.join(OUT_DIR, 'images');
const OUT_FILE = path.join(OUT_DIR, 'messages.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

async function downloadAttachment(url, filename) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar ${url}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const filePath = path.join(IMAGES_DIR, filename);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function main() {
  await fs.mkdir(IMAGES_DIR, { recursive: true });

  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel || !channel.isTextBased()) {
    throw new Error('Canal não encontrado ou não é um canal de texto.');
  }

  console.log(`Exportando mensagens de #${channel.name ?? channel.id}...`);

  const allMessages = [];
  let lastId = undefined;
  let batchCount = 0;

  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const batch = await channel.messages.fetch(options);
    if (batch.size === 0) break;

    for (const msg of batch.values()) {
      const attachments = [];

      for (const att of msg.attachments.values()) {
        const safeName = `${msg.id}_${att.name}`.replace(/[^\w.\-]/g, '_');
        try {
          const localPath = await downloadAttachment(att.url, safeName);
          attachments.push({
            name: att.name,
            contentType: att.contentType ?? null,
            originalUrl: att.url,
            localPath: path.relative(OUT_DIR, localPath),
          });
        } catch (err) {
          console.warn(`  aviso: não consegui baixar anexo de ${msg.id}:`, err.message);
        }
      }

      allMessages.push({
        id: msg.id,
        timestamp: msg.createdAt.toISOString(),
        author: {
          id: msg.author.id,
          username: msg.author.username,
          displayName: msg.member?.displayName ?? msg.author.globalName ?? msg.author.username,
          avatarUrl: msg.author.displayAvatarURL({ extension: 'png', size: 256 }),
        },
        content: msg.content,
        attachments,
      });
    }

    batchCount += batch.size;
    lastId = batch.last().id;
    process.stdout.write(`\r  ${batchCount} mensagens coletadas...`);
  }

  console.log(`\nTotal: ${allMessages.length} mensagens.`);

  // Ordena da mais antiga para a mais nova (importante para reenviar na ordem certa depois)
  allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  await fs.writeFile(OUT_FILE, JSON.stringify(allMessages, null, 2), 'utf-8');
  console.log(`Salvo em ${OUT_FILE}`);
}

client.once('ready', async () => {
  try {
    await main();
  } catch (err) {
    console.error('Erro durante a exportação:', err);
  } finally {
    client.destroy();
    process.exit(0);
  }
});

client.login(TOKEN);
