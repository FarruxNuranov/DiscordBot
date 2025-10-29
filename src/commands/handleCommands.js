const { Events } = require("discord.js");
const prisma = require("../utils/prismaClient");

module.exports = (client) => {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // 🏓 /ping
    if (interaction.commandName === "ping") {
      return interaction.reply({
        content: "🏓 Pong! Бот работает отлично 💪",
        ephemeral: true,
      });
    }

    // 🎧 /set-voice-log
    if (interaction.commandName === "set-voice-log") {
      const channel = interaction.options.getChannel("channel");
      if (!channel.isTextBased()) {
        return interaction.reply({
          content: "⚠️ Укажи текстовый канал!",
          ephemeral: true,
        });
      }

      await prisma.guildConfig.upsert({
        where: { guildId: interaction.guild.id },
        update: { logChannel: channel.id },
        create: { guildId: interaction.guild.id, logChannel: channel.id },
      });

      return interaction.reply({
        content: `✅ Лог-канал установлен: ${channel}`,
        ephemeral: true,
      });
    }

    // ⛔ /disable-voice-log
    if (interaction.commandName === "disable-voice-log") {
      await prisma.guildConfig.deleteMany({
        where: { guildId: interaction.guild.id },
      });

      return interaction.reply({
        content: "🛑 Логи голосовых каналов отключены.",
        ephemeral: true,
      });
    }
  });
};