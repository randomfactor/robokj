export { }
// Background service worker
import { MessageAction, MessageResponse } from '../types';
import { BackgroundService } from './service';

const service = new BackgroundService();

chrome.runtime.onMessage.addListener(
    (message: MessageAction, _sender, sendResponse: (response: MessageResponse) => void) => {
        return service.handleMessage(message, sendResponse);
    }
);
console.log('Background service worker initialized.');
