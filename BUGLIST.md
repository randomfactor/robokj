# Bug List

## Entered 2026-03-26

- [x] When the state is 'manual', the background worker should not respond to VIDEO_STARTED or VIDEO_ENDED messages from the content window.
- [x] When the state is 'manual', the background worker should not respond to timeout events. When state is changed to 'manual', any existing timeout should be cancelled.
- [x] When the state is 'manual', the background worker should not respond to the following commands from the W2G chat window: /restart
- [x] RoboKJ itself must never send a response message that contains an URL.
- [x] A stringent test is needed to determine whether an URL entered by a singer is valid. Any additional text beyond the title and URL should cause the message to be ignored.
- [x] When a song is started in 'auto' mode, a message is added to the W2G chat window by the Watch2Gether application that is misinterpreted as a new request for admin. This case must be properly identified so that it does not enter a new request for admin. More detail on this situation is required before this bug can be fixed.
- [x] Restrict requests to https://www.youtube.com/*, https://youtu.be/*, and https://vimeo.com/* 
- [x] If the URL in a request is not recognized as valid, ignore it and do not send a response message.
- [x] Instead of URL hidden to avoid spam, include the part of the URL that precedes the question mark and follows the last slash mark or second to last slash mark if otherwise empty.
- [x] It would be better if the message for duplicate requests said "already claimed by Brad" (whichever user had sung it or has it in their queue).
- [x] After the "There are no active singers in the roster" message is displayed, if a mode is still 'auto', after a new valid request is entered by any user, the next singer processing should be triggered.
- [x] The start time and duration should be respected. At the end of the playing song, the mode should be set to 'manual' and a message should sent thanking everyone for attending the venueName show.
- [x] If mode is set to 'auto' and current time is after the start time and the show has not yet started, the first singer in the roster should have their song started (as if the Next Singer button were pushed).
- [x] If the mode is set to auto and the current time is before the start time, a timer should be set to trigger the first singer processing at the start time.
- [x] If the mode is set to auto and the current time is after the start time plus duration, send a message saying the show has expired.


 