import { MessageResponse, KRoster, KSinger, KSingerStatus } from '../types';
import { getKRoster, setKRoster, getKSongRequests, setKSongRequests, getKShow, getKState, setKState } from './db';
import { BackgroundService } from './service';

export async function handleGetRoster(sendResponse: (response: MessageResponse) => void) {
    try {
        const roster = await getKRoster();
        sendResponse({ success: true, data: roster?.singers || [] });
    } catch (error) {
        console.error('RoboKJ: Database error during GET_ROSTER:', error);
        sendResponse({ success: false, error: 'Database error' });
    }
}

export async function handleRegisterSinger(payload: KSinger, sendResponse: (response: MessageResponse) => void) {
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

export async function handleRemoveSinger(stageName: string, sendResponse: (response: MessageResponse) => void) {
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

export async function handleReactivateSinger(stageName: string, sendResponse: (response: MessageResponse) => void) {
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

export async function playCurrentSong(roster: KRoster, sendResponse: (response: MessageResponse) => void, announceSingers: boolean = false) {
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
            onStageSong: currentSong?.title,
            nextUp: activeSingers[1]?.singer.stageName,
            afterThat: activeSingers[2]?.singer.stageName
        };

        // Safely push announcement to any active W2G tabs directly from the background service
        if (announceSingers && chrome && chrome.tabs && chrome.tabs.query) {
            chrome.tabs.query({ url: "*://*.w2g.tv/*" }, (tabs) => {
                tabs.forEach(t => {
                    if (t.id) {
                        chrome.tabs.sendMessage(t.id, {
                            type: 'ANNOUNCE_SINGERS',
                            payload: announce
                        }).catch(() => { });
                    }
                });
            });
        }

        sendResponse({ success: true, data: announce });
    } catch (error: any) {
        console.error('RoboKJ: Error playing song via W2G API:', error);
        sendResponse({ success: false, error: error.toString() });
    }
}

export async function handleNextSinger(service: BackgroundService, sendResponse: (response: MessageResponse) => void) {
    try {
        const roster = await getKRoster();
        const state = await getKState() || { songsStarted: 0 };

        if (!roster) {
            service.broadcastMessage('There are no active singers in the roster.');
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
        }

        // Find the *new* (or existing first) current singer
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
            service.broadcastMessage('There are no active singers in the roster.');
            sendResponse({ success: false, error: 'No active singers left with songs in their queue.' });
            return;
        }

        // Whenever we rotate singers or forcefully progress, clear any pending timeouts
        service.clearSongTimeout();
        state.currentSongTimeoutDurationMs = 0;
        state.currentSongRestartsUsed = 0;

        // Increment the counter so subsequent clicks rotate properly
        state.songsStarted += 1;
        await setKState(state);

        // Start the next song
        await playCurrentSong(roster, sendResponse, true);

    } catch (error) {
        console.error(`RoboKJ: Database error during NEXT_SINGER:`, error);
        sendResponse({ success: false, error: 'Database error' });
    }
}

export async function handleBumpSinger(service: BackgroundService, sendResponse: (response: MessageResponse) => void) {
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
        service.clearSongTimeout();
        
        if (state) {
            state.currentSongTimeoutDurationMs = 0;
            state.currentSongRestartsUsed = 0;
            await setKState(state);
        }
        await playCurrentSong(roster, sendResponse, true);

    } catch (error) {
        console.error(`RoboKJ: Database error during BUMP_SINGER:`, error);
        sendResponse({ success: false, error: 'Database error' });
    }
}

export async function handleRestartVideo(service: BackgroundService, w2gId: string | undefined, sendResponse: (response: MessageResponse) => void) {
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

        // Check if chat sender matches the current singer
        if (w2gId && currentSingerStatus.singer.w2gId !== w2gId) {
            console.warn(`RoboKJ: Restart command ignored. Sender ${w2gId} is not the current singer.`);
            sendResponse({ success: false, error: 'You are not the current singer on stage.' });
            return;
        }

        const state = await getKState();
        if (state) {
            const maxDuration = (await getKShow())?.maxSongDurationSeconds || 270;
            let restarts = state.currentSongRestartsUsed || 0;
            
            // If triggered by a user via chat, enforce the timeout window rules
            if (w2gId) {
                if (restarts >= 2) {
                    service.broadcastMessage(`@${currentSingerStatus.singer.stageName}, you have already used your maximum allowed restarts.`);
                    sendResponse({ success: false, error: 'Maximum restarts used.' });
                    return;
                }
                
                const timeElapsedMs = Date.now() - (state.currentSongStartTimeMs || 0);
                const allowedWindowMs = (maxDuration / 9) * 1000;
                
                if (timeElapsedMs > allowedWindowMs) {
                    service.broadcastMessage(`Too late to restart! (${Math.floor(timeElapsedMs / 1000)}s exceeds the ${Math.floor(allowedWindowMs / 1000)}s limit)`);
                    sendResponse({ success: false, error: 'Too late to restart.' });
                    return;
                }
            }
            
            // Increment restarts for BOTH manual KJ and chat commands, so the timer shrinks correctly
            state.currentSongRestartsUsed = restarts + 1;
            state.currentSongTimeoutDurationMs = 0; // invalidate old timer block
            await setKState(state);
            
            service.clearSongTimeout();
        }

        // Increment bump count
        currentSingerStatus.bumpCount++;
        await setKRoster(roster);

        console.log(`RoboKJ: Restarting video for ${currentSingerStatus.singer.stageName}. Bump count is now ${currentSingerStatus.bumpCount}`);

        // Re-play the current song
        await playCurrentSong(roster, sendResponse);

    } catch (error) {
        console.error(`RoboKJ: Database error during RESTART_VIDEO:`, error);
        sendResponse({ success: false, error: 'Database error' });
    }
}
