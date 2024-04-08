const yts = require('yt-search');

let music_queue = [];

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
    music_queue,
    search_youtube
};