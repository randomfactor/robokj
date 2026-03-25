import { MessageResponse, KRoster, KSongRequests } from '../types';
import { getKRoster, setKRoster, getKSongRequests, setKSongRequests } from './db';

export async function handleGetRequestList(stageName: string, sendResponse: (response: MessageResponse) => void) {
    try {
        const requests = await getKSongRequests(stageName);
        sendResponse({ success: true, data: requests || null });
    } catch (error) {
        console.error(`RoboKJ: Database error during GET_REQUEST_LIST for ${stageName}:`, error);
        sendResponse({ success: false, error: 'Database error' });
    }
}

export async function handleGetQueueForUser(w2gId: string, sendResponse: (response: MessageResponse) => void) {
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

export async function handleDeleteQueueForUser(w2gId: string, sendResponse: (response: MessageResponse) => void) {
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

export async function handleAddSongRequest(w2gId: string, payload: any, sendResponse: (response: MessageResponse) => void) {
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
