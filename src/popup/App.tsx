import { useState, useEffect } from 'react';
import ListItem from '../components/ListItem';

function App() {
    const [inviteLink, setInviteLink] = useState('');
    const [showInfo, setShowInfo] = useState({
        venueName: '',
        startTimeUTC: '',
        durationInHours: 4,
        streamKey: '',
        mode: 'manual' as 'auto' | 'manual'
    });
    const [showInfoStatus, setShowInfoStatus] = useState('');
    const [activeSingers, setActiveSingers] = useState<any[]>([]);

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
            chrome.runtime.sendMessage({ type: 'GET_ROSTER' }, (response) => {
                if (response && response.success && response.data) {
                    setActiveSingers(response.data.filter((s: any) => s.status === 'active'));
                }
            });
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

    return (
        <div className="font-sans w-[600px] p-4 bg-[#1e1e2e] text-[#cdd6f4] rounded-lg shadow-xl border border-[#313244] max-h-[600px] overflow-y-auto">
            <h1 className="text-2xl mt-0 text-[#89b4fa] font-bold border-b-2 border-[#313244] pb-3 mb-5 tracking-wide">
                RoboKJ
            </h1>

            <div className="flex gap-6">
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
                                <label className="block text-xs mb-1 text-[#a6adc8]">Start Time (UTC)</label>
                                <input
                                    type="datetime-local"
                                    value={showInfo.startTimeUTC ? showInfo.startTimeUTC.slice(0, 16) : ''}
                                    onChange={(e) => setShowInfo({ ...showInfo, startTimeUTC: e.target.value ? new Date(e.target.value).toISOString() : '' })}
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
                                    <label className="block text-xs mb-1 text-[#a6adc8]">Mode</label>
                                    <select
                                        value={showInfo.mode}
                                        onChange={(e) => setShowInfo({ ...showInfo, mode: e.target.value as 'auto' | 'manual' })}
                                        className="w-full px-3 py-2 rounded-lg bg-[#313244] text-[#cdd6f4] border border-[#45475a] focus:outline-none focus:border-[#f9e2af] text-xs transition-all cursor-pointer"
                                    >
                                        <option value="manual">Manual</option>
                                        <option value="auto">Auto</option>
                                    </select>
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
                </div>

                {/* Right Column - Active Singers */}
                <div className="flex-1">
                    <div className="p-4 bg-[#181825] rounded-xl border border-[#313244] h-full">
                        <h2 className="text-sm font-semibold text-[#cba6f7] mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#cba6f7]"></span> Active Singers
                        </h2>
                        {activeSingers.length > 0 ? (
                            <ul className="list-none p-0 m-0 space-y-2 max-h-[400px] overflow-y-auto pr-2">
                                {activeSingers.map((status, index) => (
                                    <ListItem key={index} name={status.singer.stageName} />
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-[#a6adc8] italic text-center mt-4">No active singers.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
