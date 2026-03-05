import { KSinger, MessageAction, MessageResponse, KRoster, KSingerStatus, KSongRequests } from '../types';
import { getKRoster, setKRoster, getKSongRequests, setKSongRequests, getKShow, setKShow } from './db';

// To ease testing of expected asynchronous operations
export interface BackgroundServiceOptions {
    onMessageProcessed?: (message: MessageAction, response: MessageResponse) => void;
}

export class BackgroundService {
    options: BackgroundServiceOptions;

    constructor(options: BackgroundServiceOptions = {}) {
        this.options = options;
    }

    // Helper to generate a unique ID
    generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    handleMessage(message: MessageAction, sendResponse: (response: MessageResponse) => void): boolean {
        // Internal wrapper to handle async and emit testing event
        const respond = (response: MessageResponse) => {
            sendResponse(response);
            if (this.options.onMessageProcessed) {
                this.options.onMessageProcessed(message, response);
            }
        };

        if (message.type === 'REGISTER_SINGER') {
            this._handleRegisterSinger(message.payload, respond);
            return true;
        }
        if (message.type === 'ADD_SONG_REQUEST') {
            this._handleAddSongRequest(message.w2gId, message.payload, respond);
            return true;
        }
        if (message.type === 'GET_SHOW_INFO') {
            this._handleGetShowInfo(respond);
            return true;
        }
        if (message.type === 'SET_SHOW_INFO') {
            this._handleSetShowInfo(message.payload, respond);
            return true;
        }
        if (message.type === 'GET_ROSTER') {
            this._handleGetRoster(respond);
            return true;
        }

        return true;
    }

    private async _handleGetRoster(sendResponse: (response: MessageResponse) => void) {
        try {
            const roster = await getKRoster();
            // Default to empty array if no roster exists yet
            sendResponse({ success: true, data: roster?.singers || [] });
        } catch (error) {
            console.error('RoboKJ: Database error during GET_ROSTER:', error);
            sendResponse({ success: false, error: 'Database error' });
        }
    }

    private async _handleGetShowInfo(sendResponse: (response: MessageResponse) => void) {
        try {
            const show = await getKShow();
            sendResponse({ success: true, data: show || null });
        } catch (error) {
            console.error('RoboKJ: Database error during GET_SHOW_INFO:', error);
            sendResponse({ success: false, error: 'Database error' });
        }
    }

    private async _handleSetShowInfo(payload: Partial<import('../types').KShow>, sendResponse: (response: MessageResponse) => void) {
        try {
            const currentShow = await getKShow() || {
                venueName: '',
                startTimeUTC: new Date().toISOString(),
                durationInHours: 4,
                streamKey: '',
                mode: 'manual'
            };
            const updatedShow = { ...currentShow, ...payload };
            await setKShow(updatedShow);

            console.log('RoboKJ: Show info updated', updatedShow);
            sendResponse({ success: true, data: updatedShow });
        } catch (error) {
            console.error('RoboKJ: Database error during SET_SHOW_INFO:', error);
            sendResponse({ success: false, error: 'Database error' });
        }
    }

    private async _handleRegisterSinger(payload: KSinger, sendResponse: (response: MessageResponse) => void) {
        try {
            const roster: KRoster | undefined = await getKRoster();

            const newSinger: KSinger = {
                w2gId: payload.w2gId,
                stageName: payload.stageName,
            };

            const newSingerStatus: KSingerStatus = {
                singer: newSinger,
                status: 'active',
                bumpCount: 0
            };

            if (!roster) {
                // No roster found, create a new one with the singer info
                const newRoster: KRoster = { singers: [newSingerStatus] };
                await setKRoster(newRoster);

                console.log('Created new roster with singer:', newSinger);
                sendResponse({ success: true, data: newSinger });
                return;
            }

            // Otherwise, check if w2gId and stageName are unique
            const existingSingerStatus = roster.singers.find(
                (status) => status.singer.w2gId === payload.w2gId || status.singer.stageName === payload.stageName
            );

            if (existingSingerStatus) {
                // Conflict
                sendResponse({
                    success: false,
                    error: `Singer with w2gId ${existingSingerStatus.singer.w2gId} or stageName "${existingSingerStatus.singer.stageName}" already exists.`,
                });
                return;
            }

            // No conflict, add to the end of the roster array
            roster.singers.push(newSingerStatus);
            await setKRoster(roster);

            console.log('Singer registered successfully:', newSinger);
            console.log('Current Roster:', roster.singers);

            // Respond with success
            sendResponse({
                success: true,
                data: newSinger,
            });
        } catch (error) {
            console.error('RoboKJ: Database error during REGISTER_SINGER:', error);
            sendResponse({ success: false, error: 'Database error' });
        }
    }

    private async _handleAddSongRequest(w2gId: string, payload: any, sendResponse: (response: MessageResponse) => void) {
        try {
            console.log('Received song request:', payload, 'for w2gId:', w2gId);

            const roster: KRoster = await getKRoster() || { singers: [] };

            // Verify user is registered
            const singerStatus = roster.singers.find(s => s.singer.w2gId === w2gId);
            if (!singerStatus) {
                console.warn(`RoboKJ: Ignored song request from unregistered user ${w2gId}`);
                sendResponse({ success: false, error: 'User is not registered.' });
                return;
            }

            const stageName = singerStatus.singer.stageName;

            // Load singer requests or initialize
            const requests: KSongRequests = await getKSongRequests(stageName) || {
                singer: singerStatus.singer,
                nextIndex: 0,
                requests: []
            };

            // Add the new request
            requests.requests.push(payload);
            await setKSongRequests(stageName, requests);

            console.log(`RoboKJ: Saved song request for ${stageName}. Total requests: ${requests.requests.length}`);

            const show = await getKShow();
            const streamKey = show?.streamKey;

            if (!streamKey) {
                console.warn('RoboKJ: No streamkey available; cannot update room.');
                sendResponse({ success: false, error: 'No streamkey associated with this session. Request saved locally.' });
                return;
            }

            const apiKey = import.meta.env.VITE_W2G_API_KEY;
            if (!apiKey) {
                console.warn('RoboKJ: VITE_W2G_API_KEY is not configured in .env.local');
                sendResponse({ success: false, error: 'Missing API key configuration.' });
                return;
            }

            const apiUrl = `https://api.w2g.tv/rooms/${streamKey}/sync_update`;
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    w2g_api_key: apiKey,
                    item_url: payload.url
                })
            });

            if (!res.ok) {
                throw new Error(`API returned status: ${res.status}`);
            }

            const text = await res.text();
            const data = text ? JSON.parse(text) : { success: true };

            console.log('RoboKJ: Successfully played song via W2G API!', data);
            sendResponse({ success: true, data });

        } catch (error: any) {
            console.error('RoboKJ: Error handling song request:', error);
            sendResponse({ success: false, error: error.toString() });
        }
    }
}
