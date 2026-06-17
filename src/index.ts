import { Telegraf } from 'telegraf';
import { config } from './config';
import { closeDb, getUsersCount, initDb } from './db';
import { registerHandlers } from './handlers';

const bot = new Telegraf(config.botToken);

registerHandlers(bot);

bot.catch((err, ctx) => {
  console.error(`Error for update ${ctx.update.update_id}:`, err);
});

async function main(): Promise<void> {
  console.log('Starting forum telegram bot...');
  await initDb();
  console.log(`Registered users: ${await getUsersCount()}`);

  await bot.launch();
  console.log('Bot is running');

  const shutdown = async (signal: 'SIGINT' | 'SIGTERM') => {
    bot.stop(signal);
    await closeDb();
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});
