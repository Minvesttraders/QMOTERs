// ---- Global Constants and Initialization ----

// Appwrite Configuration (Replace with your actual values)
const appwriteConfig = {
    endpoint: 'https://cloud.appwrite.io/v1',
    projectId: 'YOUR_PROJECT_ID', // e.g., '685ed548003693db4ec5'
    apiKey: 'YOUR_API_KEY', // e.g., 'standard_...'
    storageBucketId: 'car_images' // Your storage bucket ID
};

// Appwrite SDK instances
let client, account, databases, storage, realtime;

// Cache common DOM elements
let appHeader, mainContent, appContentContainer, loaderOverlay, emptyState,
    authModal, loginForm, signupForm, postCarModal, carDetailModal, chatModal, adminPanelModal,
    postCarBtn, searchInput, profileIcon, userMenu, langToggleBtn, usernameDisplay, logoutBtn, adminPanelLink;

let currentUser = null;
let isAdmin = false;
let isModerator = false;
let activeLang = 'en';

// Database and Collection IDs (Define these clearly)
const DB_ID = '6697c0f60034f4c0ffb6'; // e.g., 'user_db'
const USER_COLLECTION_ID = '6697c11300319966b205'; // e.g., 'users'
const POST_COLLECTION_ID = '6697c13d0024a233912c'; // e.g., 'posts'
const CHAT_COLLECTION_ID = '6697c1a7002e9ff3713f'; // e.g., 'chats'

// ---- Appwrite Client Setup ----
function initializeAppwrite() {
    client = new Appwrite.Client();
    client
        .setEndpoint(appwriteConfig.endpoint)
        .setProject(appwriteConfig.projectId)
        .setKey(appwriteConfig.apiKey); // For server-side logic if needed

    account = new Appwrite.Account(client);
    databases = new Appwrite.Databases(client);
    storage = new Appwrite.Storage(client);
    realtime = new Appwrite.Realtime(client);

    console.log("Appwrite initialized.");
}

// ---- DOM Element Caching ----
function cacheDOMElements() {
    appHeader = document.getElementById('app-header');
    mainContent = document.getElementById('main-content');
    appContentContainer = document.getElementById('app-content');
    loaderOverlay = document.getElementById('loader-overlay');
    emptyState = document.getElementById('empty-state');

    // Modals (Ensure these IDs exist in your HTML structure or are loaded)
    authModal = document.getElementById('auth-modal');
    postCarModal = document.getElementById('post-car-modal');
    carDetailModal = document.getElementById('car-detail-modal');
    chatModal = document.getElementById('chat-modal');
    adminPanelModal = document.getElementById('admin-panel-modal');

    // Header Elements
    postCarBtn = document.getElementById('post-car-btn');
    searchInput = document.getElementById('search-input');
    const searchInputMobile = document.getElementById('search-input-mobile'); // Cache mobile too
    profileIcon = document.getElementById('profile-icon');
    userMenu = document.getElementById('user-menu');
    logoutBtn = document.getElementById('logout-btn');
    langToggleBtn = document.getElementById('lang-toggle-btn');
    usernameDisplay = document.getElementById('username-display');
    adminPanelLink = document.getElementById('admin-panel-link');

    // Form Caching (needed by specific modules)
    loginForm = document.getElementById('login-form');
    signupForm = document.getElementById('signup-form');

    // Attach event listeners for header elements managed by app.js
    postCarBtn?.addEventListener('click', handlePostCarClick); // Use specific handler
    searchInput?.addEventListener('input', handleSearch);
    searchInputMobile?.addEventListener('input', handleSearch);
    profileIcon?.addEventListener('click', toggleUserMenu);
    logoutBtn?.addEventListener('click', handleLogout);
    langToggleBtn?.addEventListener('click', toggleLanguageOptions); // Need a function to show/hide language options
    adminPanelLink?.addEventListener('click', handleAdminPanelClick);

    // Set up generic modal close listeners
     document.querySelectorAll('.modal-close-btn, .modal-overlay').forEach(el => {
         el.addEventListener('click', (event) => {
             // Find the closest modal overlay and hide it
             const modalOverlay = event.target.closest('.modal-overlay');
             if (modalOverlay) {
                 hideModal(modalOverlay.id);
            }
        });
    });

     // Ensure auth modal switches views correctly
    document.getElementById('show-signup-btn')?.addEventListener('click', () => switchAuthView(true));
    document.getElementById('show-login-btn')?.addEventListener('click', () => switchAuthView(false));
    loginForm?.addEventListener('submit', handleLoginSubmit);
    signupForm?.addEventListener('submit', handleSignupSubmit);
    // Add handlers for profile view/close etc.
     document.getElementById('view-profile-link')?.addEventListener('click', handleViewProfileClick);
}

// ---- Utility Functions (move to utils.js later) ----
function showLoader() { loaderOverlay?.classList.remove('hidden'); }
function hideLoader() { loaderOverlay?.classList.add('hidden'); }

function showModal(modalId) {
    const modalOverlay = document.getElementById(modalId);
    if (!modalOverlay) return;
    modalOverlay.classList.add('visible');
    const modalContent = modalOverlay.querySelector('.modal-content');
    if (modalContent) {
        // Force reflow for transition to apply
        modalContent.offsetHeight; // Reading offsetHeight triggers reflow
        modalContent.style.opacity = '1';
        modalContent.style.transform = 'scale(1)';
    }
}

function hideModal(modalId) {
    const modalOverlay = document.getElementById(modalId);
    if (!modalOverlay) return;
    const modalContent = modalOverlay.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.opacity = '0';
        modalContent.style.transform = 'scale(0.95)';
        setTimeout(() => {
            modalOverlay.classList.remove('visible');
            // Reset styles for next time
            modalContent.style.opacity = '';
            modalContent.style.transform = '';
        }, 300); // Match CSS transition duration
    } else {
        modalOverlay.classList.remove('visible');
    }
}

// Function to set/display language
function displayLanguage(lang) {
    activeLang = lang;
    const langTextElement = document.getElementById('lang-text'); // Assuming span with id="lang-text" in header
    if (langTextElement) {
        langTextElement.textContent = lang.toUpperCase();
    }

    // Trigger language updates in other modules
    if (typeof updateUIText === 'function') {
        updateUIText(lang);
    }
    console.log(`Language set to: ${lang}`);
}

function setLanguage(lang) {
    displayLanguage(lang);
    // Save preference to localStorage maybe
    localStorage.setItem('appLanguage', lang);
}

// ---- Main Application Logic ----
function initializeApp() {
    console.log("Initializing application...");
    initializeAppwrite();
    cacheDOMElements();

    // Try to restore language preference
    const savedLang = localStorage.getItem('appLanguage') || 'en';
    setLanguage(savedLang);

    // Check user session on load
    fetchCurrentUser().then(() => {
        // Initial rendering after user data is fetched
        renderCurrentView(); // Based on auth state and URL hash
        subscribeToAppState(); // Subscribe to posts, users, etc.
    }).catch(error => {
        console.error("Error during initial app load:", error);
        // Fallback: Render feed as guest, maybe show login prompt
        renderFeed(); // Public feed view
        // showModal('auth-modal'); // Optionally show login modal immediately
    }).finally(() => {
        // Ensure loader is hidden and content is ready
        hideLoader();
    });
}

// ---- Routing and View Management ----
function renderCurrentView() {
    const hash = window.location.hash || '#feed'; // Default to feed
    showLoader(); // Show loader while changing view

    // Clear previous content
    appContentContainer.innerHTML = '<p class="text-center text-neutral-grey col-span-full">Loading content...</p>';

    switch (hash) {
        case '#feed':
            renderFeed(); // Load feed module
            break;
        case '#profile':
            // Logic to get user ID from hash (e.g., #profile/userId) or use current user's profile
            const userId = hash.split('/')[1] || (currentUser ? currentUser.appwriteId : null);
            if (userId) {
                renderUserProfile(userId); // Load profile module
            } else {
                alert('Please log in or specify a user profile.');
                window.location.hash = '#feed'; // Redirect back
            }
            break;
        case '#chat':
            renderChat(); // Load chat module
            break;
        case '#admin':
            if (isAdmin) {
                renderAdminPanel(); // Load admin module
            } else {
                alert('You do not have administrator privileges.');
                window.location.hash = '#feed'; // Redirect back
            }
            break;
        // Add cases for other views like login/signup if they are page-based
        default:
            renderFeed(); // Default view
    }
    hideLoader(); // Hide loader once content is loaded
}

// Listen for hash changes to handle routing
window.addEventListener('hashchange', renderCurrentView);

// ---- Event Handlers ----
// Placeholders for handlers delegated from app.js or called from specific modules

function handlePostCarClick() {
    if (!currentUser) {
        alert('Please log in to post a car.');
        showModal('auth-modal');
        return;
    }
    // Call function from posting.js
    openPostCarModal();
}

function handleSearch() {
    const searchTerm = (searchInput?.value || searchInputMobile?.value || '').trim().toLowerCase();
    // Call renderFeed with the search term (defined in feed.js)
    if (typeof renderFeed === 'function') {
        renderFeed(searchTerm);
    }
}

function toggleUserMenu() {
    userMenu.classList.toggle('hidden');
}

function hideUserMenuOnClickOutside() {
    document.addEventListener('click', (e) => {
        if (!userMenu.contains(e.target) && !profileIcon.contains(e.target)) {
            userMenu.classList.add('hidden');
        }
    });
}
hideUserMenuOnClickOutside(); // Call once

function handleLogout() {
    // Call function from auth.js
    logoutUser();
    userMenu.classList.add('hidden'); // Close menu
}

function toggleLanguageOptions() {
    // Implement UI to show/hide language options (e.g., a dropdown)
    console.log('Toggle language options');
    // Example: show a small menu near the toggle button
}

function handleAdminPanelClick() {
    if (isAdmin) {
        window.location.hash = '#admin'; // Navigate to admin view
    } else {
        alert('You do not have administrator privileges.');
    }
}

function handleLoginSubmit(event) {
    event.preventDefault();
    // Call login function from auth.js
    const email = loginForm.elements['login-email'].value;
    const password = loginForm.elements['login-password'].value;
    loginUser(email, password);
}

function handleSignupSubmit(event) {
    event.preventDefault();
    // Call signup function from auth.js
    const name = signupForm.elements['signup-name'].value;
    const email = signupForm.elements['signup-email'].value;
    const password = signupForm.elements['signup-password'].value;
    signupUser(name, email, password);
}

function handleViewProfileClick() {
     if (!currentUser) {
         alert('Please log in to view your profile.');
         showModal('auth-modal');
        return;
    }
    window.location.hash = `#profile/${currentUser.appwriteId}`; // Navigate to own profile
     userMenu.classList.add('hidden'); // Close menu
}

// ---- State Management & Realtime ----
async function fetchCurrentUser() {
    showLoader();
    try {
        const session = await account.get();
        const userDoc = await databases.getDocument(DB_ID, USER_COLLECTION_ID, session.$id); // Fetch user doc using session ID

        currentUser = {
            appwriteId: session.$id,
            email: session.email,
            name: userDoc.displayName || session.name, // Use name from user doc if available
            status: userDoc.status || 'active',
            roles: userDoc.roles || ['user'],
            avatarUrl: userDoc.avatarUrl,
            showroomName: userDoc.showroomName,
            contactInfo: userDoc.contactInfo,
            rating: userDoc.rating
        };

        isAdmin = currentUser.roles.includes('admin');
        isModerator = currentUser.roles.includes('moderator');

        // Update header dynamically
        usernameDisplay.textContent = currentUser.name;
        profileIcon.classList.remove('hidden');
        postCarBtn.classList.remove('hidden');
        adminPanelLink.classList.toggle('hidden', !isAdmin); // Show/hide admin link

        console.log("Current user loaded:", currentUser);

    } catch (error) {
        console.log("No active session found or session expired:", error);
        currentUser = null;
        isAdmin = false;
        isModerator = false;
        usernameDisplay.textContent = 'Guest';
        profileIcon.classList.add('hidden');
        postCarBtn.classList.add('hidden');
        adminPanelLink.classList.add('hidden');
        // If not logged in, show auth modal potentially on feed page load
        if (window.location.hash === '' || window.location.hash === '#feed') {
             // Optionally show login prompt
            // showModal('auth-modal');
        }
    } finally {
        hideLoader();
    }
}

function subscribeToAppState() {
    // Subscribe to posts for real-time feed updates
    if (typeof subscribeToPostsFeed === 'function') {
        subscribeToPostsFeed(); // Defined in feed.js
    }

    // Subscribe to user status changes if necessary
    if (typeof subscribeToUserStatus === 'function') {
         subscribeToUserStatus(currentUser?.appwriteId); // Defined in app or user module
    }

    // Subscribe to chats if user is logged in
     if (currentUser && typeof subscribeToChat === 'function') {
         subscribeToChat(); // Defined in chat.js
     }
}

// ---- Main Initialization ----
// Call this once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});
