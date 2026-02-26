
export interface KSinger {
    id: string | null
    w2gId: string
    name: string
}

export interface KSongRequest {
    id: string
    w2gId: string
    title: string
    url: string
}

// --- Message Types ---
// Discriminated Unions make switch statements type-safe
export type MessageAction =
    | { type: 'REGISTER_SINGER'; payload: KSinger }
    | { type: 'ADD_SONG_REQUEST'; w2gId: string; payload: KSongRequest }
    | { type: 'PERFORM_ACTION'; data: string }
    | { type: 'SET_STREAMKEY'; streamkey: string };

export interface MessageResponse {
    success: boolean
    error?: string
    data?: any
}

