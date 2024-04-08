const { SlashCommandBuilder } = require('discord.js');
const ytdl = require('ytdl-core');
const shared_data = require('./shared.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('queue')
		.setDescription('Queues a song.')
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
        let currentPlayingMessageId;

        // Goal of queue functionality: find queue array in the current channel and add URLs to it.

        // 1. Check the VoiceChannel
        // If the user is not in a channel and attempts to use the 'queue' command,
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
            console.log('searching for query: ' + songQuery)

            const songInfo = await ytdl.getInfo(songQuery); // Fetch info about the video

        // 3. Add songInfo.videoDetails.video_url to queue
        // If no player in this channel is playing any songs || queue empty:
            // If no player exists -> run play.js
            // If current player is idle -> add to queue and expect player to play
            // (player is waiting for songs in the queue while idle)
            console.log(`queue before adding to queue: ${shared_data.music_queue}`);
            shared_data.music_queue.push(songInfo.videoDetails.video_url);
            console.log(`queue after adding to queue: ${shared_data.music_queue}`);

            return await interaction.editReply(`Queued ${songQuery}`)
                                    .then(msg => currentPlayingMessageId = msg.id);

        } catch (error) {
            console.error(error);
            return await interaction.editReply(`Error: Could not find a song with query "${songQuery}".`);
        }
    }
};
