const {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const prisma = require("../utils/prismaClient");

module.exports = (client) => {
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    // 🔹 фильтр от лишних событий
    if (
      oldState.channelId === newState.channelId &&
      oldState.mute === newState.mute &&
      oldState.deaf === newState.deaf &&
      oldState.streaming === newState.streaming
    )
      return;

    const guildId = newState.guild.id;
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    if (!config || !config.logChannel) return;

    const logChannel = await newState.guild.channels
      .fetch(config.logChannel)
      .catch(() => null);
    if (!logChannel) return;

    const member = newState.member.user;
    const avatarURL = member.displayAvatarURL({ dynamic: true, size: 256 });
    const mention = `<@${member.id}>`;
    const memberName = member.username;

    let embed;
    let channelIdForButton = null;

    // 🟢 Подключился
    if (!oldState.channel && newState.channel) {
      embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("🔊 Подключение к голосовому каналу")
        .setDescription(
          `**Участник:** ${memberName} (${mention})\n**Канал:** <#${newState.channel.id}>`
        )
        .setThumbnail(avatarURL)
        .setTimestamp();
      channelIdForButton = newState.channel.id;
    }

    // 🔴 Вышел
    else if (oldState.channel && !newState.channel) {
      embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle("🔇 Отключение от голосового канала")
        .setDescription(
          `**Участник:** ${memberName} (${mention})\n**Канал:** <#${oldState.channel.id}>`
        )
        .setThumbnail(avatarURL)
        .setTimestamp();
      channelIdForButton = oldState.channel.id;
    }

    // 🟡 Переместился
    else if (
      oldState.channel &&
      newState.channel &&
      oldState.channel.id !== newState.channel.id
    ) {
      embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle("↔️ Перемещение между голосовыми каналами")
        .setDescription(
          `**Участник:** ${memberName} (${mention})\n**Из:** <#${oldState.channel.id}>\n**В:** <#${newState.channel.id}>`
        )
        .setThumbnail(avatarURL)
        .setTimestamp();
      channelIdForButton = newState.channel.id;
    }

    if (embed && channelIdForButton) {
      // 🔘 Кнопка “Показать канал”
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("🔍 Показать канал")
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/channels/${guildId}/${channelIdForButton}`)
      );

      // Отправляем embed с кнопкой
      const msg = await logChannel.send({ embeds: [embed], components: [row] });

      // ⏳ Через 30 секунд убираем кнопку (чистый лог)
      setTimeout(async () => {
        try {
          await msg.edit({ components: [] });
        } catch (err) {
          console.error("Не удалось удалить кнопку:", err);
        }
      }, 30_000);
    }
  });
};