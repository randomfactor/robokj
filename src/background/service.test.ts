import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { BackgroundService } from './service';
import { MessageAction, MessageResponse } from '../types';

/** Helper to wrap handleMessage in a Promise so we can await the async DB processing */
function sendMessage(service: BackgroundService, message: MessageAction): Promise<MessageResponse> {
    return new Promise((resolve) => {
        const originalOnMessage = service.options.onMessageProcessed;
        service.options.onMessageProcessed = (msg, resp) => {
            if (originalOnMessage) {
                originalOnMessage(msg, resp);
            }
            resolve(resp);
        };
        service.handleMessage(message, () => {
            // we rely on onMessageProcessed to be called, which our service does internally.
        });
    });
}

describe('BackgroundService with IndexedDB', () => {
    let service: BackgroundService;

    beforeEach(() => {
        // reset the state
        service = new BackgroundService({});
    });

    it('should register a new singer asynchronously', async () => {
        const message: MessageAction = {
            type: 'REGISTER_SINGER',
            payload: {
                w2gId: 'w2g-user-1',
                stageName: 'AliceAsync'
            }
        };

        const response = await sendMessage(service, message);
        expect(response.success).toBe(true);
        expect(response.data.stageName).toBe('AliceAsync');
        expect(response.data.w2gId).toBe('w2g-user-1');

        // try registering duplicates
        const msgConflict: MessageAction = {
            type: 'REGISTER_SINGER',
            payload: {
                w2gId: 'w2g-user-1',
                stageName: 'Bob' // duplicate ID
            }
        };
        const responseConflict = await sendMessage(service, msgConflict);
        expect(responseConflict.success).toBe(false);
        expect(responseConflict.error).toContain('already exists');
    });

    it('should handle SET_SHOW_INFO and GET_SHOW_INFO data operations', async () => {
        // Initial state should be fetched and defaults applied during the first SET or we just update defaults
        const msgSet: MessageAction = {
            type: 'SET_SHOW_INFO',
            payload: {
                venueName: 'The Karaoke Bar',
                durationInHours: 5,
                streamKey: 'secretstream'
            }
        };

        const setResponse = await sendMessage(service, msgSet);
        expect(setResponse.success).toBe(true);
        expect(setResponse.data.venueName).toBe('The Karaoke Bar');
        expect(setResponse.data.durationInHours).toBe(5);
        expect(setResponse.data.streamKey).toBe('secretstream');
        expect(setResponse.data.mode).toBe('manual'); // from defaults

        const msgGet: MessageAction = {
            type: 'GET_SHOW_INFO'
        };

        const getResponse = await sendMessage(service, msgGet);
        expect(getResponse.success).toBe(true);
        expect(getResponse.data).not.toBeNull();
        expect(getResponse.data.venueName).toBe('The Karaoke Bar');
        expect(getResponse.data.durationInHours).toBe(5);
        expect(getResponse.data.streamKey).toBe('secretstream');
    });
});
