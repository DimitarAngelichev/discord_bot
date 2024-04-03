const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const ytdl = require('ytdl-core');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Plays a song')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('The song title or YouTube URL')
                .setRequired(true)),

    async execute(interaction) {
        // Audio playing logic will go here

        // 1. Voice Connection: Check if the user is in a voice channel and joining the channel if so.

        // If the user is not in a channel and attempts to use the 'play' command,
        // prompt them to join a voice channel first.
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply('You need to be in a voice channel to use this command!');
        }

        // 2. Fetching Audio Stream: Using ytdl-core to fetch the audio stream from a provided
        // YouTube URL (or search query).

        const songQuery = interaction.options.getString('query'); // Get the user's query

        try {
            // The bot should logically join the channel of the user who issued the command.
            // It's the most intuitive behavior for the user.
            const connection = await joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator,
                selfDeaf: false
            });

            // voiceChannel.guild.me.edit({mute:false})

            console.log(`song query: ${songQuery}`);
            const songInfo = await ytdl.getInfo(songQuery); // Fetch info about the video
            const stream = ytdl(songInfo.videoDetails.video_url, { filter: 'audioonly' });
            // 3. Creating Audio Resources: Converting the fetched stream into an audio resource
            // using createAudioResource from @discordjs/voice.
            const player = await createAudioPlayer();
            const resource = await createAudioResource(stream);

            // 4. Audio Playback: Using the @discordjs/voice functions to play
            // the audio resource in the voice channel.
            player.play(resource);
            connection.subscribe(player);

            await interaction.reply(`Playing a song!`);
        } catch (error) {
            console.error(error);
            interaction.reply(`Error: Could not find a song with query "${songQuery}".`);
        }
    }
};