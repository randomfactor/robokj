import { useState, useEffect } from 'react';
import ListItem from '../components/ListItem';

function formatUTCToLocalDateTimeInput(utcISOString?: string): string {
    if (!utcISOString) return '';

    const date = new Date(utcISOString);
    if (Number.isNaN(date.getTime())) return '';

    const pad2 = (value: number) => String(value).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad2(date.getMonth() + 1);
    const day = pad2(date.getDate());
    const hours = pad2(date.getHours());
    const minutes = pad2(date.getMinutes());

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseLocalDateTimeInputToUTC(localDateTime: string): string {
    if (!localDateTime) return '';

    const date = new Date(localDateTime);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function App() {
    const [inviteLink, setInviteLink] = useState('');
    const [showInfo, setShowInfo] = useState({
        venueName: '',
        startTimeUTC: '',
        durationInHours: 4,
        streamKey: '',
        maxSongDurationSeconds: 270,
        maxSingerRequests: 5
    });
    const [mode, setMode] = useState<'auto' | 'manual'>('manual');
    const [showInfoStatus, setShowInfoStatus] = useState('');
    const [activeSingers, setActiveSingers] = useState<any[]>([]);
    const [ignoredSingers, setIgnoredSingers] = useState<any[]>([]);
    const [requestCounts, setRequestCounts] = useState<Record<string, number>>({});
    const [isConfirmingClear, setIsConfirmingClear] = useState(false);
    const [showAllSingers, setShowAllSingers] = useState(false);

    // Load saved link on popup open
    useEffect(() => {
        if (chrome && chrome.storage) {
            chrome.storage.local.get(['robokj_inviteLink'], (result: { [key: string]: string }) => {
                if (result.robokj_inviteLink) {
                    setInviteLink(result.robokj_inviteLink);
                }
            });
        }

        // Fetch current show info
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: 'GET_SHOW_INFO' }, (response) => {
                if (response && response.success && response.data) {
                    setShowInfo(response.data);
                }
            });
        }
    }, []);

    const refreshRoster = () => {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: 'GET_ROSTER' }, (response) => {
                if (response && response.success && response.data) {
                    const active = response.data.filter((s: any) => s.status === 'active');
                    const ignored = response.data.filter((s: any) => s.status === 'ignored');
                    setActiveSingers(active);
                    setIgnoredSingers(ignored);

                    // Fetch request counts for each active singer
                    active.forEach((s: any) => {
                        if (chrome.runtime.sendMessage) {
                            chrome.runtime.sendMessage({ type: 'GET_REQUEST_LIST', stageName: s.singer.stageName }, (reqResponse) => {
                                if (reqResponse && reqResponse.success && reqResponse.data) {
                                    const requests = reqResponse.data.requests || [];
                                    const nextIndex = reqResponse.data.nextIndex || 0;
                                    const count = Math.max(0, requests.length - nextIndex);
                                    setRequestCounts(prev => ({ ...prev, [s.singer.stageName]: count }));
                                } else {
                                    setRequestCounts(prev => ({ ...prev, [s.singer.stageName]: 0 }));
                                }
                            });
                        }
                    });
                }
            });

            // Also fetch current state (mode)
            chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
                if (response && response.success && response.data) {
                    setMode(response.data.mode || 'manual');
                }
            });
        }
    };

    useEffect(() => {
        refreshRoster();

        const listener = (message: any) => {
            if (message && message.type === 'STATE_CHANGED') {
                refreshRoster();
                if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage({ type: 'GET_SHOW_INFO' }, (response) => {
                        if (response && response.success && response.data) {
                            setShowInfo(response.data);
                        }
                    });
                }
            }
        };

        if (chrome && chrome.runtime && chrome.runtime.onMessage) {
            chrome.runtime.onMessage.addListener(listener);
            return () => chrome.runtime.onMessage.removeListener(listener);
        }
    }, []);

    const handleSaveShowInfo = () => {
        // If inviteLink is present but streamKey hasn't been extracted, try to extract it when saving
        let finalStreamKey = showInfo.streamKey;
        if (inviteLink && !inviteLink.startsWith('http') && !inviteLink.includes('=')) {
            finalStreamKey = inviteLink.trim();
        } else if (inviteLink) {
            const match = inviteLink.match(/\?r=([a-zA-Z0-9]{10,25})/);
            finalStreamKey = match ? match[1] : inviteLink.trim();
        }

        const payloadToSave = { ...showInfo, streamKey: finalStreamKey };

        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
            setShowInfoStatus('Saving...');
            chrome.runtime.sendMessage({ type: 'SET_SHOW_INFO', payload: payloadToSave }, (response) => {
                if (response && response.success) {
                    setShowInfoStatus('Show Info saved!');
                    setShowInfo(payloadToSave);
                    // Update stored link to clear it if it was successfully parsed into the DB
                    if (chrome.storage) {
                        chrome.storage.local.set({ robokj_inviteLink: inviteLink });
                    }
                    setTimeout(() => setShowInfoStatus(''), 2000);
                } else {
                    setShowInfoStatus('Failed to save Show Info.');
                }
            });
        } else {
            setShowInfoStatus('Extension context invalid.');
        }
    };

    const handleClearAll = () => {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: 'SELF_DESTRUCT' }, (response) => {
                if (response && response.success) {
                    // Reset all local UI state
                    setInviteLink('');
                    setShowInfo({
                        venueName: '',
                        startTimeUTC: '',
                        durationInHours: 4,
                        streamKey: '',
                        maxSongDurationSeconds: 270,
                        maxSingerRequests: 5
                    });
                    setMode('manual');
                    setActiveSingers([]);
                    setRequestCounts({});
                    setShowInfoStatus('Database cleared');
                    setIsConfirmingClear(false);
                    setTimeout(() => setShowInfoStatus(''), 2000);
                } else {
                    setShowInfoStatus('Failed to clear database');
                    setIsConfirmingClear(false);
                }
            });
        }
    };

    const handleRemoveSinger = (stageName: string) => {
        if (window.confirm(`Are you sure you want to completely remove ${stageName} from the roster?`)) {
            if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ type: 'REMOVE_SINGER', stageName }, (response) => {
                    if (response && response.success) {
                        refreshRoster();
                    } else {
                        console.error('Failed to remove singer:', response?.error);
                    }
                });
            }
        }
    };

    const handleAction = (type: string, payload?: any) => {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type, ...payload }, (response) => {
                if (response && response.success) {
                    refreshRoster();
                } else {
                    console.error(`Failed action ${type}:`, response?.error);
                }
            });
        }
    };

    return (
        <div className="font-sans w-[700px] min-h-[580px] p-4 bg-[#1e1e2e] text-[#cdd6f4] rounded-lg shadow-xl border border-[#313244]">
            <div className="flex gap-4">
                {/* Left Column - Show Info */}
                <div className="flex-1">
                    <div className="p-4 bg-[#181825] rounded-xl border border-[#313244]">
                        <h2 className="text-sm font-semibold text-[#f9e2af] mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#f9e2af]"></span> Show Info
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs mb-1 text-[#a6adc8]">Venue Name</label>
                                <input
                                    type="text"
                                    value={showInfo.venueName}
                                    onChange={(e) => setShowInfo({ ...showInfo, venueName: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg bg-[#313244] text-[#cdd6f4] border border-[#45475a] focus:outline-none focus:border-[#f9e2af] text-xs transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs mb-1 text-[#a6adc8]">Room Link or Streamkey</label>
                                <input
                                    type="text"
                                    value={inviteLink || showInfo.streamKey}
                                    onChange={(e) => {
                                        setInviteLink(e.target.value);
                                        setShowInfo({ ...showInfo, streamKey: e.target.value });
                                    }}
                                    placeholder="https://w2g.tv/?r=..."
                                    className="w-full px-3 py-2 rounded-lg bg-[#313244] text-[#cdd6f4] border border-[#45475a] focus:outline-none focus:border-[#f9e2af] text-xs transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs mb-1 text-[#a6adc8]">Start Time (Local)</label>
                                <input
                                    type="datetime-local"
                                    value={formatUTCToLocalDateTimeInput(showInfo.startTimeUTC)}
                                    onChange={(e) => setShowInfo({ ...showInfo, startTimeUTC: parseLocalDateTimeInputToUTC(e.target.value) })}
                                    className="w-full px-3 py-2 rounded-lg bg-[#313244] text-[#cdd6f4] border border-[#45475a] focus:outline-none focus:border-[#f9e2af] text-xs transition-all [color-scheme:dark]"
                                />
                            </div>
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs mb-1 text-[#a6adc8]">Duration (hrs)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={showInfo.durationInHours}
                                        onChange={(e) => setShowInfo({ ...showInfo, durationInHours: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 rounded-lg bg-[#313244] text-[#cdd6f4] border border-[#45475a] focus:outline-none focus:border-[#f9e2af] text-xs transition-all"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs mb-1 text-[#a6adc8]">Max Song (sec)</label>
                                    <input
                                        type="number"
                                        min="10"
                                        value={showInfo.maxSongDurationSeconds || 270}
                                        onChange={(e) => setShowInfo({ ...showInfo, maxSongDurationSeconds: parseInt(e.target.value) || 270 })}
                                        className="w-full px-3 py-2 rounded-lg bg-[#313244] text-[#cdd6f4] border border-[#45475a] focus:outline-none focus:border-[#f9e2af] text-xs transition-all"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs mb-1 text-[#a6adc8]">Max Requests</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="99"
                                        value={showInfo.maxSingerRequests ?? 5}
                                        onChange={(e) => setShowInfo({ ...showInfo, maxSingerRequests: parseInt(e.target.value) || 5 })}
                                        className="w-full px-3 py-2 rounded-lg bg-[#313244] text-[#cdd6f4] border border-[#45475a] focus:outline-none focus:border-[#f9e2af] text-xs transition-all"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleSaveShowInfo}
                                className="w-full mt-2 bg-[#f9e2af] text-[#11111b] font-bold py-2 px-4 rounded-lg hover:bg-[#f38ba8] hover:text-[#11111b] hover:shadow-[0_0_10px_rgba(249,226,175,0.3)] transition-all text-sm active:scale-[0.98]"
                            >
                                Save Show Info
                            </button>
                            {showInfoStatus && <p className="text-xs mt-2 text-[#a6adc8] text-center font-medium animate-pulse">{showInfoStatus}</p>}
                        </div>
                    </div>
                    {/* Clear All Button */}
                    <div className="mt-4">
                        <div className="mb-6 flex flex-col items-center">
                            <label className="text-[10px] mb-2 text-[#a6adc8] font-bold uppercase tracking-widest">Operational Mode</label>
                            <button
                                onClick={() => handleAction('TOGGLE_MODE')}
                                title="Click to toggle Automatic vs Manual progression"
                                className="relative flex w-full h-10 bg-[#313244] rounded-full p-1 cursor-pointer transition-colors shadow-inner border border-[#45475a]"
                            >
                                {/* Active Tracker */}
                                <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${mode === 'auto' ? 'translate-x-[100%] bg-[#cba6f7] shadow-[0_0_15px_rgba(203,166,247,0.4)]' : 'translate-x-0 bg-[#585b70] shadow-md'} z-10`} style={{ left: '4px' }}></div>

                                {/* Labels */}
                                <div className="absolute inset-0 flex items-center justify-around pointer-events-none text-xs font-bold z-20">
                                    <span className={`w-1/2 text-center transition-colors duration-300 ${mode === 'manual' ? 'text-[#cdd6f4]' : 'text-[#a6adc8]'}`}>MANUAL</span>
                                    <span className={`w-1/2 text-center transition-colors duration-300 ${mode === 'auto' ? 'text-[#11111b]' : 'text-[#a6adc8]'}`}>AUTOMATIC</span>
                                </div>
                            </button>
                        </div>

                        {!isConfirmingClear ? (
                            <button
                                onClick={() => setIsConfirmingClear(true)}
                                className="w-full bg-[#f38ba8] text-[#11111b] font-bold py-2 px-4 rounded-lg hover:bg-[#eba0ac] hover:shadow-[0_0_10px_rgba(243,139,168,0.3)] transition-all text-sm active:scale-[0.98]"
                            >
                                ⚠ Clear All Data
                            </button>
                        ) : (
                            <div className="p-3 bg-[#313244] rounded-lg border border-[#f38ba8]">
                                <p className="text-[#f38ba8] text-xs font-bold mb-2 text-center">Are you sure? This cannot be undone.</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleClearAll}
                                        className="flex-1 bg-[#f38ba8] text-[#11111b] font-bold py-1.5 px-2 rounded-md hover:bg-[#eba0ac] transition-all text-xs active:scale-[0.98]"
                                    >
                                        Yes, Clear
                                    </button>
                                    <button
                                        onClick={() => setIsConfirmingClear(false)}
                                        className="flex-1 bg-[#45475a] text-[#cdd6f4] font-bold py-1.5 px-2 rounded-md hover:bg-[#585b70] transition-all text-xs active:scale-[0.98]"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Center Column - Controls */}
                <div className="w-40 shrink-0">
                    <div className="p-4 bg-[#181825] rounded-xl border border-[#313244] h-full flex flex-col gap-4">
                        <h2 className="text-sm font-semibold text-[#89b4fa] mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#89b4fa]"></span> Flow Controls
                        </h2>

                        <button
                            onClick={() => handleAction('NEXT_SINGER')}
                            title="Skip to the next singer in the roster"
                            className="w-full bg-[#a6e3a1] text-[#11111b] font-bold py-4 px-4 rounded-lg hover:bg-[#94e2d5] hover:shadow-[0_0_15px_rgba(166,227,161,0.4)] transition-all text-sm active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                            Next Singer
                        </button>

                        <button
                            onClick={() => handleAction('BUMP_SINGER')}
                            title="Bump the current singer back one spot"
                            className="w-full bg-[#fab387] text-[#11111b] font-bold py-4 px-4 rounded-lg hover:bg-[#f9e2af] hover:shadow-[0_0_15px_rgba(250,179,135,0.4)] transition-all text-sm active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"></path><path d="m17 22-5-5-5 5"></path><path d="M16 12H8"></path><path d="m13 7-5-5-5 5"></path><path d="M22 17h-8"></path><path d="m17 7-5-5-5 5"></path></svg>
                            Bump Singer
                        </button>

                        <button
                            onClick={() => handleAction('RESTART_VIDEO')}
                            title="Replay the current video from the beginning"
                            className="w-full bg-[#89b4fa] text-[#11111b] font-bold py-4 px-4 rounded-lg hover:bg-[#b4befe] hover:shadow-[0_0_15px_rgba(137,180,250,0.4)] transition-all text-sm active:scale-[0.98] flex items-center justify-center gap-2 mt-auto"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                            Restart Video
                        </button>
                    </div>
                </div>

                {/* Right Column - Singers List */}
                <div className="flex-1 flex flex-col gap-4">
                    <div className="p-4 bg-[#181825] rounded-xl border border-[#313244] flex-1">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-sm font-semibold text-[#cba6f7] flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${showAllSingers ? 'bg-[#a6adc8]' : 'bg-[#cba6f7]'}`}></span>
                                {showAllSingers ? 'All Singers' : 'Active Singers'}
                            </h2>
                            <button
                                onClick={() => setShowAllSingers(!showAllSingers)}
                                className="text-xs bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] px-2 py-1 rounded transition-colors"
                            >
                                {showAllSingers ? 'Show Active Only' : 'Show All'}
                            </button>
                        </div>

                        <ul className="list-none p-0 m-0 space-y-2 max-h-[490px] overflow-y-auto pr-2">
                            {activeSingers.length === 0 && (!showAllSingers || ignoredSingers.length === 0) ? (
                                <p className="text-xs text-[#a6adc8] italic text-center mt-4">No singers found.</p>
                            ) : (
                                <>
                                    {activeSingers.map((status, index) => (
                                        <ListItem
                                            key={`active-${index}`}
                                            name={status.singer.stageName}
                                            requestCount={requestCounts[status.singer.stageName] || 0}
                                            onRemove={() => handleRemoveSinger(status.singer.stageName)}
                                            isPerforming={index === 0}
                                        />
                                    ))}
                                    {showAllSingers && ignoredSingers.map((status, index) => (
                                        <li key={`ignored-${index}`} className="flex justify-between items-center p-2.5 bg-[#313244] rounded-md transition duration-200 opacity-70">
                                            <span className="flex-1 text-sm text-[#a6adc8] flex items-center gap-2">
                                                <span title="Ignored">💀</span>
                                                {status.singer.stageName}
                                            </span>
                                            <button
                                                onClick={() => handleAction('REACTIVATE_SINGER', { stageName: status.singer.stageName })}
                                                className="text-xs bg-[#a6e3a1] text-[#11111b] font-bold px-2 py-1 rounded hover:bg-[#94e2d5] transition-all"
                                            >
                                                Reactivate
                                            </button>
                                        </li>
                                    ))}
                                </>
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
