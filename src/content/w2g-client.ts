// Function to emit a message into the chat container
export function sendToAll(message: string) {
    const chatInput = document.getElementById('w2g-chat-input') as HTMLInputElement | HTMLTextAreaElement;
    if (chatInput) {
        chatInput.value = message;
        chatInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        chatInput.dispatchEvent(new Event('w2gsubmit', { bubbles: true, cancelable: true }));
    }
}
