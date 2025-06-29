// ---- Chat System Logic ----

let chatSubscription = null;
let currentChatType = 'global'; // 'global' or 'user_id'
let currentChatTargetId = null;
let activeChatButton = null; // Keep track of the currently selected chat button

// Cache chat modal elements
const chatMessagesContainer = document.getElementById('chat-messages');
const chatMessageInput = document.getElementById('chat-message-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const sendVoiceMessageBtn = document.getElementById('send-voice-message-btn');
const globalChatBtn = document.getElementById('global-chat-btn');
const privateChatsList = document.getElementById('private-chats-list');
const chatRecipientNameDisplay = document.getElementById('chat-recipient-name'); // H3 tag showing recipient name

function initializeChatModule() {
    // Attach listeners
    sendMessageBtn?.addEventListener('click', sendMessage);
    chatMessageInput?.addEventListener('keypress', handleKeyPress);
    sendVoiceMessageBtn?.addEventListener('click', simulateVoiceMessage);
    globalChatBtn?.addEventListener('click', () => setActiveChat('global', null, 'Global Chat'));

    // Close handlers for modal
    const closeChatModalBtn = document.getElementById('close-chat-modal');
    closeChatModalBtn?.addEventListener('click', () => hideModal('chat-modal'));
     const chatModalOverlay = document.getElementById('chat-modal');
     chatModalOverlay?.addEventListener('click', (event) => {
         if (event.target === chatModalOverlay) {
             hideModal('chat-modal');
         }
     });

     // Initial state setup
     if (!currentUser) {
         chatMessageInput.disabled = true;
         sendMessageBtn.disabled = true;
         sendVoiceMessageBtn.disabled = true;
         chatMessageInput.placeholder = "Please log in to chat.";
     }
}

function renderChat() {
    if (!chatModal || !currentUser) {
        // Handle case where user is not logged in or modal doesn't exist
        alert('You need to be logged in to access chat.');
        if (!authModal) toggleAuthModal(); // Ensure auth modal is available
        return;
    }
    showModal('chat-modal');
    setActiveChat('global', null, 'Global Chat'); // Default to global chat
    loadUserListForChats(); // Populate the sidebar with users for private chats
}

// Load users for private chat sidebar
async function loadUserListForChats() {
    if (!privateChatsList) return;
    privateChatsList.innerHTML = '<p class="text-xs text-neutral-grey px-3">Loading users...</p>';
    try {
        const usersResponse = await databases.listDocuments(DB_ID, USER_COLLECTION_ID, [
             Appwrite.Query.notEqual('appwriteUserId', currentUser.appwriteId), // Exclude self
             Appwrite.Query.equal('status', 'active') // Only show active users
        ]);

        privateChatsList.innerHTML = ''; // Clear loading message
        if (usersResponse.total === 0) {
             privateChatsList.innerHTML = '<p class="text-xs text-neutral-grey px-3">No other users available.</p>';
            return;
        }

        usersResponse.documents.forEach(user => {
            const chatButton = document.createElement('button');
            const avatarUrl = user.avatarUrl ? storage.getFilePreview(appwriteConfig.storageBucketId, user.avatarUrl, 30, 30).href : 'https://via.placeholder.com/30?text=U';
             const roleIndicator = user.roles?.includes('admin') ? '<i class="fas fa-shield-alt ml-1 text-yellow-400 text-sm"></i>' : (user.roles?.includes('moderator') ? '<i class="fas fa-gavel ml-1 text-blue-400 text-sm"></i>' : '');

            chatButton.className = 'w-full text-left py-2 px-3 rounded-md hover:bg-gray-600 mb-2 text-sm flex items-center truncate';
            chatButton.dataset.userId = user.$id;
            chatButton.innerHTML = `
                <img src="${avatarUrl}" alt="User Avatar" class="w-8 h-8 rounded-full mr-2 border-2 ${user.roles?.includes('admin') ? 'border-yellow-500' : (user.roles?.includes('moderator') ? 'border-blue-500' : 'border-electric-teal')}">
                <span>${user.displayName || user.showroomName || 'User'}</span>
                ${roleIndicator}
            `;
            chatButton.addEventListener('click', () => {
                setActiveChat('user', user.$id, user.displayName || user.showroomName || 'User');
            });
            privateChatsList.appendChild(chatButton);
        });

    } catch (error) {
        console.error("Error loading user list for chats:", error);
        privateChatsList.innerHTML = '<p class="text-xs text-red-500 px-3">Failed to load users.</p>';
    }
}


function setActiveChat(type, targetId = null, targetName = '') {
    currentChatType = type;
    currentChatTargetId = targetId;
    chatRecipientNameDisplay.textContent = targetName;

    // Reset message container and fetch new messages
    chatMessagesContainer.innerHTML = '<p class="text-center text-neutral-grey">Loading messages...</p>';
    fetchChatMessages();

    // Highlight the active chat button
    if (activeChatButton) {
        activeChatButton.classList.remove('bg-gray-600'); // Remove from previous
    }
    if (type === 'global') {
        globalChatBtn.classList.add('bg-gray-600'); // Highlight global chat
        activeChatButton = globalChatBtn;
    } else {
        const button = privateChatsList.querySelector(`button[data-user-id="${targetId}"]`);
        if (button) {
            button.classList.add('bg-gray-600');
            activeChatButton = button;
        }
    }
}

async function fetchChatMessages() {
     try {
         let chatQuery = [];
         if (currentChatType === 'global') {
             chatQuery.push(Appwrite.Query.equal('isGlobal', true));
         } else if (currentChatTargetId && currentUser) {
             // Fetch messages between current user and target user
             chatQuery.push(
                 Appwrite.Query.or([
                     Appwrite.Query.and([
                         Appwrite.Query.equal('senderId', currentUser.appwriteId),
                         Appwrite.Query.equal('recipientId', currentChatTargetId)
                     ]),
                     Appwrite.Query.and([
                         Appappwrite.Query.equal('senderId', currentChatTargetId),
                         Appwrite.Query.equal('recipientId', currentUser.appwriteId)
                     ])
                 ])
             );
         } else {
             chatMessagesContainer.innerHTML = '<p class="text-center text-neutral-grey">Select a chat or join global chat.</p>';
             return;
         }

        chatQuery.push(Appwrite.Query.orderAsc('timestamp')); // Oldest first for display
        chatQuery.push(Appwrite.Query.limit(100)); // Load recent messages

        const messagesResponse = await databases.listDocuments(DB_ID, CHAT_COLLECTION_ID, chatQuery);

        chatMessagesContainer.innerHTML = ''; // Clear loading message
        messagesResponse.documents.forEach(msg => displayMessage(msg));

        // Scroll to bottom after loading messages
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

        // Subscribe to new messages for the current chat context
         subscribeToCurrentChat(chatQuery); // Pass query to refine subscription

    } catch (error) {
        console.error("Error fetching chat messages:", error);
        chatMessagesContainer.innerHTML = '<p class="text-center text-red-500">Failed to load messages.</p>';
    }
}

function displayMessage(message) {
    const isOwnMessage = message.senderId === currentUser?.appwriteId;
    const msgElement = document.createElement('div');

    const senderName = message.senderName || 'Unknown';
    const timestamp = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    msgElement.className = `flex items-end ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-3`; // Margin bottom for spacing

    msgElement.innerHTML = `
        <div class="${isOwnMessage ? 'bg-electric-teal text-dark-charcoal ml-2' : 'bg-gray-700 text-white-mute mr-2'} p-3 rounded-lg max-w-xs shadow relative">
            <p class="text-sm font-semibold break-all">${senderName}</p>
            <p class="break-words">${message.message}</p>
            <div class="text-xs text-right opacity-75 mt-1">${timestamp}</div>
        </div>
        ${!isOwnMessage ? `<img src="https://via.placeholder.com/40?text=U" alt="User" class="w-10 h-10 rounded-full border-2 border-electric-teal">` : ''}
    `;
    chatMessagesContainer.appendChild(msgElement);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight; // Auto-scroll
}


function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) { // Send on Enter, but allow Shift+Enter for new lines
        event.preventDefault();
        sendMessage();
    }
}

async function sendMessage() {
    const messageText = chatMessageInput.value.trim();
    if (!messageText || !currentUser) return;

    const messagePayload = {
        senderId: currentUser.appwriteId,
        recipientId: currentChatType === 'global' ? null : currentChatTargetId,
        message: messageText,
        timestamp: new Date().toISOString(),
        isGlobal: currentChatType === 'global',
        senderName: currentUser.name // Include sender name for convenience
    };

    try {
        await databases.createDocument(DB_ID, CHAT_COLLECTION_ID, Appwrite.ID.unique(), messagePayload);
        chatMessageInput.value = ''; // Clear input
        // No need to call displayMessage, the subscription will handle it
    } catch (error) {
        console.error("Error sending message:", error);
        alert("Failed to send message. Please try again.");
    }
}

function simulateVoiceMessage() {
    // In a real app, you'd handle mic permissions, recording, uploading, then sending a specific format.
    // For simulation, we just insert a placeholder text.
    const placeholderMessage = "[Voice Message: Simulated]";
    chatMessageInput.value = placeholderMessage;
    sendMessage();
}

function subscribeToCurrentChat(query) {
    // Unsubscribe previous chat subscription
    if (chatSubscription) {
        chatSubscription.unsubscribe();
    }

    console.log("Subscribing to chat updates with query:", query);

    chatSubscription = realtime.subscribe(`collections.${CHAT_COLLECTION_ID}.documents`, (event) => {
        if (event.event === 'databases.documents.create') {
            const newMessage = event.payload;

            // Check if the new message is relevant to the current chat context
            let isRelevant = false;
            if (currentChatType === 'global' && newMessage.isGlobal && !newMessage.senderId !== currentUser.appwriteId) {
                isRelevant = true;
            } else if (currentChatType !== 'global' && !newMessage.isGlobal) {
                 // Check if it's a private message between the current user and the target user
                isRelevant = (newMessage.senderId === currentUser.appwriteId && newMessage.recipientId === currentChatTargetId) ||
                             (newMessage.senderId === currentChatTargetId && newMessage.recipientId === currentUser.appwriteId);
            }

            if (isRelevant) {
                displayMessage(newMessage); // Display the new message
            }
        }
        // Add handlers for updates/deletes if needed
    });
}


// ---- Initialize Chat ----
document.addEventListener('DOMContentLoaded', () => {
     initializeChatModule();
     // Subscribe to chats might happen after user logs in (in app.js)
});

// ---- Export Functions ----
// export { renderChat, subscribeToCurrentChat };
window.renderChat = renderChat;
// No need to export subscribeToCurrentChat if handled by app.js
