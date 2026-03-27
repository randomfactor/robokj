import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface RoboKJContentDBSchema extends DBSchema {
    KCurrentState: {
        key: 'counter';
        value: {
            sendCounter: number;
        };
    };
}

const CONTENT_DB_NAME = 'robokjContentDB';
const CONTENT_DB_VERSION = 1;

let contentDbPromise: Promise<IDBPDatabase<RoboKJContentDBSchema>> | null = null;
let sendQueue: Promise<void> = Promise.resolve();

function getContentDb() {
    if (!contentDbPromise) {
        contentDbPromise = openDB<RoboKJContentDBSchema>(CONTENT_DB_NAME, CONTENT_DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('KCurrentState')) {
                    db.createObjectStore('KCurrentState');
                }
            }
        });
    }

    return contentDbPromise;
}

async function nextOutboundToken(): Promise<string> {
    try {
        const db = await getContentDb();
        const current = await db.get('KCurrentState', 'counter');
        const nextCounter = (current?.sendCounter || 0) + 1;
        await db.put('KCurrentState', { sendCounter: nextCounter }, 'counter');
        return `AC${String(nextCounter).padStart(6, '0')}`;
    } catch (error) {
        console.warn('RoboKJ: Failed to load token counter from IndexedDB, using in-memory fallback.', error);
        const fallbackCounter = Date.now() % 1000000;
        return `AC${String(fallbackCounter).padStart(6, '0')}`;
    }
}

async function emitMessage(message: string): Promise<void> {
    const chatInput = document.getElementById('w2g-chat-input') as HTMLInputElement | HTMLTextAreaElement | null;
    if (!chatInput) {
        return;
    }

    const token = await nextOutboundToken();
    const taggedMessage = `${message} ${token}`;

    chatInput.value = taggedMessage;
    chatInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    chatInput.dispatchEvent(new Event('w2gsubmit', { bubbles: true, cancelable: true }));
}

// Function to emit a message into the chat container
export function sendToAll(message: string) {
    sendQueue = sendQueue
        .then(() => emitMessage(message))
        .catch((error) => {
            console.warn('RoboKJ: Failed to emit chat message.', error);
        });
}
