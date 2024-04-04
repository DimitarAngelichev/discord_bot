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

        if (focusedOption.name === 'query' && focusedOption.value != '') {
            choices = await search_youtube(focusedOption.value);
        }

        if (choices != undefined) {
            await interaction.respond(
                choices.map(choice => ({ name: choice.title, value: choice.url }))
            );
        }
    },
    async execute(interaction) {
        let currentPlayingMessageId;

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
        let songQuery = interaction.options.getString('query'); // Get the user's query

        // If query is not a youtube url, then get the first result and use that as the url
        if (false == songQuery.includes("https://youtube.com/watch?v=")) {
            const youtubeSearchResult = await search_youtube(songQuery)
            songQuery = youtubeSearchResult[0].url;
        }

        try {
            // The bot should logically join the channel of the user who issued the command.
            // It's the most intuitive behavior for the user.
            const connection = await joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator,
                selfDeaf: false
            });

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

            const collector = interaction.channel.createMessageComponentCollector();

            collector.on('collect', async interaction => {
                // check player.state.status == 'idle'
                console.log(`Check message.id: inter: ${interaction.message.id} curr: ${currentPlayingMessageId}`);
                // TODO: somehow have to handle stopped songs, idle players

                if (interaction.customId === 'stop' && interaction.message.id === currentPlayingMessageId) {
                    if (player) {
                        await player.stop();
                        return await interaction.reply('Song stopped!');
                    } else {
                        return await interaction.reply('No audio is currently playing.');
                    }
                }
                if (interaction.customId === 'pause' && interaction.message.id === currentPlayingMessageId) {
                    if (player.state.status == "playing") {
                        await player.pause();
                        return await interaction.reply('Song paused!');
                    } else if (player.state.status == "paused") {
                        await player.unpause();
                        return await interaction.reply('Resume playing.');
                    } else {
                        return await interaction.reply(`Unknown state during pause/resume action! State: ${player.state.status}`);
                    }
                }

                // Add handler for 'next' after implementing queue.
            });

            return await interaction.editReply({
                content: `Now playing: ${songQuery}!`,
                components: [row]
            }).then(msg => currentPlayingMessageId = msg.id);

        } catch (error) {
            console.error(error);
            return await interaction.editReply(`Error: Could not find a song with query "${songQuery}".`);
        }
    }
};