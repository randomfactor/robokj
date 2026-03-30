import { parseMessageElement, handleActionResponse, ParsedCommand, ROBO_KJ_TOKEN_REGEX } from './commands';

let chatObserverRetries = 0;
// Note: We scan all messages to find up to 2 tokens.
const messageDictionaries = new Map<string, Set<string>>();

function getMessageText(messageElement: Element): string {
    return messageElement.querySelector('.break-words')?.textContent?.trim() || '';
}

function getNumericToken(token: string): number {
    if (token === '0') return 0;
    const match = token.match(/AC(\d+)/);
    if (match) return parseInt(match[1], 10);
    return -1;
}

export function startObservingChat() {
    const chatContainer = document.querySelector('.w2g-power-messages');

    if (!chatContainer) {
        chatObserverRetries++;
        if (chatObserverRetries < 20) {
            setTimeout(startObservingChat, 1000);
        }
        return;
    }

    console.log('RoboKJ: Found chat container. Starting observer.');

    let flushScheduled = false;

    // We no longer trigger per-node, instead trigger via mutation and rescan the DOM.
    // Throttling to flushPending via event loop.
    const enqueueCandidate = () => {
        if (!flushScheduled) {
            flushScheduled = true;
            setTimeout(flushPending, 0);
        }
    };

    const flushPending = () => {
        flushScheduled = false;

        const allMessages = Array.from(chatContainer.querySelectorAll('.mucmsg'));
        
        // Items will be either a found token or a found command context
        type StackItem = 
            | { type: 'token'; value: string }
            | { type: 'command'; parsed: ParsedCommand };
            
        const stack: StackItem[] = [];
        let tokensEncountered = 0;
        
        // Scan backwards to build the sequence
        for (let i = allMessages.length - 1; i >= 0; i--) {
            const messageElement = allMessages[i];
            const text = getMessageText(messageElement);
            const tokenMatch = text.match(ROBO_KJ_TOKEN_REGEX);
            
            if (tokenMatch) {
                tokensEncountered++;
                stack.push({ type: 'token', value: tokenMatch[0] });
                if (tokensEncountered >= 2) {
                    break;
                }
            } else {
                const parsed = parseMessageElement(messageElement);
                if (parsed) {
                    stack.push({ type: 'command', parsed });
                }
            }
        }
        
        // Process chronologically (top-down)
        const processQueue = stack.reverse();
        
        let currentToken = ''; 
        // 0 token sorting less than AC000000, 
        // effectively handles pre-token messages
        
        let oldestTokenNumber = Infinity;

        for (const item of processQueue) {
            if (item.type === 'token') {
                currentToken = item.value;
                const numericVal = getNumericToken(currentToken);
                if (numericVal >= 0 && numericVal < oldestTokenNumber) {
                    oldestTokenNumber = numericVal;
                }
                
                if (!messageDictionaries.has(currentToken)) {
                    messageDictionaries.set(currentToken, new Set<string>());
                }
            } else {
                const { parsed } = item;
                // If there were no tokens encountered before this command in the queue, 
                // assign to default '0' token
                if (!currentToken) {
                    currentToken = '0';
                    if (!messageDictionaries.has(currentToken)) {
                        messageDictionaries.set(currentToken, new Set<string>());
                    }
                }
                
                // Construct a unique key for the message within this token block
                const commandKey = JSON.stringify(parsed.action) + `|${parsed.w2gId}|${parsed.rawText}`;
                
                const dict = messageDictionaries.get(currentToken)!;
                if (!dict.has(commandKey)) {
                    dict.add(commandKey);
                    
                    // Proceed to send the background action
                    if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
                        console.warn('RoboKJ: Extension context invalidated.');
                        continue;
                    }
                    try {
                        chrome.runtime.sendMessage(parsed.action, (response) => {
                            if (chrome.runtime.lastError) {
                                console.error('RoboKJ Error sending message:', chrome.runtime.lastError);
                                return;
                            }
                            handleActionResponse(parsed, response);
                        });
                    } catch (error) {
                        console.warn('RoboKJ Context Error:', error);
                    }
                }
            }
        }
        
        // Garbage Collection: Remove dictionaries older than our oldest token bounds.
        // During the backwards scan, if we found 2 tokens, the second token found (the older one)
        // determines the baseline. We can safely remove anything strictly older.
        if (tokensEncountered === 2 && oldestTokenNumber !== Infinity) {
            for (const existingToken of messageDictionaries.keys()) {
                const val = getNumericToken(existingToken);
                // "0" sorting logic: it resolves to 0, which is always < AC[timestamp], so it cleans up fine!
                if (val >= 0 && val < oldestTokenNumber) {
                    messageDictionaries.delete(existingToken);
                }
            }
        }
    };

    // Create an observer instance linked to the callback function
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' || mutation.type === 'characterData') {
                // If ANY DOM mutation happens, we queue a rescan.
                enqueueCandidate();
            }
        }
    });

    observer.observe(chatContainer, { childList: true, subtree: true, characterData: true });
}
