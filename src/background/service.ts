import { KSinger, MessageAction, MessageResponse, KRoster, KSingerStatus, KSongRequests } from '../types';
import { getKRoster, setKRoster, getKSongRequests, setKSongRequests, getKShow, setKShow, clearAllData, getKState, setKState } from './db';

// To ease testing of expected asynchronous operations
export interface BackgroundServiceOptions {
    onMessageProcessed?: (message: MessageAction, response: MessageResponse) => void;
}

export class BackgroundService {
    options: BackgroundServiceOptions;
    seedTestData: boolean;

    constructor(options: BackgroundServiceOptions = {}) {
        this.options = options;
        this.seedTestData = true;
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
        if (message.type === 'GET_QUEUE_FOR_USER') {
            this._handleGetQueueForUser(message.w2gId, respond);
            return true;
        }
        if (message.type === 'DELETE_QUEUE_FOR_USER') {
            this._handleDeleteQueueForUser(message.w2gId, respond);
            return true;
        }
        if (message.type === 'REMOVE_SINGER') {
            this._handleRemoveSinger(message.stageName, respond);
            return true;
        }
        if (message.type === 'REACTIVATE_SINGER') {
            this._handleReactivateSinger(message.stageName, respond);
            return true;
        }
        if (message.type === 'NEXT_SINGER') {
            this._handleNextSinger(respond);
            return true;
        }
        if (message.type === 'BUMP_SINGER') {
            this._handleBumpSinger(respond);
            return true;
        }
        if (message.type === 'RESTART_VIDEO') {
            this._handleRestartVideo(respond);
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

    private async _handleGetQueueForUser(w2gId: string, sendResponse: (response: MessageResponse) => void) {
        try {
            const roster = await getKRoster();
            if (!roster) {
                sendResponse({ success: false, error: 'No roster found' });
                return;
            }
            const singerStatus = roster.singers.find(s => s.singer.w2gId === w2gId);
            if (!singerStatus) {
                sendResponse({ success: false, error: 'User is not registered.' });
                return;
            }

            const stageName = singerStatus.singer.stageName;
            const requests = await getKSongRequests(stageName);

            sendResponse({ success: true, data: { stageName, requests } });
        } catch (error) {
            console.error(`RoboKJ: Database error during GET_QUEUE_FOR_USER for ${w2gId}:`, error);
            sendResponse({ success: false, error: 'Database error' });
        }
    }

    private async _handleDeleteQueueForUser(w2gId: string, sendResponse: (response: MessageResponse) => void) {
        try {
            const roster = await getKRoster();
            if (!roster) {
                sendResponse({ success: false, error: 'No roster found' });
                return;
            }
            const singerStatus = roster.singers.find(s => s.singer.w2gId === w2gId);
            if (!singerStatus) {
                sendResponse({ success: false, error: 'User is not registered.' });
                return;
            }
            
            const stageName = singerStatus.singer.stageName;
            const requests = await getKSongRequests(stageName);
            
            if (requests) {
                requests.requests = requests.requests.slice(0, requests.nextIndex);
                await setKSongRequests(stageName, requests);
            }
            
            sendResponse({ success: true, data: { stageName } });
        } catch (error) {
            console.error(`RoboKJ: Database error during DELETE_QUEUE_FOR_USER for ${w2gId}:`, error);
            sendResponse({ success: false, error: 'Database error' });
        }
    }

    private async _seedTestData() {
        const seedShow = {
            venueName: 'Seed Dev2',
            streamKey: 'iid2362wq6yvwxhkw5', // https://w2g.tv/?r=iid2362wq6yvwxhkw5
            mode: 'manual' as const,
            durationInHours: 4
        };

        const seedSingers = [
            { w2gId: 'admin', stageName: 'Adam' },
            { w2gId: 'User-RJMHU', stageName: 'Brad' },
            { w2gId: 'User-KQAZU', stageName: 'Chad' }
        ];

        const seedRequests = [
            { w2gId: 'admin', title: 'Countdown 09', url: 'https://youtu.be/Lg7OimPUjt8' },
            { w2gId: 'User-RJMHU', title: 'Countdown 11', url: 'https://youtu.be/IG_ThYspaJA' },
            { w2gId: 'User-RJMHU', title: 'Countdown 08', url: 'https://youtu.be/3XOQjkNyoIg' },
            { w2gId: 'User-KQAZU', title: 'Countdown 12', url: 'https://youtu.be/5ymwMWajK0k' },
            { w2gId: 'User-KQAZU', title: 'Countdown 10', url: 'https://youtu.be/lYuuW0moz50' },
            { w2gId: 'User-KQAZU', title: 'Dizz Knee Land', url: 'https://www.youtube.com/watch?v=WpS67Qjialc' }
        ];

        // Seed Show
        await new Promise((resolve) => this._handleSetShowInfo(seedShow, resolve));

        // Seed Singers sequentially
        for (const singer of seedSingers) {
            await new Promise((resolve) => this._handleRegisterSinger(singer, resolve as any));
        }

        // Seed Requests sequentially
        for (const req of seedRequests) {
            await new Promise((resolve) => this._handleAddSongRequest(req.w2gId, { title: req.title, url: req.url }, resolve as any));
        }
    }

    private async _handleSelfDestruct(sendResponse: (response: MessageResponse) => void) {
        try {
            await clearAllData();
            console.log('RoboKJ: All IndexedDB data cleared via SELF_DESTRUCT');

            if (this.seedTestData) {
                await this._seedTestData();
            }

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

            // Auto-reactivate ignored singers into the back of the active roster if they queue a song
            if (singerStatus.status === 'ignored') {
                singerStatus.status = 'active';
                roster.singers = roster.singers.filter(s => s.singer.stageName !== stageName);
                roster.singers.push(singerStatus);
                await setKRoster(roster);
                console.log(`RoboKJ: Reactivated ignored singer ${stageName} because they queued a song.`);
            }

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

    private async _playCurrentSong(roster: KRoster, sendResponse: (response: MessageResponse) => void) {
        // Find first active singer
        const currentSingerStatus = roster.singers.find(s => s.status === 'active');
        if (!currentSingerStatus) {
            sendResponse({ success: false, error: 'No active singers in the roster.' });
            return;
        }

        const stageName = currentSingerStatus.singer.stageName;
        const requests = await getKSongRequests(stageName);

        if (!requests || requests.nextIndex >= requests.requests.length) {
            // Should not happen due to NEXT_SINGER loop, but just in case
            sendResponse({ success: false, error: `Singer ${stageName} has no songs left.` });
            return;
        }

        const currentSong = requests.requests[requests.nextIndex];

        // Play the video via W2G API
        try {
            const show = await getKShow();
            const streamKey = show?.streamKey;

            if (!streamKey) {
                console.warn('RoboKJ: No streamkey available; cannot update room.');
                sendResponse({ success: false, error: 'No streamkey associated with this session. Roster updated locally.' });
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
                    item_url: currentSong.url
                })
            });

            if (!res.ok) {
                throw new Error(`API returned status: ${res.status}`);
            }

            const text = await res.text();
            const data = text ? JSON.parse(text) : { success: true };
            console.log(`RoboKJ: Successfully played song for ${stageName} via W2G API!`, data);
            
            const activeSingers = roster.singers.filter(s => s.status === 'active');
            const announce = {
                onStage: activeSingers[0]?.singer.stageName,
                nextUp: activeSingers[1]?.singer.stageName,
                afterThat: activeSingers[2]?.singer.stageName
            };
            
            sendResponse({ success: true, data: announce });
        } catch (error: any) {
            console.error('RoboKJ: Error playing song via W2G API:', error);
            sendResponse({ success: false, error: error.toString() });
        }
    }
    private async _handleNextSinger(sendResponse: (response: MessageResponse) => void) {
        try {
            const roster = await getKRoster();
            const state = await getKState() || { songsStarted: 0 };

            if (!roster) {
                sendResponse({ success: false, error: 'No roster found' });
                return;
            }

            const isFirstSongOfShow = state.songsStarted === 0;

            if (!isFirstSongOfShow) {
                // Find current active singer index
                const currentIndex = roster.singers.findIndex(s => s.status === 'active');

                if (currentIndex === -1) {
                    sendResponse({ success: false, error: 'No active singers in the roster.' });
                    return;
                }

                // Move the current singer to the end of the roster, reset bump count
                const currentSingerStatus = roster.singers[currentIndex];
                roster.singers.splice(currentIndex, 1);
                currentSingerStatus.bumpCount = 0;
                roster.singers.push(currentSingerStatus);

                // Increment their song request index
                const prevStageName = currentSingerStatus.singer.stageName;
                const requests = await getKSongRequests(prevStageName);
                if (requests) {
                    requests.nextIndex++;
                    await setKSongRequests(prevStageName, requests);
                }

                // Find the *new* current singer
                let nextValidFound = false;
                while (!nextValidFound) {
                    const newCurrentIndex = roster.singers.findIndex(s => s.status === 'active');
                    if (newCurrentIndex === -1) {
                        break; // Roster is empty of active singers
                    }

                    const candidateStatus = roster.singers[newCurrentIndex];
                    const candidateStageName = candidateStatus.singer.stageName;
                    const candidateRequests = await getKSongRequests(candidateStageName);

                    if (!candidateRequests || candidateRequests.nextIndex >= candidateRequests.requests.length) {
                        // This singer is out of songs. Set to ignored.
                        candidateStatus.status = 'ignored';
                        console.log(`RoboKJ: Singer ${candidateStageName} ran out of songs and is now 'ignored'`);
                    } else {
                        nextValidFound = true;
                    }
                }

                await setKRoster(roster);

                if (!nextValidFound) {
                    sendResponse({ success: false, error: 'No active singers left with songs in their queue.' });
                    return;
                }
            }

            // Increment the counter so subsequent clicks rotate properly
            state.songsStarted += 1;
            await setKState(state);

            // Start the next song
            await this._playCurrentSong(roster, sendResponse);

        } catch (error) {
            console.error(`RoboKJ: Database error during NEXT_SINGER:`, error);
            sendResponse({ success: false, error: 'Database error' });
        }
    }

    private async _handleBumpSinger(sendResponse: (response: MessageResponse) => void) {
        try {
            const roster = await getKRoster();
            if (!roster) {
                sendResponse({ success: false, error: 'No roster found' });
                return;
            }

            const currentIndex = roster.singers.findIndex(s => s.status === 'active');
            if (currentIndex === -1) {
                sendResponse({ success: false, error: 'No active singers in the roster.' });
                return;
            }

            // Extract the bumped singer
            const bumpedSingerStatus = roster.singers[currentIndex];
            roster.singers.splice(currentIndex, 1);

            // Increment bump count
            bumpedSingerStatus.bumpCount++;

            if (bumpedSingerStatus.bumpCount >= 2) {
                // Move to end of roster and reset
                bumpedSingerStatus.bumpCount = 0;
                roster.singers.push(bumpedSingerStatus);
                console.log(`RoboKJ: Singer ${bumpedSingerStatus.singer.stageName} was bumped twice and moved to end of roster.`);
            } else {
                // Insert after the *new* current singer
                // Look for the next active singer to insert behind
                const newCurrentIndex = roster.singers.findIndex(s => s.status === 'active');
                if (newCurrentIndex === -1) {
                    // If no one else is active, they just go back to the only active slot.
                    roster.singers.push(bumpedSingerStatus);
                } else {
                    // Insert directly after the next active singer
                    // Find the actual array index of the next active singer + 1
                    let insertIndex = newCurrentIndex + 1;

                    // Edge case: if the next active singer is at the end of the array
                    if (insertIndex > roster.singers.length) {
                        roster.singers.push(bumpedSingerStatus);
                    } else {
                        roster.singers.splice(insertIndex, 0, bumpedSingerStatus);
                    }
                }
                console.log(`RoboKJ: Singer ${bumpedSingerStatus.singer.stageName} was bumped (Count: 1).`);
            }

            // Look for the next valid active singer who actually has songs queued!
            let nextValidFound = false;
            while (!nextValidFound) {
                const newCurrentIndex = roster.singers.findIndex(s => s.status === 'active');
                if (newCurrentIndex === -1) {
                    break; // Roster is empty of active singers
                }

                const candidateStatus = roster.singers[newCurrentIndex];
                const candidateStageName = candidateStatus.singer.stageName;
                const candidateRequests = await getKSongRequests(candidateStageName);

                if (!candidateRequests || candidateRequests.nextIndex >= candidateRequests.requests.length) {
                    // This singer is out of songs. Set to ignored.
                    candidateStatus.status = 'ignored';
                    console.log(`RoboKJ: Singer ${candidateStageName} ran out of songs and is now 'ignored' during bump.`);
                } else {
                    nextValidFound = true;
                }
            }

            await setKRoster(roster);

            const state = await getKState() || { songsStarted: 0 };
            if (state.songsStarted === 0) {
                state.songsStarted = 1;
                await setKState(state);
            }

            if (!nextValidFound) {
                sendResponse({ success: false, error: 'No active singers left with songs after bump.' });
                return;
            }

            // Play the next person's song safely now that we confirmed they have one
            await this._playCurrentSong(roster, sendResponse);

        } catch (error) {
            console.error(`RoboKJ: Database error during BUMP_SINGER:`, error);
            sendResponse({ success: false, error: 'Database error' });
        }
    }

    private async _handleRestartVideo(sendResponse: (response: MessageResponse) => void) {
        try {
            const roster = await getKRoster();
            if (!roster) {
                sendResponse({ success: false, error: 'No roster found' });
                return;
            }

            const currentSingerStatus = roster.singers.find(s => s.status === 'active');
            if (!currentSingerStatus) {
                sendResponse({ success: false, error: 'No active singers in the roster.' });
                return;
            }

            // Increment bump count
            currentSingerStatus.bumpCount++;
            await setKRoster(roster);

            console.log(`RoboKJ: Restarting video for ${currentSingerStatus.singer.stageName}. Bump count is now ${currentSingerStatus.bumpCount}`);

            // Re-play the current song
            await this._playCurrentSong(roster, sendResponse);

        } catch (error) {
            console.error(`RoboKJ: Database error during RESTART_VIDEO:`, error);
            sendResponse({ success: false, error: 'Database error' });
        }
    }

    private async _handleReactivateSinger(stageName: string, sendResponse: (response: MessageResponse) => void) {
        try {
            const roster = await getKRoster();
            if (!roster) {
                sendResponse({ success: false, error: 'No roster found' });
                return;
            }

            const index = roster.singers.findIndex(s => s.singer.stageName === stageName);

            if (index === -1) {
                sendResponse({ success: false, error: 'Singer not found in roster' });
                return;
            }

            const singerStatus = roster.singers[index];
            if (singerStatus.status !== 'ignored') {
                sendResponse({ success: false, error: 'Singer is not currently ignored' });
                return;
            }

            // Reactivate and move to end of roster
            singerStatus.status = 'active';
            roster.singers.splice(index, 1);
            roster.singers.push(singerStatus);

            await setKRoster(roster);
            console.log(`RoboKJ: Successfully reactivated ${stageName}.`);
            sendResponse({ success: true });
        } catch (error) {
            console.error(`RoboKJ: Database error during REACTIVATE_SINGER for ${stageName}:`, error);
            sendResponse({ success: false, error: 'Database error' });
        }
    }
}
