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
        expect(responseConflict.error).toContain('active');
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

    it('should enforce configurable singer request limits and validate bounds', async () => {
        // 1. Verify invalid bounds (at least 1, less than 100)
        const msgSetInvalidLow: MessageAction = {
            type: 'SET_SHOW_INFO',
            payload: {
                maxSingerRequests: 0
            }
        };
        const resInvalidLow = await sendMessage(service, msgSetInvalidLow);
        expect(resInvalidLow.success).toBe(false);
        expect(resInvalidLow.error).toBe('Max requests must be between 1 and 99.');

        const msgSetInvalidHigh: MessageAction = {
            type: 'SET_SHOW_INFO',
            payload: {
                maxSingerRequests: 100
            }
        };
        const resInvalidHigh = await sendMessage(service, msgSetInvalidHigh);
        expect(resInvalidHigh.success).toBe(false);
        expect(resInvalidHigh.error).toBe('Max requests must be between 1 and 99.');

        const msgSetInvalidFloat: MessageAction = {
            type: 'SET_SHOW_INFO',
            payload: {
                maxSingerRequests: 5.5
            }
        };
        const resInvalidFloat = await sendMessage(service, msgSetInvalidFloat);
        expect(resInvalidFloat.success).toBe(false);
        expect(resInvalidFloat.error).toBe('Max requests must be between 1 and 99.');

        // 2. Set valid limit to 2
        const msgSetValid: MessageAction = {
            type: 'SET_SHOW_INFO',
            payload: {
                maxSingerRequests: 2
            }
        };
        const resValid = await sendMessage(service, msgSetValid);
        expect(resValid.success).toBe(true);
        expect(resValid.data.maxSingerRequests).toBe(2);

        // 3. Register a singer
        const w2gId = 'w2g-user-limit-test';
        await sendMessage(service, {
            type: 'REGISTER_SINGER',
            payload: {
                w2gId,
                stageName: 'LimitTester'
            }
        });

        // 4. Send 1st song request (should succeed)
        const resSong1 = await sendMessage(service, {
            type: 'ADD_SONG_REQUEST',
            w2gId,
            payload: {
                title: 'Song 1',
                url: 'https://www.youtube.com/watch?v=111'
            }
        });
        expect(resSong1.success).toBe(true);
        expect(resSong1.data.count).toBe(1);
        expect(resSong1.data.limit).toBe(2);

        // 5. Send 2nd song request (should succeed)
        const resSong2 = await sendMessage(service, {
            type: 'ADD_SONG_REQUEST',
            w2gId,
            payload: {
                title: 'Song 2',
                url: 'https://www.youtube.com/watch?v=222'
            }
        });
        expect(resSong2.success).toBe(true);
        expect(resSong2.data.count).toBe(2);
        expect(resSong2.data.limit).toBe(2);

        // 6. Send 3rd song request (should fail due to limit_reached)
        const resSong3 = await sendMessage(service, {
            type: 'ADD_SONG_REQUEST',
            w2gId,
            payload: {
                title: 'Song 3',
                url: 'https://www.youtube.com/watch?v=333'
            }
        });
        expect(resSong3.success).toBe(false);
        expect(resSong3.error).toBe('limit_reached');
        expect(resSong3.data.limit).toBe(2);

        // 7. Update limit to 3
        await sendMessage(service, {
            type: 'SET_SHOW_INFO',
            payload: {
                maxSingerRequests: 3
            }
        });

        // 8. Try sending 3rd song request again (should now succeed)
        const resSong3Retry = await sendMessage(service, {
            type: 'ADD_SONG_REQUEST',
            w2gId,
            payload: {
                title: 'Song 3',
                url: 'https://www.youtube.com/watch?v=333'
            }
        });
        expect(resSong3Retry.success).toBe(true);
        expect(resSong3Retry.data.count).toBe(3);
        expect(resSong3Retry.data.limit).toBe(3);
    });
});
