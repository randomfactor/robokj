import { MessageAction, MessageResponse } from '../types';
import { getKRoster, getKSongRequests, setKSongRequests, getKShow, setKShow, clearAllData, getKState, setKState } from './db';
import { seedTestData } from './seed-data';
import { handleAddSongRequest, handleGetRequestList, handleGetQueueForUser, handleDeleteQueueForUser } from './requests';
import { handleGetRoster, handleRegisterSinger, handleRemoveSinger, handleReactivateSinger, handleNextSinger, handleBumpSinger, handleRestartVideo } from './roster';

export interface BackgroundServiceOptions {
    onMessageProcessed?: (message: MessageAction, response: MessageResponse) => void;
}

export class BackgroundService {
    options: BackgroundServiceOptions;
    seedTestData: boolean;
    private _fallbackTimeoutId?: ReturnType<typeof setTimeout>;

    constructor(options: BackgroundServiceOptions = {}) {
        this.options = options;
        this.seedTestData = true;

        if (typeof chrome !== 'undefined' && chrome.alarms) {
            chrome.alarms.onAlarm.addListener((alarm) => {
                if (alarm.name === 'song_timeout') {
                    console.log('RoboKJ: song_timeout alarm fired.');
                    this.checkTimeoutAndRotate();
                }
            });
        }
    }

    private async checkTimeoutAndRotate() {
        try {
            const state = await getKState();
            if (!state || !state.currentSongStartTimeMs || !state.currentSongTimeoutDurationMs) return;
            if (state.mode === 'manual') {
                this.clearSongTimeout();
                return;
            }

            const timeElapsed = Date.now() - state.currentSongStartTimeMs;
            // 1-second buffer leeway
            if (timeElapsed >= state.currentSongTimeoutDurationMs - 1000) {
                console.log('RoboKJ: Maximum song timeout exactly reached! Automatically rotating roster.');
                this.broadcastMessage('Maximum song duration reached. Time’s up!');

                // Block double-firing
                state.currentSongTimeoutDurationMs = 0;
                await setKState(state);

                handleNextSinger(this, () => { });
            } else {
                console.log(`RoboKJ: Timeout check early. Elapsed: ${timeElapsed}ms, Required: ${state.currentSongTimeoutDurationMs}ms`);
            }
        } catch (error) {
            console.error('RoboKJ Context Error:', error);
        }
    }

    public clearSongTimeout() {
        if (typeof chrome !== 'undefined' && chrome.alarms) chrome.alarms.clear('song_timeout');
        if (this._fallbackTimeoutId) clearTimeout(this._fallbackTimeoutId);
    }

    public broadcastMessage(text: string) {
        if (chrome && chrome.tabs && chrome.tabs.query) {
            chrome.tabs.query({ url: "*://*.w2g.tv/*" }, (tabs) => {
                tabs.forEach(t => {
                    if (t.id) {
                        chrome.tabs.sendMessage(t.id, {
                            type: 'BROADCAST_MESSAGE',
                            payload: { text }
                        }).catch(() => { });
                    }
                });
            });
        }
    }

    // Helper to generate a unique ID
    generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    handleMessage(message: MessageAction, sendResponse: (response: MessageResponse) => void): boolean {
        const respond = (response: MessageResponse) => {
            sendResponse(response);
            if (this.options.onMessageProcessed) {
                this.options.onMessageProcessed(message, response);
            }
        };

        if (message.type === 'REGISTER_SINGER') {
            handleRegisterSinger(message.payload, respond);
            return true;
        }
        if (message.type === 'ADD_SONG_REQUEST') {
            handleAddSongRequest(message.w2gId, message.payload, respond);
            return true;
        }
        if (message.type === 'GET_SHOW_INFO') {
            this._handleGetShowInfo(respond);
            return true;
        }
        if (message.type === 'SET_SHOW_INFO') {
            this.handleSetShowInfo(message.payload, respond);
            return true;
        }
        if (message.type === 'GET_ROSTER') {
            handleGetRoster(respond);
            return true;
        }
        if (message.type === 'GET_REQUEST_LIST') {
            handleGetRequestList(message.stageName, respond);
            return true;
        }
        if (message.type === 'GET_QUEUE_FOR_USER') {
            handleGetQueueForUser(message.w2gId, respond);
            return true;
        }
        if (message.type === 'DELETE_QUEUE_FOR_USER') {
            handleDeleteQueueForUser(message.w2gId, respond);
            return true;
        }
        if (message.type === 'REMOVE_SINGER') {
            handleRemoveSinger(message.stageName, respond);
            return true;
        }
        if (message.type === 'REACTIVATE_SINGER') {
            handleReactivateSinger(message.stageName, respond);
            return true;
        }
        if (message.type === 'NEXT_SINGER') {
            handleNextSinger(this, respond);
            return true;
        }
        if (message.type === 'BUMP_SINGER') {
            handleBumpSinger(this, respond);
            return true;
        }
        if (message.type === 'RESTART_VIDEO') {
            getKState().then(state => {
                if (state?.mode === 'manual' && message.payload?.fromChat) {
                    respond({ success: false, error: 'The /restart command is disabled in manual mode.' });
                } else {
                    handleRestartVideo(this, message.payload?.w2gId, respond);
                }
            });
            return true;
        }
        if (message.type === 'SELF_DESTRUCT') {
            this._handleSelfDestruct(respond);
            return true;
        }
        if (message.type === 'VIDEO_ENDED') {
            this._handleVideoEnded(respond);
            return true;
        }
        if (message.type === 'VIDEO_STARTED') {
            console.log('RoboKJ: Received VIDEO_STARTED from content script.');
            this._handleVideoStarted(respond);
            return true;
        }
        if (message.type === 'VIDEO_ERROR') {
            this._handleVideoError(message.payload.errorCode, respond);
            return true;
        }
        if (message.type === 'TOGGLE_MODE') {
            this._handleToggleMode(respond);
            return true;
        }
        if (message.type === 'GET_STATE') {
            getKState().then(state => respond({ success: true, data: state || { mode: 'manual', songsStarted: 0 } }));
            return true;
        }

        return true;
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

    public async handleSetShowInfo(payload: Partial<import('../types').KShow>, sendResponse: (response: MessageResponse) => void) {
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

    private async _handleSelfDestruct(sendResponse: (response: MessageResponse) => void) {
        try {
            await clearAllData();
            console.log('RoboKJ: All IndexedDB data cleared via SELF_DESTRUCT');

            if (this.seedTestData) {
                await seedTestData(this);
            }

            this.broadcastMessage('The database has been cleared.');

            sendResponse({ success: true });
        } catch (error) {
            console.error('RoboKJ: Database error during SELF_DESTRUCT:', error);
            sendResponse({ success: false, error: 'Database error' });
        }
    }

    private async _handleVideoStarted(sendResponse: (response: MessageResponse) => void) {
        try {
            const show = await getKShow();
            const state = await getKState() || { songsStarted: 0, mode: 'manual' as 'auto' | 'manual' };

            if (state.mode === 'manual') {
                console.log('RoboKJ: Manual mode enabled. Ignoring VIDEO_STARTED.');
                sendResponse({ success: true, data: 'Manual mode enabled. Ignoring.' });
                return;
            }

            const maxDuration = show?.maxSongDurationSeconds || 270;
            let restarts = state.currentSongRestartsUsed || 0;

            // Calculate active timeout window based on restarts applied
            const activeTimeout = maxDuration * ((9 - restarts) / 9);

            state.currentSongStartTimeMs = Date.now();
            state.currentSongTimeoutDurationMs = activeTimeout * 1000;
            await setKState(state);

            if (typeof chrome !== 'undefined' && chrome.alarms) {
                chrome.alarms.create('song_timeout', { delayInMinutes: activeTimeout / 60 });
                console.log(`RoboKJ: Set song timeout alarm for ${activeTimeout} seconds.`);
            }

            // Fallback accurate tracking for sub-minute testing windows (where MV3 Alarms fail)
            this.clearSongTimeout();
            this._fallbackTimeoutId = setTimeout(() => this.checkTimeoutAndRotate(), activeTimeout * 1000);

            sendResponse({ success: true });
        } catch (error) {
            console.error('RoboKJ: Error tracking VIDEO_STARTED state:', error);
            sendResponse({ success: false, error: 'Database error' });
        }
    }

    private async _handleVideoEnded(sendResponse: (response: MessageResponse) => void) {
        try {
            const state = await getKState() || { mode: 'manual', songsStarted: 0 };
            if (state.mode === 'auto') {
                console.log('RoboKJ: Auto mode enabled. Triggering next singer automatically on video end.');
                await handleNextSinger(this, sendResponse);
            } else {
                console.log('RoboKJ: Received VIDEO_ENDED, but mode is not auto. Ignoring.');
                sendResponse({ success: true, data: 'Auto mode disabled. No action taken.' });
            }
        } catch (error) {
            console.error('RoboKJ: Database error during VIDEO_ENDED:', error);
            sendResponse({ success: false, error: 'Database error' });
        }
    }

    private async _handleVideoError(errorCode: number, sendResponse: (response: MessageResponse) => void) {
        try {
            console.warn(`RoboKJ: Received VIDEO_ERROR (${errorCode}) from content script.`);
            const state = await getKState() || { mode: 'manual', songsStarted: 0 };
            if (state.mode === 'auto') {
                console.log('RoboKJ: Auto mode enabled. Unplayable video detected. Auto-bumping singer.');

                // Remove the unplayable song request from the active singer's queue
                const roster = await getKRoster();
                if (roster) {
                    const activeSingerStatus = roster.singers.find(s => s.status === 'active');
                    if (activeSingerStatus) {
                        const stageName = activeSingerStatus.singer.stageName;
                        const requests = await getKSongRequests(stageName);
                        if (requests && requests.nextIndex < requests.requests.length) {
                            // Splice deletes the unplayable song, smoothly shifting their queue
                            requests.requests.splice(requests.nextIndex, 1);
                            await setKSongRequests(stageName, requests);
                            console.log(`RoboKJ: Removed unplayable song from ${stageName}'s queue.`);
                        }
                    }
                }

                // Bump the singer
                await handleBumpSinger(this, sendResponse);
            } else {
                console.log('RoboKJ: Received VIDEO_ERROR, but mode is not auto. Ignoring.');
                sendResponse({ success: true, data: 'Auto mode disabled. No action taken.' });
            }
        } catch (error) {
            console.error('RoboKJ: Database error during VIDEO_ERROR:', error);
            sendResponse({ success: false, error: 'Database error' });
        }
    }

    private async _handleToggleMode(sendResponse: (response: MessageResponse) => void) {
        try {
            const state = await getKState() || { songsStarted: 0, mode: 'manual' as 'auto' | 'manual' };
            state.mode = state.mode === 'auto' ? 'manual' : 'auto';
            
            if (state.mode === 'manual') {
                this.clearSongTimeout();
                state.currentSongTimeoutDurationMs = 0;
            }

            await setKState(state);
            console.log(`RoboKJ: Mode toggled to ${state.mode}`);
            sendResponse({ success: true, data: { mode: state.mode } });
        } catch (error) {
            console.error('RoboKJ: Database error during TOGGLE_MODE:', error);
            sendResponse({ success: false, error: 'Database error' });
        }
    }
}
