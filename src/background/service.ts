import { KSinger, MessageAction, MessageResponse, KRoster, KSingerStatus, KSongRequests } from '../types';
import { getKRoster, setKRoster, getKSongRequests, setKSongRequests, getKShow, setKShow, clearAllData } from './db';

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
        if (message.type === 'GET_REQUEST_LIST') {
            this._handleGetRequestList(message.stageName, respond);
            return true;
        }
        if (message.type === 'REMOVE_SINGER') {
            this._handleRemoveSinger(message.stageName, respond);
            return true;
        }
        if (message.type === 'SELF_DESTRUCT') {
            this._handleSelfDestruct(respond);
            return true;
        }

        return true;
    }

    private async _handleRemoveSinger(stageName: string, sendResponse: (response: MessageResponse) => void) {
        try {
            const roster = await getKRoster();
            if (!roster) {
                sendResponse({ success: false, error: 'No roster found' });
                return;
            }

            const singerStatus = roster.singers.find(s => s.singer.stageName === stageName);

            if (!singerStatus) {
                sendResponse({ success: false, error: 'Singer not found in roster' });
                return;
            }

            singerStatus.status = 'ignored';
            await setKRoster(roster);
            console.log(`RoboKJ: Successfully set ${stageName} status to 'ignored'.`);
            sendResponse({ success: true });
        } catch (error) {
            console.error(`RoboKJ: Database error during REMOVE_SINGER for ${stageName}:`, error);
            sendResponse({ success: false, error: 'Database error' });
        }
    }

    private async _handleGetRequestList(stageName: string, sendResponse: (response: MessageResponse) => void) {
        try {
            const requests = await getKSongRequests(stageName);
            sendResponse({ success: true, data: requests || null });
        } catch (error) {
            console.error(`RoboKJ: Database error during GET_REQUEST_LIST for ${stageName}:`, error);
            sendResponse({ success: false, error: 'Database error' });
        }
    }

    private async _handleSelfDestruct(sendResponse: (response: MessageResponse) => void) {
        try {
            await clearAllData();
            console.log('RoboKJ: All IndexedDB data cleared via SELF_DESTRUCT');
            sendResponse({ success: true });
        } catch (error) {
            console.error('RoboKJ: Database error during SELF_DESTRUCT:', error);
            sendResponse({ success: false, error: 'Database error' });
        }
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
                if (existingSingerStatus.status === 'ignored') {
                    sendResponse({
                        success: false,
                        error: 'ignored',
                        data: { stageName: existingSingerStatus.singer.stageName }
                    });
                } else {
                    sendResponse({
                        success: false,
                        error: 'active',
                        data: { w2gId: existingSingerStatus.singer.w2gId, stageName: existingSingerStatus.singer.stageName }
                    });
                }
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

            // Calculate pending requests
            const pendingRequests = requests.requests.length - requests.nextIndex;

            if (pendingRequests >= 5) {
                console.warn(`RoboKJ: Singer ${stageName} has reached the 5 request limit.`);
                sendResponse({ success: false, error: 'limit_reached', data: { stageName } });
                return;
            }

            // Global duplicate check across all singers (past and present queue)
            let isDuplicate = false;
            for (const rosterSinger of roster.singers) {
                const singerRequests = await getKSongRequests(rosterSinger.singer.stageName);
                if (singerRequests && singerRequests.requests.some(req => req.url === payload.url)) {
                    isDuplicate = true;
                    break;
                }
            }

            if (isDuplicate) {
                console.warn(`RoboKJ: Song ${payload.url} is already requested/performed in this show.`);
                sendResponse({ success: false, error: 'duplicate', data: { stageName, title: payload.title } });
                return;
            }

            // Add the new request
            requests.requests.push(payload);
            await setKSongRequests(stageName, requests);

            console.log(`RoboKJ: Saved song request for ${stageName}. Pending requests: ${pendingRequests + 1}`);

            // Just return success. We no longer auto-play it here.
            sendResponse({ success: true, data: { stageName, title: payload.title, count: pendingRequests + 1 } });

        } catch (error: any) {
            console.error('RoboKJ: Error handling song request:', error);
            sendResponse({ success: false, error: 'Database error' });
        }
    }
}
