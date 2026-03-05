
export interface KSinger {
    w2gId: string
    stageName: string
}

export interface KSingerStatus {
    singer: KSinger
    status: 'active' | 'ignored'
    bumpCount: number
}

// IndexedDB key: "roster"
export interface KRoster {
    singers: KSingerStatus[]
}

export interface KSongRequest {
    title: string
    url: string
}

// IndexedDB key: "stageName"
export interface KSongRequests {
    singer: KSinger
    nextIndex: number
    requests: KSongRequest[]
}

// IndexedDB key: "show"
export interface KShow {
    venueName: string
    startTimeUTC: string
    durationInHours: number
    streamKey: string
    mode: 'auto' | 'manual'
}

// --- Message Types ---
// Discriminated Unions make switch statements type-safe
export type MessageAction =
    | { type: 'REGISTER_SINGER'; payload: KSinger }
    | { type: 'ADD_SONG_REQUEST'; w2gId: string; payload: KSongRequest }
    | { type: 'PERFORM_ACTION'; data: string }
    | { type: 'GET_SHOW_INFO' }
    | { type: 'SET_SHOW_INFO'; payload: Partial<KShow> }
    | { type: 'GET_ROSTER' };

export interface MessageResponse {
    success: boolean
    error?: string
    data?: any
}

