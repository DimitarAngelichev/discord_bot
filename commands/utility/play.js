const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const shared_data = require('./shared.js');

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
            choices = await shared_data.search_youtube(focusedOption.value);
        }

        if (choices != undefined) {
            await interaction.respond(
                choices.map(choice => ({ name: choice.title, value: choice.url }))
            );
        }
    },
    async execute(interaction) {
        // For debug
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

        const row = new ActionRowBuilder().addComponents(pause,next,stop);

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
            const youtubeSearchResult = await shared_data.search_youtube(songQuery)
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
            let stream = ytdl(songInfo.videoDetails.video_url, { filter: 'audioonly' });
            // 3. Creating Audio Resources: Converting the fetched stream into an audio resource
            // using createAudioResource from @discordjs/voice.
            let player = createAudioPlayer();
            let resource = createAudioResource(stream);

            // 4. Audio Playback: Using the @discordjs/voice functions to play
            // the audio resource in the voice channel.
            player.play(resource);
            connection.subscribe(player);

            player.addListener("stateChange", async (old_state, new_state) => {
                if (new_state.status == "idle") {
                    console.log("Song over, checking queue");
                    // Could exctract this queue shifting and playing song to a function.
                    if (shared_data.music_queue.length !== 0) {
                        let song_url = shared_data.music_queue.shift(songInfo.videoDetails.video_url);
                        stream = ytdl(song_url, { filter: 'audioonly' });
                        resource = createAudioResource(stream);
                        player.play (resource);
                        return await interaction.editReply({
                            content: `Playing next song in queue: ${song_url}!`,
                            components: [row]
                        }).then(msg => currentPlayingMessageId = msg.id);
                    } else {
                        return await interaction.editReply("Queue is Empty.")
                    }
                }
            });

            const collector = interaction.channel.createMessageComponentCollector();

            collector.on('collect', async interaction => {
                await interaction.deferReply();
                console.log(`Check message.id: inter: ${interaction.message.id} curr: ${currentPlayingMessageId}`);

                if (interaction.customId === 'stop') {
                    if (player) {
                        await player.stop();
                        return await interaction.editReply('Song stopped!');
                    } else {
                        return await interaction.editReply('No audio is currently playing.');
                    }
                } else if (interaction.customId === 'pause') {
                    if (player.state.status == "playing") {
                        await player.pause();
                        return await interaction.editReply('Song paused!');
                    } else if (player.state.status == "paused") {
                        await player.unpause();
                        return await interaction.editReply('Resume playing.');
                    } else {
                        return await interaction.editReply(`Unknown state during pause/resume action! State: ${player.state.status}`);
                    }
                } else if (interaction.customId === 'next') {
                    if (player.state.status == "playing" || player.state.status == "paused" || player.state.status == "idle") {
                    // Could exctract this queue shifting and playing song to a function.
                        if (shared_data.music_queue.length !== 0){
                            let song_url = shared_data.music_queue.shift();
                            console.log(`queue after 'next' command: ${shared_data.music_queue}`);
                            stream = ytdl(song_url, { filter: 'audioonly' });
                            resource = createAudioResource(stream);
                            player.play (resource);
                            return await interaction.editReply({
                                content: `Skipping to next song: ${song_url}!`,
                                components: [row]
                            }).then(msg => currentPlayingMessageId = msg.id);
                        } else {
                            return await interaction.editReply('No songs in queue.');
                        }
                    } else {
                        return await interaction.editReply(`Unknown state during pause/resume/next action! State: ${player.state.status}`);
                    }
                }

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