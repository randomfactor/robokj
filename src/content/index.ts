import { startObservingChat } from './chat-observer';
import { initVideoListeners } from './video-listener';
import { sendToAll, resetOutboundToken } from './w2g-client';

console.log('RoboKJ: Content script loaded. Initializing...');

// Start observing the chat container for commands and requests
startObservingChat();

// Start intercepting Youtube IFrame messages for state changes
initVideoListeners();

// Listen for broadcast instructions from the Background Service & Popup UI
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message.type === 'ANNOUNCE_SINGERS') {
            const { onStage, onStageSong, nextUp, afterThat } = message.payload;

            const announcements: string[] = [];
            if (onStage) {
                const songText = onStageSong ? ` singing "${onStageSong}"` : '';
                announcements.push(`On Stage: ${onStage}${songText}`);
            }
            if (nextUp) {
                announcements.push(`Next Up: ${nextUp}`);
            }
            if (afterThat) {
                announcements.push(`After That: ${afterThat}`);
            }

            if (announcements.length > 0) {
                setTimeout(() => sendToAll(announcements.join('\n')), 200);
            }

            sendResponse({ success: true });
            return true;
        }

        if (message.type === 'BROADCAST_MESSAGE') {
            const { text } = message.payload;
            if (text) sendToAll(text);
            sendResponse({ success: true });
            return true;
        }

        if (message.type === 'RESET_TOKEN_COUNTER') {
            resetOutboundToken();
            sendResponse({ success: true });
            return true;
        }

        if (message.type === 'CHECK_SINGER_ACTIVE') {
            // Prevent iframes (e.g. the video player) from intercepting and returning fake data
            if (window.self !== window.top) return false;

            const { w2gId } = message.payload;
            let isActive = true;

            try {
                const usersContainer = document.querySelector('.bg-w2g-dark-userlist.bottom-0.flex, .bg-w2g-light-userlist.bottom-0.flex');
                if (usersContainer) {
                    const userDiv = Array.from(usersContainer.querySelectorAll('div')).find(
                        d => d.getAttribute('title') === w2gId || d.textContent?.trim() === w2gId
                    );
                    
                    console.log(`RoboKJ: CHECK_SINGER_ACTIVE for w2gId='${w2gId}' - userDiv found: ${!!userDiv}`);

                    if (userDiv) {
                        const classArray = Array.from(userDiv.classList);
                        console.log(`RoboKJ: CHECK_SINGER_ACTIVE w2gId='${w2gId}' - classArray:`, classArray);
                        
                        if (classArray.some(c => c.startsWith('bg-gray-'))) {
                            isActive = false;
                        } else if (classArray.some(c => c.startsWith('bg-green-'))) {
                            isActive = true;
                        }
                        
                        console.log(`RoboKJ: CHECK_SINGER_ACTIVE w2gId='${w2gId}' - determined isActive=${isActive}`);
                    }
                } else {
                    console.warn(`RoboKJ: CHECK_SINGER_ACTIVE - Userlist container NOT found in DOM!`);
                }
            } catch (err) {
                console.error('RoboKJ: Failed to parse user DOM', err);
            }

            sendResponse({ success: true, active: isActive });
            return true;
        }
    });
}