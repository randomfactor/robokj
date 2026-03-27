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


 ## Entered 2026-03-27

 - [ ] The purpose of the mutation observer on the W2G chat window (content/chat-observer.ts) is to identify new commands and requests from users and send the appropriate message to the background worker that will satisfy the command or request. The system is losing track of which items are new and is reprocessing commands and requests unnecessarily. This cascades in the chat window with additional messages added in response (using sendToAll function) causing more disturbances that the mutation observer processes and even more reprocessing of old commands and requests.
   - Plan a way to track commands and requests that have been processed so that they are processed once in the order of arrival and exactly once, even if many changes are found by the mutation observer.
   - An example of the system responding additional times can be found in the html collected using the chrome debugger in content/working-data/w2g-chat-1.html.
   - Example of user song request: <div class="mucmsg w2g-they mr-auto   shrink-0 flex items-start mb-2 max-w-[95%] [&amp;.w2g-followup]:-mt-1 w2g-message" data-robokj-processed="true">
                        <div class="shrink-0 w-10 h-10 mr-2.5 [.w2g-followup_&amp;]:hidden rounded-full overflow-hidden bg-[url('/img/backgrounds/user_bg.png')] bg-cover">
                                <img class="h-10 w-10 inline-block" src="https://static.w2g.tv/static/w2guser-default.png" alt="User-YENGO">
                            </div>        
                        <div class=" cursor-pointer relative max-w-full mt-1 [.w2g-followup_&amp;]:ml-[3.25rem] [.w2g-followup_&amp;]:mt-0">
                            <div data-event="['click', 'handleMessageClick', '458a62cb-32cb-4830-abad-4f095a8be4d8']" class="w2g-msg-6dx14qd8ompzs22g-basic px-2 pt-1.5 pb-0 relative min-w-20 rounded-lg overflow-hidden [.w2g-they_&amp;]:rounded-tl-sm [.w2g-me_&amp;]:rounded-tr-sm bg-w2g-dark-var border-w2g-light-var border text-w2g-maintext">
                                <div class="flex text-xs mb-1 [.w2g-followup_&amp;]:hidden">
                                        <div class="overflow-clip mr-2 leading-none">User-YENGO</div>               
                                    </div>            
                                <div class="leading-tight overflow-hidden text-sm break-words">https://www.youtube.com/watch?v=Ob1TzE0tBWE</div>  
                                <div class="space-y-2 mt-2">
                                    
                                    <div class="flex">
                                        
                                        <div class="mr-1.5 shrink-0">
                                            <img src="/img/providers/1.9c2d9fe1.png" class="w-5 h-5 rounded-md" alt="Provider Logo">
                                        </div>
                                                                                
                                        <div class="text-sm overflow-hidden"> 
                                            
                                                <a class="italic hover:underline break-words leading-tight mb-1" href="//www.youtube.com/watch?v=Ob1TzE0tBWE" target="_blank">In Bloom - Nirvana (Acoustic Karaoke)</a><br>
                                                                                                                                    
                                            <span class="text-xs">                      
                                                <a data-event="['click', 'play', '29,0']" href="#" class="underline mod-player" title="Play">Play</a> | 
                                                <a data-event="['click', 'addToPl', '29,0']" href="#" class="underline mod-pl mod_pl_interaction" title="Add to Playlist">Add to Playlist</a>                       
                                            </span>
                                        </div>                                                           
                                    </div>                                    
                                </div>     
                                                                                               
                                <div class="overflow-hidden opacity-60 text-right leading-normal -mx-1 text-[0.6rem]">10:50</div>  
                                          
                            </div>
                               
                                                           
                            
                        </div>                         
                    </div>
  - All user commands have text beginning with a slash "/" such as "/register Chad"
  - Example of user command: <div class="mucmsg w2g-they mr-auto   shrink-0 flex items-start mb-2 max-w-[95%] [&amp;.w2g-followup]:-mt-1 w2g-message" data-robokj-processed="true">
                        <div class="shrink-0 w-10 h-10 mr-2.5 [.w2g-followup_&amp;]:hidden rounded-full overflow-hidden bg-[url('/img/backgrounds/user_bg.png')] bg-cover">
                                <img class="h-10 w-10 inline-block" src="https://static.w2g.tv/static/w2guser-default.png" alt="User-YENGO">
                            </div>        
                        <div class=" cursor-pointer relative max-w-full mt-1 [.w2g-followup_&amp;]:ml-[3.25rem] [.w2g-followup_&amp;]:mt-0">
                            <div data-event="['click', 'handleMessageClick', '3966e18e-163e-44a0-b0fb-3f640edd2bfe']" class="w2g-msg-6dx14qd8ompzs22g-basic px-2 pt-1.5 pb-0 relative min-w-20 rounded-lg overflow-hidden [.w2g-they_&amp;]:rounded-tl-sm [.w2g-me_&amp;]:rounded-tr-sm bg-w2g-dark-var border-w2g-light-var border text-w2g-maintext">
                                <div class="flex text-xs mb-1 [.w2g-followup_&amp;]:hidden">
                                        <div class="overflow-clip mr-2 leading-none">User-YENGO</div>               
                                    </div>            
                                <div class="leading-tight overflow-hidden text-sm break-words">/register Dilbert</div>  
                                     
                                                                                               
                                <div class="overflow-hidden opacity-60 text-right leading-normal -mx-1 text-[0.6rem]">10:49</div>  
                                          
                            </div>
                               
                                                           
                            
                        </div>                         
                    </div>
  - Create a markdown document with an implementation plan to correct the current bugs from the mutation observer and processing commands to relay messages to the background worker.
  - Consider adding an incrementing counter token (e.g. "AC000001, AC000002, ..." to the end of every message going through sendToAll so that it will be easier to determine whether messages between those with the token have already been processed. The current counter could be stored in IndexedDB in a new object named KCurrentState.
