require("dotenv").config();
const { Client, GatewayIntentBits, Partials, Events } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// Подключаем обработчики
require("./commands/handleCommands")(client);
require("./events/voiceLogger")(client);

client.once(Events.ClientReady, () => {
  console.log(`🤖 Бот запущен: ${client.user.tag}`);
});

client.login(process.env.TOKEN);