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
    });
}