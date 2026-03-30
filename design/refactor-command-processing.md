# Command Processing

*Date: March 30, 2026*

## Design Goal

The RoboKJ system should recognize commands and requests from users in the W2G chat window. It should process each command or request once and only once and in the order of arrival. It should not process the same command or request more than once. It should not process commands or requests that have already been processed. It should not process commands or requests that are not commands or requests.

The W2G system provides the DOM elements that can be found in the chat window. These messages may originate from the RoboKJ user (admin) or from user's browsers by typing into the id="w2g-chat-input" field and then pressing the data-w2g="['submitChat', ['event', 'pointerup']]" button.

The W2G system will modify the child elements in the W2G chat window unpredictably and may delete and recreate all of the elements in the W2G chat window. This makes it difficult to enforce the "process once" requirement by simply observing the DOM elements in the W2G chat window. 

## Design Approach

The W2G system can be trusted to preserve the order of the child elements that remain in the W2G chat window after a mutation. In order to provide a rough way to bookmark messages, a special RoboKJ token is added to _some_ of the messages that the RoboKJ web extension sends to all users via the chat window (sendToAll function). The general approach to command processing is as follows:

1. Create a `messageDictionaries` map of dictionaries (Sets) of messages processed that follow each RoboKJ token message. The outer dictionary is keyed by the RoboKJ token message (e.g., `AC123049`). The inner dictionary is keyed by a stringified combination of the parsed `MessageAction`, the sender `w2gId`, and the `rawText`.

2. Any chat messages chronologically located *before* the first RoboKJ token are assigned to a fallback token named `"0"` (which sorts mathematically lower than any `AC\d+` integer value).

3. Create a stack queue of potential commands and requests to be processed.

4. When the mutation observer detects a change, start reading the W2G chat window child elements from the end backwards. If the child element does not contain a singer request or a singer command, ignore it. If it does contain a singer request or a singer command, push it onto the stack of potential commands and requests to be processed.

5. During the backwards scan, if a RoboKJ token message is encountered, the scan makes note of it. When the 2nd (older) RoboKJ token message is encountered, the scan stops and the queue of items generated from the backwards scan is reversed so it can be evaluated in standard, chronological order (starting from the top).

6. A `currentToken` boundary is kept during this top-down sweep. Any commands or requests that follow that token are checked against the appropriate bucket in `messageDictionaries` to determine if they have already been processed. If they haven't been sent, they are sent to the background worker and uniquely logged in the bucket.

7. **Garbage Collection**: Because the backwards scan creates an airtight baseline at the 2nd older token, any `messageDictionaries` entries corresponding to tokens technically older than that baseline numeric bound are automatically deleted to prevent unbound memory growth.

This approach assumes that there may be new unseen commands and requests between the 2nd to the last RoboKJ token message and the end of the chat window. These new unseen commands and requests will be securely processed and tracked automatically.

## Refactoring Notes

- **Implementation Details**: `content/commands.ts` has been refactored so that functions like `parseMessageElement` purely validate DOM strings into JSON intent and return `MessageAction` objects without any implicit browser side logic. 
- **Central Dispatch Control**: `chat-observer.ts` serves as the centralized dispatcher. It owns the JSON serializing, the deduplication, and the direct `chrome.runtime.sendMessage` transmission lines. UI response feedback mechanisms and UI side-effects derived from those backend transactions are strictly handled downstream of the dispatcher loop via `handleActionResponse()`.
