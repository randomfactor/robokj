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

export async function resetOutboundToken(): Promise<void> {
    try {
        const db = await getContentDb();
        await db.put('KCurrentState', { sendCounter: 0 }, 'counter');
        console.log('RoboKJ: Token counter reset to 0 in IndexedDB.');
    } catch (error) {
        console.warn('RoboKJ: Failed to reset token counter.', error);
    }
}

async function emitMessage(message: string): Promise<void> {
    const chatInput = document.getElementById('w2g-chat-input') as HTMLInputElement | HTMLTextAreaElement | null;
    if (!chatInput) {
        return;
    }

    chatInput.value = message;
    chatInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    chatInput.dispatchEvent(new Event('w2gsubmit', { bubbles: true, cancelable: true }));
}

// Function to emit a message into the chat container
export function sendToAll(message: string) {
    sendQueue = sendQueue
        .then(async () => {
            const lines = message.split('\n');
            const token = await nextOutboundToken();
            lines[0] = `${lines[0]} ${token}`;

            for (const line of lines) {
                await emitMessage(line);
            }
        })
        .catch((error) => {
            console.warn('RoboKJ: Failed to emit chat message.', error);
        });
}
