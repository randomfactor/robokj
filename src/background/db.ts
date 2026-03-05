import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { KRoster, KShow, KSongRequests } from '../types';

interface RoboKJDBSchema extends DBSchema {
    appState: {
        key: 'roster' | 'show';
        value: KRoster | KShow;
    };
    requests: {
        key: string; // stageName
        value: KSongRequests;
    };
}

const DB_NAME = 'robokjDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<RoboKJDBSchema>> | null = null;

export function initDB() {
    if (!dbPromise) {
        dbPromise = openDB<RoboKJDBSchema>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('appState')) {
                    db.createObjectStore('appState');
                }
                if (!db.objectStoreNames.contains('requests')) {
                    db.createObjectStore('requests');
                }
            },
        });
    }
    return dbPromise;
}

// --- Helper Functions for State Management ---

export async function getKRoster(): Promise<KRoster | undefined> {
    const db = await initDB();
    return (await db.get('appState', 'roster')) as KRoster | undefined;
}

export async function setKRoster(roster: KRoster): Promise<void> {
    const db = await initDB();
    await db.put('appState', roster, 'roster');
}

export async function getKShow(): Promise<KShow | undefined> {
    const db = await initDB();
    return (await db.get('appState', 'show')) as KShow | undefined;
}

export async function setKShow(show: KShow): Promise<void> {
    const db = await initDB();
    await db.put('appState', show, 'show');
}

export async function getKSongRequests(stageName: string): Promise<KSongRequests | undefined> {
    const db = await initDB();
    return await db.get('requests', stageName);
}

export async function setKSongRequests(stageName: string, requests: KSongRequests): Promise<void> {
    const db = await initDB();
    await db.put('requests', requests, stageName);
}

export async function getAllKSongRequests(): Promise<KSongRequests[]> {
    const db = await initDB();
    return await db.getAll('requests');
}

export async function clearAllData(): Promise<void> {
    const db = await initDB();
    const tx = db.transaction(['appState', 'requests'], 'readwrite');
    await tx.objectStore('appState').clear();
    await tx.objectStore('requests').clear();
    await tx.done;
}
