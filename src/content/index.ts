import { startObservingChat } from './chat-observer';
import { initVideoListeners } from './video-listener';
import { sendToAll } from './w2g-client';

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
            
            if (onStage) {
                const songText = onStageSong ? ` singing "${onStageSong}"` : '';
                setTimeout(() => sendToAll(`On Stage: ${onStage}${songText}`), 200);
            }
            if (nextUp) {
                setTimeout(() => sendToAll(`Next Up: ${nextUp}`), 1000);
            }
            if (afterThat) {
                setTimeout(() => sendToAll(`After That: ${afterThat}`), 1800);
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
    });
}