import { MessageAction } from '../types';

console.log('RoboKJ: Content script loaded. Waiting for chat to render...');

// Function to process a new chat message element
function processMessageElement(element: Element) {
    // Prevent duplicate processing if we already successfully pulled the data
    if (element.getAttribute('data-robokj-processed')) {
        return;
    }

    // Look for the inner div containing the actual text message
    const messageTextDiv = element.querySelector('.break-words');
    if (!messageTextDiv) return;

    const messageText = messageTextDiv.textContent || '';

    // Check if the message is a registration command
    if (messageText.trim().startsWith('/register ')) {
        const singerName = messageText.replace('/register ', '').trim();

        // Extract the w2gId (the user's identity string)
        let w2gId = 'admin'; // Default per user request if missing

        // The sender's ID is usually in the overflow-clip div inside the message block
        const idDiv = element.querySelector('.overflow-clip');
        if (idDiv && idDiv.textContent) {
            w2gId = idDiv.textContent.trim();
        }

        // Send message to background script
        const message: MessageAction = {
            type: 'REGISTER_SINGER',
            payload: {
                w2gId,
                stageName: singerName
            }
        };

        if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
            console.warn('RoboKJ: Extension context invalidated. Please refresh the page.');
            return;
        }

        element.setAttribute('data-robokj-processed', 'true');
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                console.error('RoboKJ Error sending message:', chrome.runtime.lastError);
                return;
            }
            if (response && response.success) {
                console.log(`RoboKJ: Successfully registered singer ${singerName} (${w2gId})`);
            } else {
                console.warn(`RoboKJ: Failed to register singer: ${response?.error}`);
            }
        });
        return; // Done processing this specific message type
    }

    // Check if the message is a song request (contains a link for the song)
    // We target the specific italicized song title link instead of any anchor tag
    const linkElement = element.querySelector('a.italic.hover\\:underline') as HTMLAnchorElement;

    if (linkElement && linkElement.href) {
        // Find the actual URL (which might be the raw string text in the .break-words div above it, or the href value itself)
        const songUrlDiv = element.querySelector('.break-words') as HTMLDivElement;

        // Use the displayed youtube URL if we find it, otherwise fall back to the href
        const songUrl = (songUrlDiv && songUrlDiv.textContent && songUrlDiv.textContent.includes('http'))
            ? songUrlDiv.textContent.trim()
            : (linkElement.getAttribute('href') || linkElement.href);
        const songTitle = linkElement.textContent?.trim() || 'Unknown Title';

        let w2gId = 'admin'; // Default per user request if missing

        // The sender's ID is usually in the overflow-clip div inside the message block
        const idDiv = element.querySelector('.overflow-clip');
        if (idDiv && idDiv.textContent) {
            w2gId = idDiv.textContent.trim();
        }

        const message: MessageAction = {
            type: 'ADD_SONG_REQUEST',
            w2gId: w2gId,
            payload: {
                title: songTitle,
                url: songUrl
            }
        };

        if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
            console.warn('RoboKJ: Extension context invalidated. Please refresh the page.');
            return;
        }

        element.setAttribute('data-robokj-processed', 'true');
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                console.error('RoboKJ Error sending song request:', chrome.runtime.lastError);
                return;
            }
            if (response && response.success) {
                console.log(`RoboKJ: Successfully added song request "${songTitle}" for ${w2gId}`);
            }
        });
    }
}

// Function to start observing the chat container
function startObservingChat() {
    const chatContainer = document.querySelector('.w2g-power-messages');

    if (!chatContainer) {
        // If not found yet, try again in a bit (page might still be loading)
        setTimeout(startObservingChat, 1000);
        return;
    }

    console.log('RoboKJ: Found chat container. Starting observer.');

    // Create an observer instance linked to the callback function
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as Element;

                        // If it's a top-level message element
                        if (element.classList.contains('mucmsg')) {
                            processMessageElement(element);
                        } else {
                            // If it's a nested element being lazily rendered inside an existing mucmsg
                            const parentMsg = element.closest('.mucmsg');
                            if (parentMsg) {
                                processMessageElement(parentMsg);
                            } else {
                                // Sometimes messages are nested in other wrappers initially
                                const messages = element.querySelectorAll('.mucmsg');
                                messages.forEach(processMessageElement);
                            }
                        }
                    }
                });
            } else if (mutation.type === 'characterData') {
                // Sometime attributes/text change lazily
                if (mutation.target.nodeType === Node.ELEMENT_NODE || mutation.target.nodeType === Node.TEXT_NODE) {
                    const parentMsg = mutation.target.parentElement?.closest('.mucmsg');
                    if (parentMsg) {
                        processMessageElement(parentMsg);
                    }
                }
            }
        }
    });

    // Start observing the target node for configured mutations
    observer.observe(chatContainer, { childList: true, subtree: true, characterData: true });
}

// Function to emit a message into the chat container
export function sendToAll(message: string) {
    const chatInput = document.getElementById('w2g-chat-input') as HTMLInputElement | HTMLTextAreaElement;
    if (chatInput) {
        chatInput.value = message;
        // Dispatch an 'input' event so the framework recognizes the new text
        chatInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        // Option A: Trigger the custom 'w2gsubmit' event directly on the textarea
        chatInput.dispatchEvent(new Event('w2gsubmit', { bubbles: true, cancelable: true }));
    }
}

// Initialize when the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        startObservingChat();
        setTimeout(() => sendToAll('It is working!'), 5000);
    });
} else {
    startObservingChat();
    setTimeout(() => sendToAll('It is working!'), 5000);
}

/*
w2g-chat-input
*/