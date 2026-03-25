export function initVideoListeners() {
    // Listen for YouTube IFrame API messages from the nested Youtube child iframe
    window.addEventListener('message', (event) => {
        // Only trust events from YouTube
        if (event.origin !== 'https://www.youtube.com' && event.origin !== 'https://www.youtube-nocookie.com') {
            return;
        }

        try {
            const data = JSON.parse(event.data);
            if (data.event === 'onStateChange') {
                // data.info: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
                if (data.info === 0) {
                    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
                        chrome.runtime.sendMessage({ type: 'VIDEO_ENDED' }).catch(() => {});
                    }
                } else if (data.info === 1) {
                    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
                        chrome.runtime.sendMessage({ type: 'VIDEO_STARTED' }).catch(() => {});
                    }
                }
            } else if (data.event === 'onError') {
                if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage({ type: 'VIDEO_ERROR', payload: { errorCode: data.info } }).catch(() => {});
                }
            }
        } catch (e) {
            // Ignore JSON parsing errors for unrelated messages
        }
    });

    // Since our script is injected into all sub-frames ('all_frames': true), 
    // if W2G throws up its unplayable fallback wrapper, our script will run natively inside it!
    if (window.location.href.includes('w2g_sync/index.html')) {
        console.log('RoboKJ: Detected unplayable Watch2Gether fallback wrapper.');
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
            // Delay slightly to ensure backend is ready
            setTimeout(() => {
                chrome.runtime.sendMessage({ type: 'VIDEO_ERROR', payload: { errorCode: 999 } }).catch(() => {});
            }, 500);
        }
    }
}
