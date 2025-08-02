import { Boom } from '@hapi/boom';

export async function startBot(sock) {
sock.ev.on('messages.upsert', async ({ messages }) => {
  const m = messages[0];
  if (!m.message || m.key.fromMe) return;

  await sock.sendMessage(m.key.remoteJid, { text: '✅ Bot is active!' });

  // Command Handling
  const body = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
  if (body.startsWith('.')) {
    const args = body.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const text = args.join(' ');

    switch (command) {
      case 'antilink': {
        if (!m.key.remoteJid.endsWith('@g.us')) {
          await sock.sendMessage(m.chat, { text: '❌ This command only works in group chats.' });
          return;
        }

        const setting = text.toLowerCase();
        if (!['on', 'off'].includes(setting)) {
          await sock.sendMessage(m.chat, { text: 'Usage: .antilink on/off' });
          return;
        }

        if (!global.antiLink) global.antiLink = {};
        if (setting === 'on') {
          global.antiLink[m.key.remoteJid] = true;
          await sock.sendMessage(m.chat, { text: '✅ Antilink is now *enabled* in this group.' });
        } else {
          delete global.antiLink[m.key.remoteJid];
          await sock.sendMessage(m.chat, { text: '❌ Antilink is now *disabled* in this group.' });
        }

        return;
      }
    }
  }

  // Antilink Filter
  if (m.isGroup && global.antiLink && global.antiLink[m.chat]) {
    const linkRegex = /(https?:\/\/)?(www\.)?(t\.me|wa\.me|chat\.whatsapp\.com|discord\.gg|facebook\.com|instagram\.com|youtu\.be|youtube\.com|http|https)\S+/gi;

    if (linkRegex.test(m.body)) {
      const metadata = await sock.groupMetadata(m.chat);
      const admins = metadata.participants.filter(p => p.admin).map(p => p.id);
      if (admins.includes(m.sender)) return;

      await sock.sendMessage(m.chat, {
        delete: {
          remoteJid: m.chat,
          fromMe: false,
          id: m.key.id,
          participant: m.key.participant
        }
      });

      await sock.sendMessage(m.chat, { text: `🚫 Link deleted! Antilink is active.` });
    }
  }
});

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error = Boom)?.output?.statusCode !== 401;
      if (shouldReconnect) {
        console.log('🔄 Reconnecting...');
        startBot(sock);
      } else {
        console.log('❌ Connection closed. Not reconnecting.');
      }
    }
  });

  console.log('🤖 Bot Started');
}
