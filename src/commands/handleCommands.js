require("dotenv").config();
const {
  Events,
  EmbedBuilder,
  PermissionsBitField,
} = require("discord.js");
const prisma = require("../utils/prismaClient");

// ——— helper: безопасный fetch с таймаутом ———
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

// ——— helper: определяем, есть ли русские буквы ———
function looksRussian(s = "") {
  return /[А-Яа-яЁё]/.test(s);
}

// ——— helper: перевод текста на русский ———
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

// ——— helper: получить случайный факт ———
async function getRandomFact() {
  try {
    const r = await safeFetch("https://uselessfacts.jsph.pl/api/v2/facts/random");
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

// ——— основной обработчик ———
module.exports = (client) => {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // 🏓 /ping — проверка
    if (interaction.commandName === "ping") {
      return interaction.reply({
        content: "🏓 Pong! Бот работает отлично 💪",
        ephemeral: true,
      });
    }

    // 🎧 /set-voice-log — указать канал логов
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

    // 🛑 /disable-voice-log — отключить логи
    if (interaction.commandName === "disable-voice-log") {
      await prisma.guildConfig.deleteMany({
        where: { guildId: interaction.guild.id },
      });
      return interaction.reply({
        content: "🛑 Логи голосовых каналов отключены.",
        ephemeral: true,
      });
    }

    // 📘 /fact — получить случайный факт (автоперевод)
    if (interaction.commandName === "fact") {
      await interaction.deferReply();
      try {
        const factEn = await getRandomFact();
        if (!factEn) {
          await interaction.editReply("⚠️ Не удалось получить факт. Попробуй позже.");
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
        await interaction.editReply("⚠️ Не удалось получить факт. Попробуй позже.");
      }
    }

    // 🧹 /clear — очистка сообщений
    if (interaction.commandName === "clear") {
      const amount = interaction.options.getInteger("количество");
      const allowedRoles = ["Администратор", "Модератор"];

      const member = interaction.member;
      const hasAllowedRole = member.roles.cache.some(
        (role) =>
          allowedRoles.includes(role.name) || allowedRoles.includes(role.id)
      );

      if (!member.permissions.has("ManageMessages") && !hasAllowedRole) {
        return interaction.reply({
          content: "🚫 У вас недостаточно прав для удаления сообщений.",
          ephemeral: true,
        });
      }

      if (!amount || amount < 1 || amount > 100) {
        return interaction.reply({
          content: "⚠️ Укажи количество от 1 до 100.",
          ephemeral: true,
        });
      }

      try {
        const messages = await interaction.channel.messages.fetch({ limit: amount });
        const deleted = await interaction.channel.bulkDelete(messages, true);
        const deletedCount = deleted.size || 0;

        await interaction.reply({
          content: `✅ Удалено ${deletedCount} сообщений.`,
          ephemeral: true,
        });

        // — логирование в лог-канал —
        const guildId = interaction.guild.id;
        const config = await prisma.guildConfig.findUnique({ where: { guildId } });

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
              .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
              .setTimestamp();

            await logChannel.send({ embeds: [embed] });
          }
        }
      } catch (err) {
        console.error("Ошибка при очистке:", err);
        return interaction.reply({
          content: "⚠️ Не удалось удалить сообщения. Возможно, они старше 14 дней или у бота нет прав.",
          ephemeral: true,
        });
      }
    }

    // 💬 /say — отправить сообщение от имени пользователя через webhook
    if (interaction.commandName === "say") {
      const text = interaction.options.getString("текст");
      const channelOption = interaction.options.getChannel("канал");
      const serverId = interaction.options.getString("server_id");
      const channelId = interaction.options.getString("channel_id");

      if (!text) {
        return interaction.reply({
          content: "⚠️ Укажи текст сообщения!",
          ephemeral: true,
        });
      }

      try {
        let targetChannel = null;

        if (channelOption) targetChannel = channelOption;
        else if (serverId && channelId) {
          const targetGuild = await client.guilds.fetch(serverId).catch(() => null);
          if (!targetGuild) {
            return interaction.reply({
              content: "❌ Сервер не найден (проверь ID).",
              ephemeral: true,
            });
          }
          targetChannel = await targetGuild.channels.fetch(channelId).catch(() => null);
        } else {
          targetChannel = interaction.channel;
        }

        if (!targetChannel || !targetChannel.isTextBased()) {
          return interaction.reply({
            content: "❌ Канал не найден или не является текстовым.",
            ephemeral: true,
          });
        }

        const webhooks = await targetChannel.fetchWebhooks();
        let webhook = webhooks.find((w) => w.name === "FaraWebhook");

        if (!webhook) {
          webhook = await targetChannel.createWebhook({
            name: "FaraWebhook",
            avatar: interaction.user.displayAvatarURL({ dynamic: true }),
          });
        }

        await webhook.send({
          content: text,
          username: interaction.user.username,
          avatarURL: interaction.user.displayAvatarURL({ dynamic: true }),
        });

        return interaction.reply({
          content: `✅ Сообщение отправлено в ${targetChannel}.`,
          ephemeral: true,
        });
      } catch (err) {
        console.error("Ошибка в /say:", err);
        return interaction.reply({
          content:
            "⚠️ Ошибка при отправке. Возможно, у бота нет прав на создание вебхуков.",
          ephemeral: true,
        });
      }
    }
  });
};