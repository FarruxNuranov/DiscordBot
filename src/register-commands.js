require("dotenv").config();
const { REST, Routes, ApplicationCommandOptionType } = require("discord.js");

// ——— список всех доступных команд ———
const commands = [
  {
    name: "ping",
    description: "Проверить работу бота 🏓",
  },
  {
    name: "set-voice-log",
    description: "Выбери канал, куда бот будет отправлять voice-логи 🎧",
    options: [
      {
        name: "channel",
        description: "Канал для логов",
        type: ApplicationCommandOptionType.Channel,
        required: true,
      },
    ],
  },
  {
    name: "disable-voice-log",
    description: "Отключить логи голосовых каналов 🛑",
  },
  {
    name: "fact",
    description: "Получить случайный интересный факт 📘",
  },
  {
    name: "clear",
    description: "Удалить указанное количество сообщений из текущего канала 🧹",
    options: [
      {
        name: "количество",
        description: "Сколько сообщений удалить (1–100)",
        type: ApplicationCommandOptionType.Integer,
        required: true,
      },
    ],
  },
  {
    name: "say",
    description: "Отправить сообщение от имени пользователя 💬",
    options: [
      {
        name: "текст",
        description: "Текст сообщения",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "канал",
        description: "Канал, куда отправить сообщение (опционально)",
        type: ApplicationCommandOptionType.Channel,
        required: false,
      },
      {
        name: "server_id",
        description: "ID сервера (если нужно отправить на другой сервер)",
        type: ApplicationCommandOptionType.String,
        required: false,
      },
      {
        name: "channel_id",
        description: "ID канала (если другой сервер)",
        type: ApplicationCommandOptionType.String,
        required: false,
      },
    ],
  },
];

// ——— регистрация команд в Discord API ———
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("⏳ Регистрирую команды...");
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );
    console.log("✅ Команды успешно зарегистрированы!");
  } catch (error) {
    console.error("❌ Ошибка при регистрации команд:", error);
  }
})();