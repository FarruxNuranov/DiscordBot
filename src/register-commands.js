require("dotenv").config();
const { REST, Routes, ApplicationCommandOptionType } = require("discord.js");

const commands = [
  {
    name: "ping",
    description: "Проверить работу бота 🏓",
  },
  {
    name: "set-voice-log",
    description: "Выбери канал, куда бот будет отправлять voice-логи",
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
    description: "Отключить логи голосовых каналов",
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
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("⏳ Регистрирую команды...");
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("✅ Команды успешно зарегистрированы!");
  } catch (error) {
    console.error("❌ Ошибка при регистрации команд:", error);
  }
})();