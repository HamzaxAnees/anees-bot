import express from 'express';
import pino from 'pino';
import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';
import {
  makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  Browsers
} from '@whiskeysockets/baileys';
import { startBot } from './startBot.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

async function downloadSession(sessionUrl, outputPath) {
  const res = await axios.get(sessionUrl, { responseType: 'stream' });
  const writer = fs.createWriteStream(outputPath);
  res.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

(async () => {
  const sessionDir = './session';
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

  await downloadSession(process.env.SESSION_URL, `${sessionDir}/creds.json`);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const logger = pino({ level: 'silent' });

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    printQRInTerminal: false,
    browser: Browsers.macOS('Safari'),
    logger
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection }) => {
    if (connection === 'open') {
      console.log('✅ Connected to WhatsApp!');
      startBot(sock);
    }
  });
})();

app.get('/', (_, res) => res.send('✅ Bot is Running'));
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
