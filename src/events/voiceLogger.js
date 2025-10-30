const { Events, EmbedBuilder } = require("discord.js");
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

    // 🟢 Подключился
    if (!oldState.channel && newState.channel) {
      const channelLink = `[${newState.channel.name}](https://discord.com/channels/${guildId}/${newState.channel.id})`;
      embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("🔊 Подключение к голосовому каналу")
        .setDescription(
          `**Участник:** ${memberName} (${mention})\n**Канал:** ${channelLink}`
        )
        .setThumbnail(avatarURL)
        .setTimestamp();
    }

    // 🔴 Вышел
    else if (oldState.channel && !newState.channel) {
      const channelLink = `[${oldState.channel.name}](https://discord.com/channels/${guildId}/${oldState.channel.id})`;
      embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle("🔇 Отключение от голосового канала")
        .setDescription(
          `**Участник:** ${memberName} (${mention})\n**Канал:** ${channelLink}`
        )
        .setThumbnail(avatarURL)
        .setTimestamp();
    }

    // 🟡 Переместился
    else if (
      oldState.channel &&
      newState.channel &&
      oldState.channel.id !== newState.channel.id
    ) {
      const oldLink = `[${oldState.channel.name}](https://discord.com/channels/${guildId}/${oldState.channel.id})`;
      const newLink = `[${newState.channel.name}](https://discord.com/channels/${guildId}/${newState.channel.id})`;

      embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle("↔️ Перемещение между голосовыми каналами")
        .setDescription(
          `**Участник:** ${memberName} (${mention})\n**Из:** ${oldLink}\n**В:** ${newLink}`
        )
        .setThumbnail(avatarURL)
        .setTimestamp();
    }

    // ✅ Отправляем embed
    if (embed) await logChannel.send({ embeds: [embed] });
  });
};