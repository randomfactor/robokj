import { MessageAction } from '../types';
import { sendToAll } from './w2g-client';

export function processMessageElement(element: Element) {
    // Prevent duplicate processing if we already successfully pulled the data
    if (element.getAttribute('data-robokj-processed')) {
        return;
    }

    // Look for the inner div containing the actual text message
    const messageTextDiv = element.querySelector('.break-words');
    if (!messageTextDiv) return;

    const messageText = messageTextDiv.textContent || '';

    // Check if the message is a registration command
    if (messageText.trim().startsWith('/register ')) {
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

        element.setAttribute('data-robokj-processed', 'true');
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

        element.setAttribute('data-robokj-processed', 'true');
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
                        sendToAll(`@${stageName}'s Queue:`);
                        queuedSongs.forEach((req: any, idx: number) => {
                            // Adding a slight delay might be necessary if Watch2Gether drops rapid messages
                            // but let's try direct consecutive calls first
                            setTimeout(() => sendToAll(`${idx + 1}. ${req.title}`), (idx + 1) * 200);
                        });
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

        element.setAttribute('data-robokj-processed', 'true');
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
                        sendToAll(`@${stageName}'s History:`);
                        historySongs.forEach((req: any, idx: number) => {
                            setTimeout(() => sendToAll(`${idx + 1}. ${req.title}`), (idx + 1) * 200);
                        });
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

        element.setAttribute('data-robokj-processed', 'true');
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
        let w2gId = 'admin'; // Default per user request if missing

        const idDiv = element.querySelector('.overflow-clip');
        if (idDiv && idDiv.textContent) {
            w2gId = idDiv.textContent.trim();
        }

        const message: MessageAction = {
            type: 'RESTART_VIDEO',
            payload: { w2gId }
        };

        if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
            console.warn('RoboKJ: Extension context invalidated. Please refresh the page.');
            return;
        }

        element.setAttribute('data-robokj-processed', 'true');
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
        element.setAttribute('data-robokj-processed', 'true');

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
                
                helpMessages.forEach((msg, idx) => {
                    setTimeout(() => sendToAll(msg), idx * 200);
                });
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
        // Find the actual URL (which might be the raw string text in the .break-words div above it, or the href value itself)
        const songUrlDiv = element.querySelector('.break-words') as HTMLDivElement;

        // Use the displayed youtube URL if we find it, otherwise fall back to the href
        const songUrl = (songUrlDiv && songUrlDiv.textContent && songUrlDiv.textContent.includes('http'))
            ? songUrlDiv.textContent.trim()
            : (linkElement.getAttribute('href') || linkElement.href);
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

        element.setAttribute('data-robokj-processed', 'true');
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
                        sendToAll(`Sorry ${response.data.stageName}, "${response.data.title}" is already in the queue`);
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
