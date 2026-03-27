import { processMessageElement } from './commands';

let chatObserverRetries = 0;
const AC_TOKEN_REGEX = /\bAC\d{6,}\b/;
const MAX_RECENT_SCAN_MESSAGES = 30;

function findTopLevelMessageElement(node: Node): Element | null {
    if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        if (element.classList.contains('mucmsg')) {
            return element;
        }

        const closestParentMessage = element.closest('.mucmsg');
        if (closestParentMessage) {
            return closestParentMessage;
        }
    }

    if (node.nodeType === Node.TEXT_NODE) {
        const parentMessage = node.parentElement?.closest('.mucmsg');
        if (parentMessage) {
            return parentMessage;
        }
    }

    return null;
}

function getMessageText(messageElement: Element): string {
    return messageElement.querySelector('.break-words')?.textContent?.trim() || '';
}

function getMessagesAfterLatestToken(messages: Element[]): Element[] {
    for (let i = messages.length - 1; i >= 0; i--) {
        const messageText = getMessageText(messages[i]);
        if (AC_TOKEN_REGEX.test(messageText)) {
            return messages.slice(i + 1);
        }
    }

    return messages.slice(Math.max(0, messages.length - MAX_RECENT_SCAN_MESSAGES));
}

// Function to start observing the chat container
export function startObservingChat() {
    const chatContainer = document.querySelector('.w2g-power-messages');

    if (!chatContainer) {
        // If not found, it might be loading, or we might be in an iframe
        chatObserverRetries++;
        if (chatObserverRetries < 20) {
            setTimeout(startObservingChat, 1000);
        }
        return;
    }

    console.log('RoboKJ: Found chat container. Starting observer.');

    const pendingMessages = new Set<Element>();
    let flushScheduled = false;

    const enqueueCandidate = (node: Node) => {
        const messageElement = findTopLevelMessageElement(node);
        if (messageElement) {
            pendingMessages.add(messageElement);
            if (!flushScheduled) {
                flushScheduled = true;
                setTimeout(flushPending, 0);
            }
        }
    };

    const flushPending = () => {
        flushScheduled = false;

        if (pendingMessages.size === 0) {
            return;
        }

        const allMessages = Array.from(chatContainer.querySelectorAll('.mucmsg'));
        const candidateWindow = getMessagesAfterLatestToken(allMessages);

        for (const messageElement of candidateWindow) {
            processMessageElement(messageElement);
        }

        pendingMessages.clear();
    };

    // Create an observer instance linked to the callback function
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    enqueueCandidate(node);
                });
            } else if (mutation.type === 'characterData') {
                enqueueCandidate(mutation.target);
            }
        }
    });

    // Start observing the target node for configured mutations
    observer.observe(chatContainer, { childList: true, subtree: true, characterData: true });
}
