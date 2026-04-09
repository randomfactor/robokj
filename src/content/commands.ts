import { MessageAction } from '../types';
import { sendToAll } from './w2g-client';

export const ROBO_KJ_TOKEN_REGEX = /\bAC\d{6,}\b/;

function extractUrlPart(url: string): string {
    const beforeQuery = url.split('?')[0];
    const slashParts = beforeQuery.split('/');
    let result = slashParts[slashParts.length - 1];
    if (result === '' && slashParts.length > 1) {
        result = slashParts[slashParts.length - 2];
    }
    return result || '(URL)';
}

export interface ParsedCommand {
    action: MessageAction;
    w2gId: string;
    rawText: string;
    isHelp?: boolean;
}

export function parseMessageElement(element: Element): ParsedCommand | null {
    const messageTextDiv = element.querySelector('.break-words');
    if (!messageTextDiv) return null;

    const messageText = (messageTextDiv.textContent || '').trim();

    if (ROBO_KJ_TOKEN_REGEX.test(messageText)) {
        return null; // Ignore token messages
    }

    let w2gId = 'admin';
    const idDiv = element.querySelector('.overflow-clip');
    if (idDiv && idDiv.textContent) {
        w2gId = idDiv.textContent.trim();
    }

    if (messageText.trim().startsWith('/register ')) {
        const singerName = messageText.replace('/register ', '').trim();
        return {
            action: { type: 'REGISTER_SINGER', payload: { w2gId, stageName: singerName } },
            w2gId,
            rawText: messageText
        };
    }

    if (messageText.trim() === '/q') {
        return {
            action: { type: 'GET_QUEUE_FOR_USER', w2gId },
            w2gId,
            rawText: messageText
        };
    }

    if (messageText.trim() === '/history') {
        return {
            action: { type: 'GET_QUEUE_FOR_USER', w2gId },
            w2gId,
            rawText: messageText
        };
    }

    if (messageText.trim() === '/delq') {
        return {
            action: { type: 'DELETE_QUEUE_FOR_USER', w2gId },
            w2gId,
            rawText: messageText
        };
    }

    if (messageText.trim() === '/pos') {
        return {
            action: { type: 'GET_POSITION', w2gId },
            w2gId,
            rawText: messageText
        };
    }

    if (messageText.trim() === '/restart') {
        return {
            action: { type: 'RESTART_VIDEO', payload: { w2gId, fromChat: true } },
            w2gId,
            rawText: messageText
        };
    }

    const cmd = messageText.trim().toLowerCase();
    if (cmd === '/?' || cmd === '/help' || cmd === '/commands') {
        return {
            action: { type: 'GET_SHOW_INFO' },
            w2gId,
            rawText: messageText,
            isHelp: true
        };
    }

    // Youtube link request
    const linkElement = element.querySelector('a.italic.hover\\:underline') as HTMLAnchorElement;
    if (linkElement && linkElement.href) {
        if (messageText.includes(' ') || !messageText.startsWith('http')) {
            return null;
        }

        const songUrlDiv = element.querySelector('.break-words') as HTMLDivElement;
        const songUrl = (songUrlDiv && songUrlDiv.textContent && songUrlDiv.textContent.includes('http'))
            ? songUrlDiv.textContent.trim()
            : (linkElement.getAttribute('href') || linkElement.href);

        const isValidUrl = songUrl.startsWith('https://www.youtube.com/') || 
                           songUrl.startsWith('https://youtu.be/') || 
                           songUrl.startsWith('https://vimeo.com/');
        if (!isValidUrl) {
            return null;
        }

        const songTitle = linkElement.textContent?.trim() || 'Unknown Title';

        return {
            action: { type: 'ADD_SONG_REQUEST', w2gId, payload: { title: songTitle, url: songUrl } },
            w2gId,
            rawText: messageText
        };
    }

    return null;
}

export function handleActionResponse(parsed: ParsedCommand, response: any): void {
    const { action, w2gId, rawText, isHelp } = parsed;

    if (isHelp) {
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
            '"/pos" : view roster position',
            `"/restart" : restart video (lose ${penaltySeconds}s)`,
            '"/help" : view this message'
        ];
        sendToAll(helpMessages.join('\n'));
        return;
    }

    if (!action) return;

    if (action.type === 'REGISTER_SINGER') {
        if (response && response.success) {
            console.log(`RoboKJ: Successfully registered singer ${action.payload.stageName} (${w2gId})`);
            sendToAll(`${action.payload.stageName} has been added to the roster.`);
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
    } else if (action.type === 'GET_QUEUE_FOR_USER' && rawText === '/q') {
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
        }
    } else if (action.type === 'GET_QUEUE_FOR_USER' && rawText === '/history') {
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
        }
    } else if (action.type === 'DELETE_QUEUE_FOR_USER') {
        if (response && response.success && response.data) {
            sendToAll(`@${response.data.stageName}, your pending queue has been cleared!`);
        }
    } else if (action.type === 'GET_POSITION') {
        if (response && response.success && response.data) {
            sendToAll(response.data.message);
        } else if (response && !response.success && response.error) {
            sendToAll(response.error);
        }
    } else if (action.type === 'RESTART_VIDEO') {
        if (response && !response.success && response.error) {
            sendToAll(response.error);
        }
    } else if (action.type === 'ADD_SONG_REQUEST') {
        if (response && response.success && response.data) {
            const { stageName, count } = response.data;
            console.log(`RoboKJ: Successfully added song request "${action.payload.title}" for ${w2gId}`);
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
                console.log(`RoboKJ: Ignored unregistered user link ${w2gId}`);
            }
        }
    }
}
