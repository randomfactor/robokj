import { processMessageElement } from './commands';

let chatObserverRetries = 0;

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
