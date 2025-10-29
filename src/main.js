require("dotenv").config();
const { Client, GatewayIntentBits, Partials, Events, EmbedBuilder } = require("discord.js");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// 1️⃣ Создаём клиента
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// 2️⃣ Когда бот готов
client.once(Events.ClientReady, async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// 3️⃣ Slash-команда /set-voice-log
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "set-voice-log") {
    const channel = interaction.options.getChannel("channel");
    if (!channel.isTextBased()) {
      return interaction.reply({ content: "⚠️ Выбери текстовый канал!", ephemeral: true });
    }

    await prisma.guildConfig.upsert({
      where: { guildId: interaction.guild.id },
      update: { logChannel: channel.id },
      create: { guildId: interaction.guild.id, logChannel: channel.id },
    });

    return interaction.reply(`✅ Лог-канал установлен: ${channel}`);
  }
});

// 4️⃣ Voice логи
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const guildId = newState.guild.id;
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  if (!config || !config.logChannel) return;

  const logChannel = await newState.guild.channels.fetch(config.logChannel);
  if (!logChannel) return;

  const member = newState.member.user;
  const avatarURL = member.displayAvatarURL({ dynamic: true, size: 256 });
  const mention = `<@${member.id}>`;

  let embed;

  // 🟢 Подключение
  if (!oldState.channel && newState.channel) {
    embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("🔊 Подключение к голосовому каналу")
      .setDescription(`**Участник:** ${member.username} (${mention})\n**Канал:** 🔊 ${newState.channel.name}`)
      .setThumbnail(avatarURL)
      .setTimestamp();
  }

  // 🔴 Отключение
  else if (oldState.channel && !newState.channel) {
    embed = new EmbedBuilder()
      .setColor("Red")
      .setTitle("🔇 Отключение от голосового канала")
      .setDescription(`**Участник:** ${member.username} (${mention})\n**Канал:** 🔊 ${oldState.channel.name}`)
      .setThumbnail(avatarURL)
      .setTimestamp();
  }

  // 🟡 Перемещение
  else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
    embed = new EmbedBuilder()
      .setColor("Yellow")
      .setTitle("↔️ Перемещение между голосовыми каналами")
      .setDescription(
        `**Участник:** ${member.username} (${mention})\n**Из:** 🔊 ${oldState.channel.name}\n**В:** 🔊 ${newState.channel.name}`
      )
      .setThumbnail(avatarURL)
      .setTimestamp();
  }

  if (embed) await logChannel.send({ embeds: [embed] });
});

// 5️⃣ Запуск
client.login(process.env.TOKEN);