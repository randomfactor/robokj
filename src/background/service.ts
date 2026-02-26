import { KSinger, MessageAction, MessageResponse } from '../types';

export class BackgroundService {
    singerRoster: KSinger[] = [];
    streamkey: string | null = null;

    // Helper to generate a unique ID
    generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    handleMessage(message: MessageAction, sendResponse: (response: MessageResponse) => void): boolean {
        if (message.type === 'SET_STREAMKEY') {
            this.streamkey = message.streamkey;
            console.log('RoboKJ: Streamkey set to', this.streamkey);
            sendResponse({ success: true });
            return true;
        }
        if (message.type === 'REGISTER_SINGER') {
            const { payload } = message;

            // Check if the w2gId or name already exists in the roster
            const existingSinger = this.singerRoster.find(
                (singer) => singer.w2gId === payload.w2gId || singer.name === payload.name
            );

            if (existingSinger) {
                sendResponse({
                    success: false,
                    error: `Singer with w2gId ${existingSinger.w2gId} or name "${existingSinger.name}" already exists.`,
                });
                return true;
            }

            // Create the new singer, assigning an ID if it's null
            const newSinger: KSinger = {
                id: payload.id || this.generateUniqueId(),
                w2gId: payload.w2gId,
                name: payload.name,
            };

            // Add to the roster
            this.singerRoster.push(newSinger);
            console.log('Singer registered successfully:', newSinger);
            console.log('Current Roster:', this.singerRoster);

            // Respond with success
            sendResponse({
                success: true,
                data: newSinger,
            });
        }
        if (message.type === 'ADD_SONG_REQUEST') {
            console.log('Received song request:', message.payload, 'for w2gId:', message.w2gId);

            // Verify user is registered
            const isRegistered = this.singerRoster.some(singer => singer.w2gId === message.w2gId);
            if (!isRegistered) {
                console.warn(`RoboKJ: Ignored song request from unregistered user ${message.w2gId}`);
                sendResponse({ success: false, error: 'User is not registered.' });
                return true;
            }

            if (!this.streamkey) {
                console.warn('RoboKJ: No streamkey available; cannot update room.');
                sendResponse({ success: false, error: 'No streamkey associated with this session.' });
                return true;
            }

            const apiKey = import.meta.env.VITE_W2G_API_KEY;
            if (!apiKey) {
                console.warn('RoboKJ: VITE_W2G_API_KEY is not configured in .env.local');
                sendResponse({ success: false, error: 'Missing API key configuration.' });
                return true;
            }

            const apiUrl = `https://api.w2g.tv/rooms/${this.streamkey}/sync_update`;
            fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    w2g_api_key: apiKey,
                    item_url: message.payload.url
                })
            })
                .then(async res => {
                    if (!res.ok) {
                        throw new Error(`API returned status: ${res.status}`);
                    }
                    // W2G sync_update often returns an empty 200 OK body. 
                    // Attempting to run res.json() on an empty string throws an error.
                    const text = await res.text();
                    return text ? JSON.parse(text) : { success: true };
                })
                .then(data => {
                    console.log('RoboKJ: Successfully played song via W2G API!', data);
                    sendResponse({ success: true, data });
                })
                .catch(error => {
                    console.error('RoboKJ: Error calling W2G API:', error);
                    sendResponse({ success: false, error: error.toString() });
                });

            return true;
        }

        return true;
    }
}
