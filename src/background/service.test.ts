import { describe, it, expect, beforeEach } from 'vitest';
import { BackgroundService } from './service';
import { MessageAction } from '../types';

describe('BackgroundService', () => {
    let service: BackgroundService;

    beforeEach(() => {
        service = new BackgroundService();
    });

    it('should register a new singer', () => {
        let responseData: any = null;
        const mockSendResponse = (response: any) => {
            responseData = response;
        };

        const message: MessageAction = {
            type: 'REGISTER_SINGER',
            payload: {
                id: null,
                w2gId: 'w2g-123',
                name: 'Alice'
            }
        };

        const result = service.handleMessage(message, mockSendResponse);

        expect(result).toBe(true);
        expect(responseData).not.toBeNull();
        expect(responseData.success).toBe(true);
        expect(responseData.data.name).toBe('Alice');
        expect(responseData.data.w2gId).toBe('w2g-123');
        expect(responseData.data.id).toBeDefined();

        expect(service.singerRoster.length).toBe(1);
        expect(service.singerRoster[0].name).toBe('Alice');
    });

    it('should not register a singer with duplicate w2gId or name', () => {
        service.singerRoster.push({
            id: 'existing-id',
            w2gId: 'w2g-123',
            name: 'Alice'
        });

        let responseData: any = null;
        const mockSendResponse = (response: any) => {
            responseData = response;
        };

        const message: MessageAction = {
            type: 'REGISTER_SINGER',
            payload: {
                id: null,
                w2gId: 'w2g-123', // duplicate w2gId
                name: 'Bob'
            }
        };

        service.handleMessage(message, mockSendResponse);

        expect(responseData.success).toBe(false);
        expect(responseData.error).toContain('already exists');
        expect(service.singerRoster.length).toBe(1); // Not added
    });
});
