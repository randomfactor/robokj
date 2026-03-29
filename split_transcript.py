import re

def parse_time(time_str):
    # Handles "M:SS", "MM:SS", "S", "SS"
    # The file has:
    # 0:11
    # 11 seconds
    # OR
    # 1:02
    # 1 minute, 2 seconds
    
    # We only care about the first line of the timestamp (the M:SS format)
    # as it's more consistent for parsing.
    parts = time_str.split(':')
    if len(parts) == 2:
        return int(parts[0]) * 60 + int(parts[1])
    return int(parts[0])

def process_transcript(input_file, output_file):
    with open(input_file, 'r') as f:
        lines = [line.strip() for line in f.readlines()]

    blocks = []
    current_text = []
    
    i = 0
    while i < len(lines):
        # Look for time pattern (M:SS or MM:SS)
        if re.match(r'^\d+:\d{2}$', lines[i]):
            # This is a timestamp line. 
            # The line after it is usually the verbal description (e.g., "11 seconds")
            timestamp = lines[i]
            # verbal = lines[i+1] if i+1 < len(lines) else ""
            
            # Save the current block
            if current_text:
                blocks.append({
                    'text': " ".join(current_text),
                    'start_time': parse_time(timestamp)
                })
                current_text = []
            
            # Skip the timestamp and the verbal description
            i += 2
        else:
            if lines[i]:
                current_text.append(lines[i])
            i += 1
            
    # Add the last block if any
    if current_text:
        # The last block doesn't have a trailing timestamp in the same way, 
        # but let's see if we can infer one or just add it.
        blocks.append({
            'text': " ".join(current_text),
            'start_time': 999999 # Far in future
        })

    # Now merge blocks within 3 seconds
    merged_blocks = []
    if not blocks:
        return

    # Special case for the first block which is the intro
    # Actually, the format seems to be:
    # Text
    # Timestamp (End of that text)
    # Verbal description
    
    # Let's re-parse knowing that the timestamp FOLLOWS the text.
    
    blocks = []
    current_text = []
    i = 0
    last_end_time = 0
    
    while i < len(lines):
        if re.match(r'^\d+:\d{2}$', lines[i]):
            end_time = parse_time(lines[i])
            text = " ".join(current_text)
            blocks.append({'text': text, 'end_time': end_time})
            current_text = []
            i += 2 # Skip verbal
        else:
            if lines[i]:
                current_text.append(lines[i])
            i += 1
    
    if current_text:
        blocks.append({'text': " ".join(current_text), 'end_time': None})

    # Merging logic: 
    # The prompt says: "If the end time of one part of the transcript is within 3 seconds 
    # of the start time of the next part, merge them into a single batch."
    # In this file, we only have END times. 
    # Usually, the start time of a block is the end time of the previous block.
    
    final_output = []
    if blocks:
        current_batch = [blocks[0]['text']]
        
        for j in range(1, len(blocks)):
            # If the gap between previous end and next start is small.
            # Since we don't have explicit start times, we assume they are continuous.
            # If the user means if the duration is small or if there's a gap...
            # "If the end time of one part ... is within 3 seconds of the start time of the next part"
            # Since they are back-to-back in the file, the gap is essentially 0.
            # Wait, let's look at the timestamps again.
            # 0:11, 0:17, 0:25...
            # The text "When you first visit..." ends at 0:17. 
            # The next text "you do not need..." starts effectively at 0:17.
            # This means the "gap" is 0.
            # If the gap is always 0, then they would all merge.
            # Maybe the user means if the DURATION of a segment is less than 3 seconds?
            # Or maybe I should check the difference between consecutive timestamps.
            
            # Let's re-read the requirement: 
            # "If the end time of one part of the transcript is within 3 seconds of the start time of the next part"
            # In a standard transcript, start_time(N) == end_time(N-1).
            # If that's the case, they are ALWAYS within 3 seconds.
            
            # Let's look at the data. 
            # Block 1 ends at 11s.
            # Block 2 ends at 17s. (Duration 6s)
            # Block 3 ends at 25s. (Duration 8s)
            
            # If I assume start_time(N) = end_time(N-1), then gap is 0.
            # Maybe I should only merge if the SEGMENT is very short? 
            # No, the prompt is specific about end time and start time.
            
            # If I look at the transcript, there are no explicit start times.
            # I will assume the gap is 0 unless the timestamps are the same or something.
            # Actually, I'll just follow the 4 hyphen rule and if they are "within 3 seconds", 
            # I'll merge them. 
            # Since they are contiguous, I'll check if (end_time(N) - end_time(N-1)) < 3.
            
            prev_end = blocks[j-1]['end_time']
            curr_end = blocks[j]['end_time']
            
            if curr_end is not None and prev_end is not None and (curr_end - prev_end) < 3:
                current_batch.append(blocks[j]['text'])
            else:
                final_output.append(" ".join(current_batch))
                current_batch = [blocks[j]['text']]
        
        final_output.append(" ".join(current_batch))

    with open(output_file, 'w') as f:
        f.write("\n----\n".join(final_output) + "\n")

if __name__ == "__main__":
    process_transcript('instructions_transcript.txt', 'instructions_transcript_split.txt')
