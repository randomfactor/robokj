## Rules for normal operation:

- A singer registers themselves in the w2g chat window with the /register <stage-name> command. 

- Once registered, the singer can add songs to their individual request list with with a w2g link to a video. w2g expands the link to a song title and an URL.

- If a singer attempts to request a link that has already been requested, the request fails, and RoboKJ should respond with a message to the w2g chat window indicating that the song has already been requested. **Note: Duplicate Prevention ensures no song is played twice in the same show. This applies even if the song was already performed in the past, or if it is currently pending in another singer's request list.**

- The request list for a singer should not allow more than 5 unperformed songs in the list.

- When a singer successfully registers themselves, the singer should be added to the end of the current roster.

- The singer at the top of the roster is currently performing.

- When the current performer has completed their performance, the next singer on the roster should be moved to the top of the roster and begin their performance. Also, the singer that has finished is added to the end of the roster and their bump count is reset to 0. Also, the singer that has finished should have the index to their next request incremented by 1.

- If the next singer has no songs left in their request list, their status should be changed to 'ignored' and the next singer should be moved to the top of the roster and begin their performance. This should continue until a singer is found that has songs left in their request list.

- If the roster is empty of 'active' singers, RoboKJ should respond with a message to the w2g chat window indicating that there are no active singers in the roster.

- If a singer attempts to register themselves and they are already in the roster, RoboKJ should respond with a message to the w2g chat window indicating that the singer is already in the roster. The message should give both the stage name and the w2gId of the registered singer.

- If the link provided in a song request cannot be played, the singer is "bumped". This results in the next singer starting their performance and the bumped singer having their bump count incremented by 1. If the bump count is less than 2, the singer is inserted to be after the new current singer. If the bump count is 2, the singer is inserted to be after the last singer in the roster.

- If the show mode is "manual", the next singer operation occurs when the KJ clicks the "Next Singer" button in the popup window. 

- If the show mode is "manual", the current singer is bumped when the KJ clicks the "Bump Singer" button in the popup window.

- If a user types "/restart" in the w2g chat window and that user (by w2gId) is the current singer, the bump count for the singer is incremented and the video should be restarted. The next request index IS NOT incremented.

- If the show mode is "manual, the KJ can restart the current song by clicking the "Restart Song" button in the popup window. This will increment the bump count for the singer and restart the video. The next request index IS NOT incremented.

## At Startup

- If the KJ invokes the "Clear All" command and confirms the action, RoboKJ should clear all data from the database and respond with a message to the w2g chat window indicating that the database has been cleared.

- No commands should be recognized or processed until the KJ sets the show info (including the stream key).




