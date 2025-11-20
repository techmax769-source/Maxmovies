import { showToast } from './ui.js';

let hls = null;

export const initPlayer = (container, sourceUrl, poster = '', subtitles = []) => {
    container.innerHTML = `
        <div class="video-container">
            <video id="videoPlayer" controls poster="${poster}"></video>
            <div class="controls-overlay"></div>
        </div>
    `;
    
    const video = document.getElementById('videoPlayer');

    /* ----------------------------------------------
       RESUME PLAYBACK
    ---------------------------------------------- */
    const resume = localStorage.getItem(`time_${sourceUrl}`);
    if (resume) video.currentTime = parseFloat(resume);

    setInterval(() => {
        if (!video.paused) {
            localStorage.setItem(`time_${sourceUrl}`, video.currentTime);
        }
    }, 5000);

    /* ----------------------------------------------
       SUBTITLES SUPPORT
       From GiftedTech format:
       [
          { url: "...", lang: "English" },
          { url: "...", lang: "Arabic" }
       ]
    ---------------------------------------------- */
    subtitles.forEach(track => {
        if (!track?.url) return;
        const t = document.createElement('track');
        t.kind = 'subtitles';
        t.label = track.lang || track.language || 'Subtitle';
        t.srclang = (track.lang || 'en').slice(0,2).toLowerCase();
        t.src = track.url;
        video.appendChild(t);
    });

    /* ----------------------------------------------
       HLS PLAYER LOGIC
    ---------------------------------------------- */
    if (Hls.isSupported() && sourceUrl.includes('.m3u8')) {
        hls = new Hls({
            maxMaxBufferLength: 90,
            startLevel: -1,     // auto quality
        });

        hls.loadSource(sourceUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());

        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                showToast('Stream Error — trying to recover…', 'error');

                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        hls.recoverMediaError();
                        break;
                    default:
                        showToast('Fatal error. Refresh required.', 'error');
                        hls.destroy();
                        break;
                }
            }
        });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        /* Safari native HLS */
        video.src = sourceUrl;
        video.addEventListener('loadedmetadata', () => video.play());

    } else {
        /* MP4 or fallback */
        video.src = sourceUrl;
        video.play();
    }

    /* ----------------------------------------------
       KEYBOARD SHORTCUTS
    ---------------------------------------------- */
    document.addEventListener('keydown', handleShortcuts);
};

/* ----------------------------------------------
   SHORTCUTS
---------------------------------------------- */
const handleShortcuts = (e) => {
    const video = document.getElementById('videoPlayer');
    if (!video) return;

    switch (e.key) {
        case ' ':
            e.preventDefault();
            video.paused ? video.play() : video.pause();
            break;
        case 'ArrowRight':
            video.currentTime += 10;
            break;
        case 'ArrowLeft':
            video.currentTime -= 10;
            break;
        case 'f':
            if (video.requestFullscreen) video.requestFullscreen();
            break;
    }
};

/* ----------------------------------------------
   PLAYER CLEANUP
---------------------------------------------- */
export const destroyPlayer = () => {
    if (hls) {
        hls.destroy();
        hls = null;
    }
    document.removeEventListener('keydown', handleShortcuts);
};
