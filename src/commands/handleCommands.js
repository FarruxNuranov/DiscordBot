require("dotenv").config();
const { Events, EmbedBuilder, PermissionsBitField } = require("discord.js");
const prisma = require("../utils/prismaClient");

// ——— helpers ———
async function safeFetch(url, opts = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

function looksRussian(s = "") {
  return /[А-Яа-яЁё]/.test(s);
}

async function translateToRu(text) {
  if (!text || looksRussian(text)) return text;
  const bodies = JSON.stringify({
    q: text,
    source: "auto",
    target: "ru",
    format: "text",
  });
  const headers = { "Content-Type": "application/json" };
  const endpoints = [
    "https://libretranslate.com/translate",
    "https://translate.astian.org/translate",
  ];

  for (const ep of endpoints) {
    try {
      const r = await safeFetch(
        ep,
        { method: "POST", headers, body: bodies },
        9000
      );
      if (!r.ok) continue;
      const j = await r.json().catch(() => null);
      if (j?.translatedText) return j.translatedText;
    } catch (_) {}
  }
  return text;
}

async function getRandomFact() {
  try {
    const r = await safeFetch(
      "https://uselessfacts.jsph.pl/api/v2/facts/random"
    );
    if (r.ok) {
      const j = await r.json();
      if (j?.text) return j.text;
    }
  } catch (_) {}

  try {
    const r = await safeFetch("https://meowfacts.herokuapp.com/");
    if (r.ok) {
      const j = await r.json();
      if (Array.isArray(j?.data) && j.data[0]) return j.data[0];
    }
  } catch (_) {}

  try {
    const r = await safeFetch("http://numbersapi.com/random/trivia");
    if (r.ok) {
      const t = await r.text();
      if (t) return t;
    }
  } catch (_) {}

  return null;
}

module.exports = (client) => {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // /ping
    if (interaction.commandName === "ping") {
      return interaction.reply({
        content: "🏓 Pong! Бот работает отлично 💪",
        ephemeral: true,
      });
    }

    // /set-voice-log
    if (interaction.commandName === "set-voice-log") {
      const channel = interaction.options.getChannel("channel");
      if (!channel?.isTextBased?.()) {
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

    // /disable-voice-log
    if (interaction.commandName === "disable-voice-log") {
      await prisma.guildConfig.deleteMany({
        where: { guildId: interaction.guild.id },
      });
      return interaction.reply({
        content: "🛑 Логи голосовых каналов отключены.",
        ephemeral: true,
      });
    }

    // /fact — бесплатный факт дня (перевод на русский)
    if (interaction.commandName === "fact") {
      await interaction.deferReply();
      try {
        const factEn = await getRandomFact();
        if (!factEn) {
          await interaction.editReply(
            "⚠️ Не удалось получить факт. Попробуй позже."
          );
          return;
        }

        const factRu = await translateToRu(factEn);

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("📘 Факт дня")
          .setDescription(factRu)
          .setFooter({
            text: `Запрошено: ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
          })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error("Ошибка получения/перевода факта:", err);
        await interaction.editReply(
          "⚠️ Не удалось получить факт. Попробуй позже."
        );
      }
    }

    // 🧹 /clear — удалить сообщения
    if (interaction.commandName === "clear") {
      const amount = interaction.options.getInteger("количество");

      // 1️⃣ Проверка прав
      if (!interaction.member.permissions.has("ManageMessages")) {
        return interaction.reply({
          content: "❌ У тебя нет прав на удаление сообщений.",
          ephemeral: true,
        });
      }

      // 2️⃣ Проверка числа
      if (!amount || amount < 1 || amount > 100) {
        return interaction.reply({
          content: "⚠️ Укажи количество от 1 до 100.",
          ephemeral: true,
        });
      }

      try {
        // 3️⃣ Удаляем последние сообщения (включая команду)
        const messages = await interaction.channel.messages.fetch({
          limit: amount ,
        });
        const deleted = await interaction.channel.bulkDelete(messages, true);

        const deletedCount = deleted.size > 0 ? deleted.size : 0;

        // 4️⃣ Ответ пользователю
        await interaction.reply({
          content: `✅ Удалено ${deletedCount} сообщений.`,
          ephemeral: true,
        });

        // 5️⃣ Логирование в лог-канал
        const guildId = interaction.guild.id;
        const config = await prisma.guildConfig.findUnique({
          where: { guildId },
        });

        if (config?.logChannel) {
          const logChannel = await interaction.guild.channels
            .fetch(config.logChannel)
            .catch(() => null);
          if (logChannel) {
            const embed = new EmbedBuilder()
              .setColor(0xffcc00)
              .setTitle("🧹 Очистка сообщений")
              .setDescription(
                `**Модератор:** <@${interaction.user.id}> (${interaction.user.tag})\n` +
                  `**Канал:** <#${interaction.channel.id}>\n` +
                  `**Удалено:** ${deletedCount}`
              )
              .setThumbnail(
                interaction.user.displayAvatarURL({ dynamic: true })
              )
              .setTimestamp();

            await logChannel.send({ embeds: [embed] });
          }
        }
      } catch (err) {
        console.error("Ошибка при очистке:", err);
        return interaction.reply({
          content:
            "⚠️ Не удалось удалить сообщения. Возможно, они старше 14 дней или у бота нет прав.",
          ephemeral: true,
        });
      }
    }
  });
};
