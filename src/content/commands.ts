import { MessageAction } from '../types';
import { sendToAll } from './w2g-client';

const RECENT_MESSAGE_TTL_MS = 15000;
const MAX_RECENT_MESSAGE_KEYS = 800;
const ROBO_KJ_TOKEN_REGEX = /\bAC\d{6,}\b/;
const recentMessageKeys = new Map<string, number>();

function cleanupRecentMessageKeys(now: number) {
    for (const [key, ts] of recentMessageKeys) {
        if (now - ts > RECENT_MESSAGE_TTL_MS) {
            recentMessageKeys.delete(key);
        }
    }

    if (recentMessageKeys.size <= MAX_RECENT_MESSAGE_KEYS) {
        return;
    }

    const sortedOldestFirst = [...recentMessageKeys.entries()].sort((a, b) => a[1] - b[1]);
    const overflow = recentMessageKeys.size - MAX_RECENT_MESSAGE_KEYS;
    for (let i = 0; i < overflow; i++) {
        recentMessageKeys.delete(sortedOldestFirst[i][0]);
    }
}

function getSenderW2gId(element: Element): string {
    return element.querySelector('.overflow-clip')?.textContent?.trim() || 'unknown';
}

function hasRecentlyProcessedMessage(element: Element, messageText: string): boolean {
    const now = Date.now();
    cleanupRecentMessageKeys(now);

    const senderScopedKey = `cmd:${getSenderW2gId(element)}|${messageText.trim()}`;
    const messageKey = senderScopedKey;
    const previousTs = recentMessageKeys.get(messageKey);

    if (previousTs && now - previousTs <= RECENT_MESSAGE_TTL_MS) {
        return true;
    }

    recentMessageKeys.set(messageKey, now);
    return false;
}

function extractUrlPart(url: string): string {
    const beforeQuery = url.split('?')[0];
    const slashParts = beforeQuery.split('/');
    let result = slashParts[slashParts.length - 1];
    if (result === '' && slashParts.length > 1) {
        result = slashParts[slashParts.length - 2];
    }
    return result || '(URL)';
}

export function processMessageElement(element: Element) {
    // Look for the inner div containing the actual text message
    const messageTextDiv = element.querySelector('.break-words');
    if (!messageTextDiv) return;

    const messageText = (messageTextDiv.textContent || '').trim();

    // Ignore extension-generated tokened messages to avoid processing loops.
    if (ROBO_KJ_TOKEN_REGEX.test(messageText)) {
        return;
    }

    // Check if the message is a registration command
    if (messageText.trim().startsWith('/register ')) {
        if (hasRecentlyProcessedMessage(element, messageText)) {
            return;
        }

        const singerName = messageText.replace('/register ', '').trim();

        // Extract the w2gId (the user's identity string)
        let w2gId = 'admin'; // Default per user request if missing

        // The sender's ID is usually in the overflow-clip div inside the message block
        const idDiv = element.querySelector('.overflow-clip');
        if (idDiv && idDiv.textContent) {
            w2gId = idDiv.textContent.trim();
        }

        // Send message to background script
        const message: MessageAction = {
            type: 'REGISTER_SINGER',
            payload: {
                w2gId,
                stageName: singerName
            }
        };

        if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
            console.warn('RoboKJ: Extension context invalidated. Please refresh the page.');
            return;
        }

        try {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('RoboKJ Error sending message:', chrome.runtime.lastError);
                    return;
                }
                if (response && response.success) {
                    console.log(`RoboKJ: Successfully registered singer ${singerName} (${w2gId})`);
                    sendToAll(`${singerName} has been added to the roster.`);
                } else {
                    console.warn(`RoboKJ: Failed to register singer: ${response?.error}`);
                    if (response?.error === 'ignored' && response?.data) {
                        sendToAll(`${response.data.stageName} has been 86'd`);
                    } else if (response?.error === 'active' && response?.data) {
                        sendToAll(`${response.data.w2gId} already registered as ${response.data.stageName}`);
                    } else if (response?.error === 'Database error') {
                        sendToAll(`Error: out of resources`);
                    }
                }
            });
        } catch (error) {
            console.warn('RoboKJ Context Error:', error);
        }
        return; // Done processing this specific message type
    }

    // Check if the message is a queue command
    if (messageText.trim() === '/q') {
        if (hasRecentlyProcessedMessage(element, messageText)) {
            return;
        }

        let w2gId = 'admin'; // Default per user request if missing

        // The sender's ID is usually in the overflow-clip div inside the message block
        const idDiv = element.querySelector('.overflow-clip');
        if (idDiv && idDiv.textContent) {
            w2gId = idDiv.textContent.trim();
        }

        const message: MessageAction = {
            type: 'GET_QUEUE_FOR_USER',
            w2gId
        };

        if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
            console.warn('RoboKJ: Extension context invalidated. Please refresh the page.');
            return;
        }

        try {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('RoboKJ Error sending message:', chrome.runtime.lastError);
                    return;
                }
                if (response && response.success && response.data) {
                    const { stageName, requests } = response.data;
                    if (!requests || requests.requests.length <= requests.nextIndex) {
                        sendToAll(`@${stageName}, you have no songs queued.`);
                    } else {
                        const queuedSongs = requests.requests.slice(requests.nextIndex);
                        const queueLines = queuedSongs.map((req: any, idx: number) => {
                            let title = req.title || 'Unknown Song';
                            if (title.startsWith('http')) title = extractUrlPart(title);
                            return `${idx + 1}. ${title}`;
                        });
                        sendToAll([`@${stageName}'s Queue:`, ...queueLines].join('\n'));
                    }
                } else if (response && !response.success && response.error === 'User is not registered.') {
                    // Do nothing or optionally notify
                }
            });
        } catch (error) {
            console.warn('RoboKJ Context Error:', error);
        }
        return; // Done processing this specific message type
    }

    // Check if the message is a history command
    if (messageText.trim() === '/history') {
        if (hasRecentlyProcessedMessage(element, messageText)) {
            return;
        }

        let w2gId = 'admin'; // Default per user request if missing

        // The sender's ID is usually in the overflow-clip div inside the message block
        const idDiv = element.querySelector('.overflow-clip');
        if (idDiv && idDiv.textContent) {
            w2gId = idDiv.textContent.trim();
        }

        const message: MessageAction = {
            type: 'GET_QUEUE_FOR_USER',
            w2gId
        };

        if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
            console.warn('RoboKJ: Extension context invalidated. Please refresh the page.');
            return;
        }

        try {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('RoboKJ Error sending message:', chrome.runtime.lastError);
                    return;
                }
                if (response && response.success && response.data) {
                    const { stageName, requests } = response.data;
                    if (!requests || requests.nextIndex === 0) {
                        sendToAll(`@${stageName}, you have no song history.`);
                    } else {
                        const historySongs = requests.requests.slice(0, requests.nextIndex);
                        const historyLines = historySongs.map((req: any, idx: number) => {
                            let title = req.title || 'Unknown Song';
                            if (title.startsWith('http')) title = extractUrlPart(title);
                            return `${idx + 1}. ${title}`;
                        });
                        sendToAll([`@${stageName}'s History:`, ...historyLines].join('\n'));
                    }
                } else if (response && !response.success && response.error === 'User is not registered.') {
                    // Do nothing or optionally notify
                }
            });
        } catch (error) {
            console.warn('RoboKJ Context Error:', error);
        }
        return; // Done processing this specific message type
    }

    // Check if the message is a delq command
    if (messageText.trim() === '/delq') {
        if (hasRecentlyProcessedMessage(element, messageText)) {
            return;
        }

        let w2gId = 'admin'; // Default per user request if missing

        const idDiv = element.querySelector('.overflow-clip');
        if (idDiv && idDiv.textContent) {
            w2gId = idDiv.textContent.trim();
        }

        const message: MessageAction = {
            type: 'DELETE_QUEUE_FOR_USER',
            w2gId
        };

        if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
            console.warn('RoboKJ: Extension context invalidated. Please refresh the page.');
            return;
        }

        try {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('RoboKJ Error sending message:', chrome.runtime.lastError);
                    return;
                }
                if (response && response.success && response.data) {
                    sendToAll(`@${response.data.stageName}, your pending queue has been cleared!`);
                }
            });
        } catch (error) {
            console.warn('RoboKJ Context Error:', error);
        }
        return; // Done processing this specific message type
    }

    // Check if the message is a restart command
    if (messageText.trim() === '/restart') {
        if (hasRecentlyProcessedMessage(element, messageText)) {
            return;
        }

        let w2gId = 'admin'; // Default per user request if missing

        const idDiv = element.querySelector('.overflow-clip');
        if (idDiv && idDiv.textContent) {
            w2gId = idDiv.textContent.trim();
        }

        const message: MessageAction = {
            type: 'RESTART_VIDEO',
            payload: { w2gId, fromChat: true }
        };

        if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
            console.warn('RoboKJ: Extension context invalidated. Please refresh the page.');
            return;
        }

        try {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('RoboKJ Error sending message:', chrome.runtime.lastError);
                    return;
                }
                if (response && response.success) {
                    // Chat is notified by W2G when the video restarts, or we can stay silent
                } else if (response && !response.success && response.error) {
                    // For example: "You are not the current singer on stage."
                    sendToAll(response.error);
                }
            });
        } catch (error) {
            console.warn('RoboKJ Context Error:', error);
        }
        return; // Done processing this specific message type
    }

    const cmd = messageText.trim().toLowerCase();
    if (cmd === '/?' || cmd === '/help' || cmd === '/commands') {
        if (hasRecentlyProcessedMessage(element, messageText)) {
            return;
        }


        if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
            console.warn('RoboKJ: Extension context invalidated. Please refresh the page.');
            return;
        }

        try {
            chrome.runtime.sendMessage({ type: 'GET_SHOW_INFO' }, (response) => {
                let penaltySeconds = 30; // Fallback default
                if (response && response.success && response.data && response.data.maxSongDurationSeconds) {
                    penaltySeconds = Math.round((1.0 / 9.0) * response.data.maxSongDurationSeconds);
                }

                const helpMessages = [
                    '🤖 RoboKJ Commands:',
                    '"/register <zoom-name>"',
                    '"<youtube link>" : add song to queue (max 5)',
                    '"/q" : view request queue',
                    '"/history" : view past songs',
                    '"/delq" : delete songs in q',
                    `"/restart" : restart video (lose ${penaltySeconds}s)`,
                    '"/help" : view this message'
                ];

                sendToAll(helpMessages.join('\n'));
            });
        } catch (error) {
            console.warn('RoboKJ Context Error:', error);
        }
        
        return;
    }

    // Check if the message is a song request (contains a link for the song)
    // We target the specific italicized song title link instead of any anchor tag
    const linkElement = element.querySelector('a.italic.hover\\:underline') as HTMLAnchorElement;

    if (linkElement && linkElement.href) {
        if (hasRecentlyProcessedMessage(element, messageText)) {
            return;
        }

        // Stringent URL Validation: The main message text must be purely the URL itself.
        // If there's extra text (like "Here is my song" or "On Stage:"), ignore the link entirely.
        if (messageText.includes(' ') || !messageText.startsWith('http')) {
            console.log('RoboKJ: Ignored link message with extra text:', messageText);
            return;
        }

        // Find the actual URL (which might be the raw string text in the .break-words div above it, or the href value itself)
        const songUrlDiv = element.querySelector('.break-words') as HTMLDivElement;

        // Use the displayed youtube URL if we find it, otherwise fall back to the href
        const songUrl = (songUrlDiv && songUrlDiv.textContent && songUrlDiv.textContent.includes('http'))
            ? songUrlDiv.textContent.trim()
            : (linkElement.getAttribute('href') || linkElement.href);
            
        const isValidUrl = songUrl.startsWith('https://www.youtube.com/') || 
                           songUrl.startsWith('https://youtu.be/') || 
                           songUrl.startsWith('https://vimeo.com/');
        
        if (!isValidUrl) {
            console.log('RoboKJ: Ignored link message, URL not in allowed domains:', songUrl);
            return;
        }

        const songTitle = linkElement.textContent?.trim() || 'Unknown Title';

        let w2gId = 'admin'; // Default per user request if missing

        // The sender's ID is usually in the overflow-clip div inside the message block
        const idDiv = element.querySelector('.overflow-clip');
        if (idDiv && idDiv.textContent) {
            w2gId = idDiv.textContent.trim();
        }

        const message: MessageAction = {
            type: 'ADD_SONG_REQUEST',
            w2gId: w2gId,
            payload: {
                title: songTitle,
                url: songUrl
            }
        };

        if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
            console.warn('RoboKJ: Extension context invalidated. Please refresh the page.');
            return;
        }

        try {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('RoboKJ Error sending song request:', chrome.runtime.lastError);
                    return;
                }
                if (response && response.success && response.data) {
                    const { stageName, count } = response.data;
                    console.log(`RoboKJ: Successfully added song request "${songTitle}" for ${w2gId}`);
                    sendToAll(`Request added to the queue for ${stageName} (${count}/5)`);
                } else if (response && !response.success) {
                    if (response.error === 'limit_reached' && response.data) {
                        sendToAll(`Sorry ${response.data.stageName}, maximum 5 songs reached`);
                    } else if (response.error === 'duplicate' && response.data) {
                        const { stageName, claimedBy } = response.data;
                        const claimMsg = stageName === claimedBy ? 'you' : claimedBy;
                        sendToAll(`Sorry ${stageName}, that song is already claimed by ${claimMsg}`);
                    } else if (response.error === 'Database error') {
                        sendToAll(`Error: out of resources`);
                    } else if (response.error === 'User is not registered.') {
                        // Generally we want to silently ignore unregistered chat links based on RULES.md to avoid spamming chat for regular conversation links
                        console.log(`RoboKJ: Ignored unregistered user link ${w2gId}`);
                    }
                }
            });
        } catch (error) {
            console.warn('RoboKJ Context Error:', error);
        }
    }
}
