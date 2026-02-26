import { useState } from 'react';
import ListItem from '../components/ListItem';

function App() {
    const [inviteLink, setInviteLink] = useState('');
    const [status, setStatus] = useState('');

    const handleSetStreamkey = () => {
        // Extract the streamkey from the invite link
        const match = inviteLink.match(/\?r=([a-zA-Z0-9]{10,25})/);
        // If it matches the regex, use the match. Otherwise assume they pasted the raw ID.
        const streamkey = match ? match[1] : inviteLink.trim();

        if (!streamkey) {
            setStatus('Please enter a valid link or key.');
            return;
        }

        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: 'SET_STREAMKEY', streamkey }, (response) => {
                if (response && response.success) {
                    setStatus('Streamkey set successfully!');
                } else {
                    setStatus('Failed to set streamkey.');
                }
            });
        } else {
            setStatus('Extension context invalid.');
        }
    };

    return (
        <div className="font-sans w-[300px] p-4 bg-[#1e1e2e] text-[#cdd6f4] rounded-lg">
            <h1 className="text-2xl mt-0 text-[#89b4fa] border-b-2 border-[#313244] pb-2 mb-4">
                RoboKJ
            </h1>

            <div className="mb-4">
                <label className="block text-sm mb-1 text-[#a6adc8]">Set Room Invite Link:</label>
                <input
                    type="text"
                    value={inviteLink}
                    onChange={(e) => setInviteLink(e.target.value)}
                    placeholder="https://w2g.tv/?r=..."
                    className="w-full p-2 mb-2 rounded bg-[#313244] text-[#cdd6f4] border border-[#45475a] focus:outline-none focus:border-[#89b4fa] text-xs"
                />
                <button
                    onClick={handleSetStreamkey}
                    className="w-full bg-[#89b4fa] text-[#11111b] font-bold py-1.5 px-4 rounded hover:bg-[#b4befe] transition-colors text-sm"
                >
                    Save Streamkey
                </button>
                {status && <p className="text-xs mt-2 text-[#a6adc8] text-center">{status}</p>}
            </div>

            <h2 className="text-lg text-[#89b4fa] mb-2 border-b border-[#313244] pb-1">Singers</h2>
            <ul className="list-none p-0 m-0 space-y-2">
                <ListItem name="Bob" />
                <ListItem name="Carol" />
                <ListItem name="Ted" />
                <ListItem name="Alice" />
            </ul>
        </div>
    );
}

export default App;
