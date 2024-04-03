const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const yts = require('yt-search')

async function search_youtube(query) {
    try {
        const r = await yts(query)
        const res = r.videos.slice(0, 10);
        return res
    } catch (error) {
        return console.log(`Error when searching youtube for ${query}. ` + error)
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Plays a song')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('The song title or YouTube URL')
                .setRequired(true)
                .setAutocomplete(true)),
    async autocomplete(interaction) {
        console.log('In autocomplete')
        const focusedOption = interaction.options.getFocused(true);
        let choices;

        if (focusedOption.name === 'query') {
            choices = await search_youtube(focusedOption.value);
        }

        await interaction.respond(
            choices.map(choice => ({ name: choice.title, value: choice.url }))
        );
    },
    async execute(interaction) {


        const stop = new ButtonBuilder()
            .setCustomId('stop')
            .setLabel('Stop Song')
            .setStyle(ButtonStyle.Danger);

        const pause = new ButtonBuilder()
            .setCustomId('pause')
            .setLabel('Pause Song')
            .setStyle(ButtonStyle.Secondary);

        const next = new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Next Song')
            .setStyle(ButtonStyle.Primary);


        const row = new ActionRowBuilder()
        .addComponents(pause,next,stop);

        // 1. Voice Connection: Check if the user is in a voice channel and joining the channel if so.

        // If the user is not in a channel and attempts to use the 'play' command,
        // prompt them to join a voice channel first.
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply('You need to be in a voice channel to use this command!');
        }

        // 2. Fetching Audio Stream: Using ytdl-core to fetch the audio stream from a provided
        // YouTube URL (or search query).

        await interaction.deferReply();
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

            // If command is to stop, then stop the currently playing song
            if (songQuery === 'stop') {
                const subscription = voiceChannel.guild.voiceStates.subscription;

                if (subscription) {
                    connection.destroy();
                    return await interaction.editReply(`Stopped playing.`);
                } else {
                    return await interaction.editReply(`No song currently playing.`);
                }
            }
            console.log('searching for query: ' + songQuery)

            const songInfo = await ytdl.getInfo(songQuery); // Fetch info about the video
            const stream = ytdl(songInfo.videoDetails.video_url, { filter: 'audioonly' });
            // 3. Creating Audio Resources: Converting the fetched stream into an audio resource
            // using createAudioResource from @discordjs/voice.
            const player = createAudioPlayer();
            const resource = createAudioResource(stream);

            // 4. Audio Playback: Using the @discordjs/voice functions to play
            // the audio resource in the voice channel.
            player.play(resource);
            connection.subscribe(player);

            return await interaction.editReply({content:`Now playing: ${songQuery}!`, components: [row]});
        } catch (error) {
            console.error(error);
            return await interaction.editReply(`Error: Could not find a song with query "${songQuery}".`);
        }

    }
};