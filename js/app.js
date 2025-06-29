// ---- Global Constants and Initialization ----

// ---- **** YE APKI FIREBASE CONFIG HAI **** ----
// Isko Firebase Console se Copy Kiya Gaya Hai
const firebaseConfig = {
  apiKey: "AIzaSyAeIpxacjWnF2EtxbTrwEppCSv_EakiNps",
  authDomain: "quettamoters.firebaseapp.com",
  projectId: "quettamoters",
  storageBucket: "quettamoters.firebasestorage.app",
  messagingSenderId: "1053883160547",
  appId: "1:1053883160547:web:d07e4e3c14e91d43ff32d6"
};

// Firebase Services ke Instances (Global Variables)
let firebaseAuth, firebaseDb, firebaseStorage;

// Cache common DOM elements
let appHeader, mainContent, appContentContainer, loaderOverlay, emptyState,
    authModal, loginForm, signupForm, postCarModal, carDetailModal, chatModal, adminPanelModal,
    postCarBtn, searchInput, profileIcon, userMenu, langToggleBtn, usernameDisplay, logoutBtn, adminPanelLink;

let currentUser = null; // User Object jo logged-in user ka data rakhega
let isAdmin = false;    // Agar user admin hai toh true
let isModerator = false;// Agar user moderator hai toh true
let activeLang = 'en';  // Current selected language

// --- Database & Collection References (Ye Firebase Firestore ke liye hain) ---
// Important: Inhein Firestore mein aapke banaye gaye collection names se match karen.
const FIREBASE_USERS_COLLECTION = 'users';
const FIREBASE_POSTS_COLLECTION = 'posts';
const FIREBASE_CHATS_COLLECTION = 'chats';

// ---- Firebase Initialization ----
function initializeFirebaseApp() {
    if (firebase.apps.length === 0) { // Check agar pehle se initialize nahi hua
        try {
            // Initialize Firebase using the provided config
            firebase.initializeApp(firebaseConfig);
            // Get Firebase service instances
            firebaseAuth = firebase.auth();
            firebaseDb = firebase.firestore();
            firebaseStorage = firebase.storage();
            console.log("Firebase initialized successfully.");
            return true; // Success
        } catch (error) {
            console.error("Error initializing Firebase:", error);
            alert("Firebase initialization failed. Please check console for details.");
            // Update UI to show error if initialization fails
            if (appContentContainer) {
                 appContentContainer.innerHTML = '<p class="text-center text-red-500 col-span-full">Failed to initialize Firebase. Please check logs.</p>';
            }
            return false; // Failure
        }
    } else {
        console.log("Firebase already initialized.");
        // Ensure services are accessible if already initialized
        firebaseAuth = firebase.auth();
        firebaseDb = firebase.firestore();
        firebaseStorage = firebase.storage();
        return true; // Already initialized
    }
}

// ---- User Session Management (Firebase Adapted) ----
function fetchCurrentUser() {
    return new Promise((resolve, reject) => {
        // Listen for authentication state changes using Firebase Auth
        firebaseAuth.onAuthStateChanged(async (user) => {
            if (user) {
                // --- User is logged in ---
                console.log("Firebase User logged in:", user);
                try {
                    // Fetch user data from Firestore using the user's UID
                    const userDocRef = firebaseDb.collection(FIREBASE_USERS_COLLECTION).doc(user.uid);
                    const userDoc = await userDocRef.get();

                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        currentUser = {
                            uid: user.uid, // Firebase UID is the unique identifier
                            email: user.email,
                            name: userData.displayName || user.displayName || 'User', // Use data from Firestore first
                            status: userData.status || 'active',
                            roles: userData.roles || ['user'],
                            avatarUrl: userData.avatarUrl,
                            showroomName: userData.showroomName,
                            contactInfo: userData.contactInfo,
                            rating: userData.rating
                        };
                        isAdmin = currentUser.roles.includes('admin');
                        isModerator = currentUser.roles.includes('moderator');

                        // Update UI elements based on logged-in state
                        if (usernameDisplay) usernameDisplay.textContent = currentUser.name;
                        if (profileIcon) profileIcon.classList.remove('hidden');
                        if (postCarBtn) postCarBtn.classList.remove('hidden');
                        if (adminPanelLink) adminPanelLink.classList.toggle('hidden', !isAdmin);

                        console.log("Current user data loaded:", currentUser);
                        resolve(currentUser); // Resolve the promise with user data
                    } else {
                        // Handle case: User authenticated but profile not found in Firestore
                        console.error("Firestore user document not found for UID:", user.uid);
                        alert("User profile missing. Please contact support.");
                        reject(new Error("User profile missing."));
                    }
                } catch (dbError) {
                    console.error("Error fetching user data from Firestore:", dbError);
                    reject(dbError); // Reject promise on Firestore error
                }
            } else {
                // --- User is not logged in ---
                console.log("No Firebase user logged in.");
                currentUser = null;
                isAdmin = false;
                isModerator = false;

                // Update UI elements for logged-out state
                if (usernameDisplay) usernameDisplay.textContent = 'Guest';
                if (profileIcon) profileIcon.classList.add('hidden');
                if (postCarBtn) postCarBtn.classList.add('hidden');
                if (adminPanelLink) adminPanelLink.classList.add('hidden');

                resolve(null); // Resolve the promise with null user
            }
            // Hide loader after auth state is determined
            hideLoader();
        });
    });
}

// ---- Adapt Logout Function for Firebase ----
async function logoutUser() {
    showLoader();
    try {
        await firebaseAuth.signOut(); // Use Firebase's signOut method
        // Reset local state variables
        currentUser = null;
        isAdmin = false;
        isModerator = false;

        // Update UI elements to logged-out state
        if (usernameDisplay) usernameDisplay.textContent = 'Guest';
        if (profileIcon) profileIcon.classList.add('hidden');
        if (postCarBtn) postCarBtn.classList.add('hidden');
        if (adminPanelLink) adminPanelLink.classList.add('hidden');
        if (userMenu) userMenu.classList.add('hidden'); // Close the user menu

        alert('Logout successful!');
        // Redirect or reload page to reflect logged-out state
        window.location.hash = '#feed'; // Navigate back to the feed
        renderCurrentView(); // Re-render the view (feed as guest)
    } catch (error) {
        console.error("Firebase logout failed:", error);
        alert("Logout failed. Please try again.");
    } finally {
        hideLoader();
    }
}

// ---- DOM Caching and Event Listeners Setup ----
function cacheDOMElements() {
    // Header Elements
    appHeader = document.getElementById('app-header');
    postCarBtn = document.getElementById('post-car-btn');
    searchInput = document.getElementById('search-input');
    const searchInputMobile = document.getElementById('search-input-mobile'); // Cache mobile too
    profileIcon = document.getElementById('profile-icon');
    userMenu = document.getElementById('user-menu');
    logoutBtn = document.getElementById('logout-btn');
    langToggleBtn = document.getElementById('lang-toggle-btn');
    usernameDisplay = document.getElementById('username-display');
    adminPanelLink = document.getElementById('admin-panel-link');

    // Main Content Areas
    mainContent = document.getElementById('main-content');
    appContentContainer = document.getElementById('app-content');
    loaderOverlay = document.getElementById('loader-overlay');
    emptyState = document.getElementById('empty-state');

    // Modals (Get references)
    authModal = document.getElementById('auth-modal');
    postCarModal = document.getElementById('post-car-modal');
    carDetailModal = document.getElementById('car-detail-modal');
    chatModal = document.getElementById('chat-modal');
    adminPanelModal = document.getElementById('admin-panel-modal');

    // Forms within modals
    loginForm = document.getElementById('login-form');
    signupForm = document.getElementById('signup-form');

    // --- Attach Event Listeners Managed by App.js ---
    // Header Button Listeners
    postCarBtn?.addEventListener('click', handlePostCarClick); // Handled in posting.js, called from here
    searchInput?.addEventListener('input', handleSearch);
    if(searchInputMobile) searchInputMobile.addEventListener('input', handleSearch);
    profileIcon?.addEventListener('click', toggleUserMenu);
    logoutBtn?.addEventListener('click', handleLogout);
    langToggleBtn?.addEventListener('click', toggleLanguageOptions);
    adminPanelLink?.addEventListener('click', handleAdminPanelClick);

    // Auth Modal View Switching
    document.getElementById('show-signup-btn')?.addEventListener('click', () => switchAuthView(true));
    document.getElementById('show-login-btn')?.addEventListener('click', () => switchAuthView(false));
    loginForm?.addEventListener('submit', handleLoginSubmit);
    signupForm?.addEventListener('submit', handleSignupSubmit);

    // Profile Menu Toggling
    document.getElementById('view-profile-link')?.addEventListener('click', handleViewProfileClick);

    // Modal Closing Listeners (General)
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', (event) => {
            const modalOverlay = event.target.closest('.modal-overlay');
            if (modalOverlay) hideModal(modalOverlay.id);
        });
    });
    // Close modal when clicking outside the content
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) { // Clicked directly on the overlay background
                hideModal(modal.id);
            }
        });
    });
}

// ---- Utility Functions (Moved core ones here) ----
function showLoader() { loaderOverlay?.classList.remove('hidden'); }
function hideLoader() { loaderOverlay?.classList.add('hidden'); }

function showModal(modalId) {
    const modalOverlay = document.getElementById(modalId);
    if (!modalOverlay) return;
    modalOverlay.classList.add('visible');
    const modalContent = modalOverlay.querySelector('.modal-content');
    if (modalContent) {
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
        // Reset styles after transition for next open
        setTimeout(() => {
            modalOverlay.classList.remove('visible');
            modalContent.style.opacity = '';
            modalContent.style.transform = '';
        }, 300); // Match CSS transition duration
    } else {
        modalOverlay.classList.remove('visible');
    }
}

// --- Firebase Specific Utilities ---
function initializeFirebaseApp() { /* See above */ }
function fetchCurrentUser() { /* See above */ }
function logoutUser() { /* See above */ }
function isAdmin() { return isAdmin; } // Getter function

// Function to set/display language
function displayLanguage(lang) {
    activeLang = lang;
    const langTextElement = document.getElementById('lang-text'); // Assumes header has <span id="lang-text">EN</span>
    if (langTextElement) langTextElement.textContent = lang.toUpperCase();

    // Trigger UI text updates in other modules
    if (typeof updateUIText === 'function') {
        updateUIText(lang);
    }
    console.log(`Language set to: ${lang}`);
}

function setLanguage(lang) {
    displayLanguage(lang);
    localStorage.setItem('appLanguage', lang); // Save preference
}

// Navigation and View Management
function renderCurrentView() { /* See above */ }
function handlePostCarClick() { /* Forward to posting.js */
    if (typeof openPostCarModal === 'function') openPostCarModal();
}
function handleSearch() { /* Forward to feed.js */
    const searchTerm = (searchInput?.value || searchInputMobile?.value || '').trim().toLowerCase();
    if (typeof renderFeed === 'function') renderFeed(searchTerm);
}
function toggleUserMenu() { /* Toggles the visibility of the user menu */
    userMenu.classList.toggle('hidden');
}
function handleLogout() { /* Uses logoutUser */
    logoutUser();
}
function toggleLanguageOptions() { /* Function to show/hide language options menu */
    console.log("Toggle language options UI needed.");
    // Implement logic to show a language selection dropdown/modal
}
function handleAdminPanelClick() { /* Navigates to admin panel if admin */
    if (isAdmin) {
        window.location.hash = '#admin';
    } else {
        alert('You do not have administrator privileges.');
    }
}
function switchAuthView(showSignup) { /* Manages login/signup form switching */
    const loginFormContainer = document.getElementById('login-form');
    const signupFormContainer = document.getElementById('signup-form-container');
    if (showSignup) {
        signupFormContainer?.classList.remove('hidden');
        loginFormContainer?.classList.add('hidden');
    } else {
        signupFormContainer?.classList.add('hidden');
        loginFormContainer?.classList.remove('hidden');
    }
}
function handleLoginSubmit(event) { /* Forwards login submit to auth.js */
    event.preventDefault();
    const email = loginForm.elements['login-email'].value;
    const password = loginForm.elements['login-password'].value;
    if (typeof loginUser === 'function') loginUser(email, password);
}
function handleSignupSubmit(event) { /* Forwards signup submit to auth.js */
    event.preventDefault();
    const name = signupForm.elements['signup-name'].value;
    const email = signupForm.elements['signup-email'].value;
    const password = signupForm.elements['signup-password'].value;
    if (typeof signupUser === 'function') signupUser(name, email, password);
}
function handleViewProfileClick() { /* Navigates to user's profile */
    if (!currentUser) {
        alert('Please log in to view your profile.');
        showModal('auth-modal');
        return;
    }
    window.location.hash = `#profile/${currentUser.uid}`; // Use currentUser's UID
    userMenu.classList.add('hidden'); // Close menu
}

// ---- Subscribe to State Changes (Needs Firebase Adaptaion in Modules) ----
function subscribeToAppState() {
    console.log("Subscribing to Firebase real-time updates...");

    // Subscribe to posts feed updates using Firestore listener (implemented in feed.js)
    if (typeof subscribeToPostsFeed === 'function') {
        subscribeToPostsFeed();
    }

    // Subscribe to chat updates using Firestore listener (implemented in chat.js)
    if (currentUser && typeof subscribeToChat === 'function') {
        subscribeToChat();
    }

    // Admin specific listeners might also be needed (e.g., user status changes)
    // if (isAdmin() && typeof subscribeToAdminUpdates === 'function') {
    //     subscribeToAdminUpdates();
    // }
}


// ---- Main Initialization Entry Point ----
// Call initializeApp() once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});


// ---- Make Core Functions Globally Accessible ----
// Exporting or making globally accessible for modules to call
window.initializeApp = initializeApp;
window.fetchCurrentUser = fetchCurrentUser;
window.logoutUser = logoutUser;
window.renderCurrentView = renderCurrentView;
window.isAdmin = isAdmin; // Getter for admin status
window.showModal = showModal; // To show modals from other modules
window.hideModal = hideModal; // To hide modals from other modules
window.showLoader = showLoader;
window.hideLoader = hideLoader;
