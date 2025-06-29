// ---- Chat System Logic ----

// Cache chat modal elements and Firebase references
let chatMessagesContainer, chatMessageInput, sendMessageBtn, sendVoiceMessageBtn,
    globalChatBtn, privateChatsList, chatRecipientNameDisplay, chatModal;

let currentChatType = 'global'; // 'global' or 'user_id'
let currentChatTargetId = null;
let activeChatButton = null;
let chatMessagesListener = null; // Firestore listener for chat messages

function initializeChatModule() {
    // Cache chat modal elements
    chatMessagesContainer = document.getElementById('chat-messages');
    chatMessageInput = document.getElementById('chat-message-input');
    sendMessageBtn = document.getElementById('send-message-btn');
    sendVoiceMessageBtn = document.getElementById('send-voice-message-btn');
    globalChatBtn = document.getElementById('global-chat-btn');
    privateChatsList = document.getElementById('private-chats-list');
    chatRecipientNameDisplay = document.getElementById('chat-recipient-name');
    chatModal = document.getElementById('chat-modal');

    // Attach listeners
    sendMessageBtn?.addEventListener('click', sendMessage);
    chatMessageInput?.addEventListener('keypress', handleKeyPress);
    sendVoiceMessageBtn?.addEventListener('click', simulateVoiceMessage);
    globalChatBtn?.addEventListener('click', () => setActiveChat('global', null, 'Global Chat'));

    // Close handlers for modal (if not handled globally by app.js)
    const closeChatModalBtn = document.getElementById('close-chat-modal');
    closeChatModalBtn?.addEventListener('click', () => hideModal('chat-modal'));
    const chatModalOverlay = document.getElementById('chat-modal');
    chatModalOverlay?.addEventListener('click', (event) => {
        if (event.target === chatModalOverlay) {
            hideModal('chat-modal');
        }
    });
}

// Function to open and prepare the chat interface
function renderChat() {
    if (!currentUser) {
        alert('You need to be logged in to access chat.');
        if (typeof toggleAuthModal === 'function') toggleAuthModal(); // Show login modal
        return;
    }
    if (!chatModal) {
        console.error("Chat modal element not found.");
        return;
    }
    showModal('chat-modal');
    // Default view to global chat
    setActiveChat('global', null, 'Global Chat');
    // Load the list of users for private chats
    loadUserListForChats();
}

// Load users for the private chat sidebar
async function loadUserListForChats() {
    if (!privateChatsList || !firebaseDb || !currentUser) return;
    privateChatsList.innerHTML = '<p class="text-xs text-neutral-grey px-3">Loading users...</p>';
    try {
        // Fetch active users (excluding the current user)
        const usersSnapshot = await firebaseDb.collection(FIREBASE_USERS_COLLECTION)
            .where('status', '==', 'active')
            .where('uid', '!=', currentUser.uid) // Exclude self
            .orderBy('displayName') // Order alphabetically
            .get();

        privateChatsList.innerHTML = ''; // Clear loading message
        if (usersSnapshot.empty) {
            privateChatsList.innerHTML = '<p class="text-xs text-neutral-grey px-3">No other users available.</p>';
            return;
        }

        usersSnapshot.forEach(userDoc => {
            const user = userDoc.data();
            const userId = userDoc.id;
            const avatarUrl = user.avatarUrl ? firebaseStorage.ref().child(`${'car_images'}/${user.avatarUrl}`).getDownloadURL() : 'https://via.placeholder.com/30?text=U';
            const roleIndicator = user.roles?.includes('admin') ? '<i class="fas fa-shield-alt ml-1 text-yellow-400 text-sm"></i>' : (user.roles?.includes('moderator') ? '<i class="fas fa-gavel ml-1 text-blue-400 text-sm"></i>' : '');

            const chatButton = document.createElement('button');
            chatButton.className = 'w-full text-left py-2 px-3 rounded-md hover:bg-gray-600 mb-2 text-sm flex items-center truncate';
            chatButton.dataset.userId = userId;
            chatButton.innerHTML = `
                <img src="${avatarUrl}" alt="User Avatar" class="w-8 h-8 rounded-full mr-2 border-2 ${user.roles?.includes('admin') ? 'border-yellow-500' : (user.roles?.includes('moderator') ? 'border-blue-500' : 'border-electric-teal')}" onerror="this.onerror=null;this.src='https://via.placeholder.com/30?text=U';" >
                <span>${user.displayName || user.showroomName || 'User'}</span>
                ${roleIndicator}
            `;
            chatButton.addEventListener('click', () => {
                setActiveChat('user', userId, user.displayName || user.showroomName || 'User');
            });
            privateChatsList.appendChild(chatButton);
        });

    } catch (error) {
        console.error("Error loading user list for chats:", error);
        privateChatsList.innerHTML = '<p class="text-xs text-red-500 px-3">Failed to load users.</p>';
    }
}

// Sets the active chat view (global or private)
function setActiveChat(type, targetId = null, targetName = '') {
    currentChatType = type;
    currentChatTargetId = targetId;
    if(chatRecipientNameDisplay) chatRecipientNameDisplay.textContent = targetName;

    // Reset message container and fetch new messages
    if(chatMessagesContainer) chatMessagesContainer.innerHTML = '<p class="text-center text-neutral-grey">Loading messages...</p>';

    // Unsubscribe from previous listeners before setting new chat
    if (chatMessagesListener) {
        chatMessagesListener(); // Call the unsubscribe function
        chatMessagesListener = null;
    }
    fetchChatMessages(); // Fetch messages for the new chat context

    // Highlight the active chat button in the sidebar
    if (activeChatButton) {
        activeChatButton.classList.remove('bg-gray-600'); // Remove highlight from previous
    }
    if (type === 'global') {
        globalChatBtn.classList.add('bg-gray-600'); // Highlight global chat button
        activeChatButton = globalChatBtn;
    } else {
        const button = privateChatsList.querySelector(`button[data-user-id="${targetId}"]`);
        if (button) {
            button.classList.add('bg-gray-600');
            activeChatButton = button;
        }
    }
}

// Fetch chat messages from Firestore
async function fetchChatMessages() {
    if (!firebaseDb || !currentUser) {
        console.error("Firebase DB or Current User not available for fetching messages.");
        return;
    }
    try {
        let chatQueryConstraints = [];
        if (currentChatType === 'global') {
            chatQueryConstraints.push(firebase.firestore.FieldPath.documentId()); // Dummy constraint if needed, otherwise just filter by isGlobal
            chatQueryConstraints.push(firebase.firestore.FieldPath.documentId());
            // Add a constraint that requires checking isGlobal within the query logic or filter it later if Firestore doesn't directly support query on FieldPath.
            // A better way is to add `isGlobal: true` to the global chat messages.
            // For now, we'll fetch all messages and filter client-side if needed or rely on proper Firestore queries.
             chatQueryConstraints.push(firebase.firestore.FieldPath.documentId()); // Add placeholder to satisfy query requirement
            // Actual query for global:
             chatQueryConstraints = [firebaseDb.collection(FIREBASE_CHATS_COLLECTION).where('isGlobal', '==', true)];

        } else if (currentChatType === 'user' && currentChatTargetId) {
            // Fetch messages between the current user and the target user
            chatQueryConstraints = [
                firebaseDb.collection(FIREBASE_CHATS_COLLECTION)
                .where('participants', 'array-contains', currentUser.uid) // Assumes 'participants' array field exists
                .where('participants', 'array-contains', currentChatTargetId)
                // .where('isGlobal', '==', false) // Ensure not global chat (if this field exists)
                .orderBy('timestamp', 'asc') // Order messages by timestamp
                .limit(100) // Limit to recent messages
            ];
             // OR if participants field isn't used:
             // chatQueryConstraints = [
             //     firebaseDb.collection(FIREBASE_CHATS_COLLECTION)
             //     .where(firebase.firestore.FieldPath.documentId(), '>=', `${currentUser.uid}_${currentChatTargetId}_${Date.now()}`) // Placeholder for OR logic
             //     .where(firebase.firestore.FieldPath.documentId(), '<=', `${currentChatTargetId}_${currentUser.uid}_${Date.now()}`) // Placeholder
             // ];
            // This direct OR query is tricky in Firestore without specific data modeling.
            // A common approach: Store messages with sender/recipient and fetch where sender OR recipient matches.
             chatQueryConstraints = [
                 firebaseDb.collection(FIREBASE_CHATS_COLLECTION)
                .where(firebase.firestore.FieldPath.documentId(), '>', 'invalid_string_to_ensure_empty') // Hack to make a valid query
                .get().then(snapshot => { // Manually filter snapshot
                     const relevantMessages = [];
                     snapshot.forEach(doc => {
                         const msg = doc.data();
                         const isBetweenUsers = (msg.senderId === currentUser.uid && msg.recipientId === currentChatTargetId) ||
                                              (msg.senderId === currentChatTargetId && msg.recipientId === currentUser.uid);
                         if (isBetweenUsers) {
                             relevantMessages.push({ id: doc.id, ...msg });
                         }
                     });
                     return { docs: relevantMessages, empty: relevantMessages.length === 0 };
                 })
            ];
             // A more performant Firestore query for bidirectional messages:
            chatQueryConstraints = [
                // Fetch messages sent by me to target, and sent by target to me
                 firebaseDb.collection(FIREBASE_CHATS_COLLECTION)
                 .where('recipientId', '==', currentChatTargetId) // My messages to target
                 .where('senderId', '==', currentUser.uid)
                 .orderBy('timestamp', 'asc'),
                firebaseDb.collection(FIREBASE_CHATS_COLLECTION)
                 .where('recipientId', '==', currentUser.uid) // Target's messages to me
                 .where('senderId', '==', currentChatTargetId)
                 .orderBy('timestamp', 'asc')
            ];
             // Fetching from two queries and merging/sorting is needed. Simpler for now: rely on listener + simpler fetch.

            // Simplified fetch for demo purposes - get all and filter might be easier to start:
            const allMessagesSnapshot = await firebaseDb.collection(FIREBASE_CHATS_COLLECTION)
                 .orderBy('timestamp', 'asc')
                 .limit(100)
                 .get();
            const relevantMessages = [];
             allMessagesSnapshot.forEach(doc => {
                const msg = doc.data();
                const isRelevant = (msg.isGlobal === false) && // Ensure not global
                                  ((msg.senderId === currentUser.uid && msg.recipientId === currentChatTargetId) ||
                                   (msg.senderId === currentChatTargetId && msg.recipientId === currentUser.uid));
                 if (isRelevant) {
                     relevantMessages.push({ id: doc.id, ...msg });
                 }
             });
            return { docs: relevantMessages, empty: relevantMessages.length === 0 };
        }

        // Fetch messages
        let messagesSnapshot;
        if (currentChatType === 'global') {
             messagesSnapshot = await firebaseDb.collection(FIREBASE_CHATS_COLLECTION)
                 .where('isGlobal', '==', true)
                 .orderBy('timestamp', 'asc')
                 .limit(100)
                 .get();
        } else if (currentChatType === 'user' && currentChatTargetId) {
             // Using the simpler, but less efficient, fetch+filter approach for demo
             // Replace with proper Firestore OR queries or Union queries if needed later
             const allMessagesSnapshot = await firebaseDb.collection(FIREBASE_CHATS_COLLECTION)
                 .orderBy('timestamp', 'asc')
                 .limit(100)
                 .get();
            const relevantMessages = [];
             allMessagesSnapshot.forEach(doc => {
                const msg = doc.data();
                const isRelevant = (msg.isGlobal === false) && // Ensure not global
                                  ((msg.senderId === currentUser.uid && msg.recipientId === currentChatTargetId) ||
                                   (msg.senderId === currentChatTargetId && msg.recipientId === currentUser.uid));
                 if (isRelevant) {
                     relevantMessages.push({ id: doc.id, ...msg });
                 }
             });
            messagesSnapshot = { docs: relevantMessages, empty: relevantMessages.length === 0 };
        } else {
            chatMessagesContainer.innerHTML = '<p class="text-center text-neutral-grey">Select a chat or join the global chat.</p>';
            return;
        }


        chatMessagesContainer.innerHTML = ''; // Clear loading message
        if (messagesSnapshot.empty) {
             chatMessagesContainer.innerHTML = '<p class="text-center text-neutral-grey">Start the conversation!</p>';
        } else {
            messagesSnapshot.docs.forEach(msgDoc => displayMessage({ id: msgDoc.id, ...msgDoc.data() }));
        }

        // Scroll to bottom after loading messages
        if(chatMessagesContainer) chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

        // Set up the Firestore listener for new messages
         subscribeToCurrentChat();

    } catch (error) {
        console.error("Error fetching chat messages:", error);
        chatMessagesContainer.innerHTML = '<p class="text-center text-red-500">Failed to load messages.</p>';
    } finally {
        // Loader hide should be managed by the caller (renderChat)
    }
}

// Display a single message bubble in the chat
function displayMessage(message) {
    const isOwnMessage = message.senderId === currentUser?.uid;
    const msgElement = document.createElement('div');

    const senderName = message.senderName || 'Unknown';
    const timestamp = message.timestamp ? new Date(message.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    msgElement.className = `flex items-end ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-3`;

    msgElement.innerHTML = `
        <div class="${isOwnMessage ? 'bg-electric-teal text-dark-charcoal ml-2' : 'bg-gray-700 text-white-mute mr-2'} p-3 rounded-lg max-w-xs shadow relative">
            <p class="text-sm font-semibold break-all">${senderName}</p>
            <p class="break-words">${message.message}</p>
            <div class="text-xs text-right opacity-75 mt-1">${timestamp}</div>
        </div>
        ${!isOwnMessage ? `<img src="https://via.placeholder.com/40?text=U" alt="User" class="w-10 h-10 rounded-full border-2 border-electric-teal">` : ''}
    `;
    if(chatMessagesContainer) chatMessagesContainer.appendChild(msgElement);
    if(chatMessagesContainer) chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight; // Auto-scroll
}


// Handles sending a message
async function sendMessage() {
    const messageText = chatMessageInput.value.trim();
    if (!messageText || !currentUser || !firebaseAuth || !firebaseDb) return;

    const messagePayload = {
        senderId: currentUser.uid,
        recipientId: currentChatType === 'global' ? null : currentChatTargetId, // Null for global chat
        message: messageText,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(), // Server timestamp
        isGlobal: currentChatType === 'global',
        senderName: currentUser.name // Include sender name for convenience
    };

    try {
        await firebaseDb.collection(FIREBASE_CHATS_COLLECTION).add(messagePayload);
        chatMessageInput.value = ''; // Clear input field
        // Message will be displayed via the Firestore listener (onSnapshot)
    } catch (error) {
        console.error("Error sending message:", error);
        alert("Failed to send message. Please try again.");
    }
}

// Simulates voice message by sending a placeholder text
function simulateVoiceMessage() {
    const placeholderMessage = "[Voice Message: Simulated]";
    chatMessageInput.value = placeholderMessage;
    sendMessage(); // Send the placeholder message
}

// Handles Enter key press for sending messages
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) { // Send on Enter, allow Shift+Enter for new lines
        event.preventDefault();
        sendMessage();
    }
}

// Sets up Firestore listener for new messages in the current chat context
function subscribeToCurrentChat() {
    if (chatMessagesListener) {
        chatMessagesListener(); // Unsubscribe previous listener
        chatMessagesListener = null;
    }

    if (!firebaseDb || !currentUser) return;

    console.log(`Subscribing to chat messages for type: ${currentChatType}, target: ${currentChatTargetId}`);

    try {
        let chatQuery;
        if (currentChatType === 'global') {
            // Listener for global messages
            chatQuery = firebaseDb.collection(FIREBASE_CHATS_COLLECTION)
                .where('isGlobal', '==', true)
                .orderBy('timestamp', 'asc')
                .limit(100); // Load recent global messages
        } else if (currentChatType === 'user' && currentChatTargetId) {
            // Listener for private messages between currentUser and currentChatTargetId
            // This is tricky with Firestore for bidirectional queries directly.
            // A common pattern is to have a 'participants' array or duplicate messages.
            // Using 'participants' array query:
            chatQuery = firebaseDb.collection(FIREBASE_CHATS_COLLECTION)
                 .where('participants', 'array-contains', currentUser.uid)
                 .where('participants', 'array-contains', currentChatTargetId)
                 .orderBy('timestamp', 'asc')
                 .limit(100); // Fetch recent messages for this chat
        } else {
            // No valid chat context
            chatMessagesContainer.innerHTML = '<p class="text-center text-neutral-grey">Select a chat or join the global chat.</p>';
            return;
        }

        // Set up the actual listener
        chatMessagesListener = chatQuery.onSnapshot((snapshot) => {
            chatMessagesContainer.innerHTML = ''; // Clear messages before re-rendering from snapshot
            if (snapshot.empty) {
                chatMessagesContainer.innerHTML = '<p class="text-center text-neutral-grey">Start the conversation!</p>';
                return;
            }
            snapshot.forEach(doc => displayMessage({ id: doc.id, ...doc.data() }));
            if(chatMessagesContainer) chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight; // Scroll to bottom
        }, (error) => {
            console.error("Error listening to chat messages:", error);
            chatMessagesContainer.innerHTML = '<p class="text-center text-red-500">Failed to load messages.</p>';
        });

    } catch (error) {
        console.error("Error setting up chat listener:", error);
         chatMessagesContainer.innerHTML = '<p class="text-center text-red-500">Error setting up chat listener.</p>';
    }
}

// ---- Module Initialization ----
document.addEventListener('DOMContentLoaded', () => {
     initializeChatModule();
});

// ---- Export/Make Functions Accessible ----
window.renderChat = renderChat;
window.subscribeToChat = subscribeToCurrentChat; // F
