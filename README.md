# Discord → Fluxer Bridge

Copia o histórico de um canal do Discord (mensagens, autor e imagens) para um
arquivo JSON, e depois reenvia tudo em um canal do Fluxer, mantendo o nome e
avatar de quem enviou originalmente (via Webhook).

## Como funciona

1. **`discord-export.js`** entra no Discord com um bot, lê **todo** o
   histórico do canal informado, baixa os anexos/imagens para
   `exported/images/` e salva tudo em `exported/messages.json`.
2. **`fluxer-import.js`** lê esse `messages.json` e reenvia cada mensagem no
   canal do Fluxer usando um Webhook, na ordem cronológica original.

## 1. Instalar dependências

```bash
npm install
```

## 2. Configurar credenciais

Copie `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

- `DISCORD_BOT_TOKEN`: token do bot no [Discord Developer Portal](https://discord.com/developers/applications).
  - Precisa da permissão **Read Message History** e do **Message Content Intent**
    ativado (aba "Bot" → "Privileged Gateway Intents").
  - O bot precisa estar no servidor e ter acesso ao canal.
- `DISCORD_CHANNEL_ID`: ID do canal a copiar (ative o "Modo Desenvolvedor" no
  Discord, clique com botão direito no canal → Copiar ID).
- `FLUXER_BOT_TOKEN`: token do bot no Fluxer.
- `FLUXER_CHANNEL_ID`: ID do canal de destino no Fluxer.
  - O bot precisa da permissão de **Manage Webhooks** nesse canal.

## 3. Rodar a exportação (Discord → JSON)

```bash
npm run export
```

Isso cria `exported/messages.json` e baixa as imagens em `exported/images/`.
Dá pra abrir o JSON e conferir antes de reenviar.

## 4. Rodar a importação (JSON → Fluxer)

```bash
npm run import
```

Isso cria (ou reaproveita) um webhook chamado "Discord Import" no canal do
Fluxer e reenvia as mensagens uma a uma, respeitando um intervalo entre elas
para não tomar rate limit.

## Observações importantes

- **Baixamos as imagens localmente** de propósito: os links de anexos do
  Discord (`cdn.discordapp.com`) têm um parâmetro de expiração e podem parar
  de funcionar depois de um tempo. Reenviar o arquivo local garante que a
  imagem chegue certinho no Fluxer.
- O script atual roda **uma vez** (exporta o histórico existente). Se no
  futuro você quiser espelhar mensagens novas em tempo real, dá pra adaptar
  o `discord-export.js` para ficar escutando o evento `messageCreate` em vez
  de só buscar o histórico.
- Ajuste `DELAY_MS` em `fluxer-import.js` se tomar rate limit do Fluxer
  (aumente o valor) ou se quiser ir mais rápido (diminua, com cuidado).
- Nunca compartilhe seu `.env` nem os tokens — qualquer pessoa com o token
  do bot consegue controlá-lo.
