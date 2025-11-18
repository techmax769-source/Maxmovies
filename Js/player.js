import { showToast } from './ui.js';

let hls = null;

export const initPlayer = (container, sourceUrl, poster) => {
    container.innerHTML = `
        <div class="video-container">
            <video id="videoPlayer" controls poster="${poster}"></video>
            <div class="controls-overlay"></div>
        </div>
    `;
    
    const video = document.getElementById('videoPlayer');

    // Resume Playback Logic
    const savedTime = localStorage.getItem(`time_${sourceUrl}`);
    if (savedTime) video.currentTime = parseFloat(savedTime);

    // Save Progress
    setInterval(() => {
        if (!video.paused) localStorage.setItem(`time_${sourceUrl}`, video.currentTime);
    }, 5000);

    // HLS Logic
    if (Hls.isSupported() && sourceUrl.includes('.m3u8')) {
        hls = new Hls();
        hls.loadSource(sourceUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
        
        // Error Handling
        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) showToast('Stream Error. Try refreshing.', 'error');
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari Native HLS
        video.src = sourceUrl;
        video.addEventListener('loadedmetadata', () => video.play());
    } else {
        // Standard MP4
        video.src = sourceUrl;
        video.play();
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', handleShortcuts);
};

const handleShortcuts = (e) => {
    const video = document.getElementById('videoPlayer');
    if (!video) return;

    switch(e.key) {
        case ' ': e.preventDefault(); video.paused ? video.play() : video.pause(); break;
        case 'ArrowRight': video.currentTime += 10; break;
        case 'ArrowLeft': video.currentTime -= 10; break;
        case 'f': video.requestFullscreen(); break;
    }
};

export const destroyPlayer = () => {
    if (hls) {
        hls.destroy();
        hls = null;
    }
    document.removeEventListener('keydown', handleShortcuts);
};
