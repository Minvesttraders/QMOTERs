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
    // Return a Promise because onAuthStateChanged is asynchronous
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
                        // Potentially auto-create a default user profile here or show an error
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

                // Optionally show the authentication modal if on the feed page
                // if (!authModal && (window.location.hash === '' || window.location.hash === '#feed')) {
                //     showModal('auth-modal');
                // }

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


// ---- Main Application Logic ----
function initializeApp() {
    console.log("Initializing application...");

    // 1. Initialize Firebase FIRST
    const firebaseInitialized = initializeFirebaseApp();
    if (!firebaseInitialized) {
        // If Firebase failed to initialize, display an error and stop
        appContentContainer.innerHTML = '<p class="text-center text-red-500 col-span-full">Application initialization failed. Cannot connect to backend.</p>';
        return;
    }

    // 2. Cache DOM Elements
    cacheDOMElements(); // Cache elements like header, modals, buttons etc.

    // 3. Restore Language Preference
    const savedLang = localStorage.getItem('appLanguage') || 'en';
    setLanguage(savedLang);

    // 4. Check Current User Session using Firebase Auth
    fetchCurrentUser().then((user) => {
        // This promise resolves once auth state is known and user data (if logged in) is fetched

        // 5. Render Initial View (Feed, Login Prompt etc.)
        renderCurrentView(); // Load content based on auth state and URL hash

        // 6. Subscribe to Real-time Updates (Posts, Chats etc.)
        // This needs adaptation in feed.js, chat.js etc. to use Firebase listeners
        subscribeToAppState();

    }).catch(error => {
        console.error("Error during initial app load:", error);
        // Render feed as guest if login/initialization fails unexpectedly
        renderFeed(); // Display public feed
        // Optionally show login modal here if user is not logged in and init failed
    }).finally(() => {
        // Always hide the loader once initialization attempts are complete
        hideLoader();
    });
}

// ---- Adapt Navigation and State Subscriptions ----

// Navigates to the correct view based on URL hash (#feed, #profile/userId, #admin etc.)
function renderCurrentView() {
    const hash = window.location.hash || '#feed'; // Default to feed
    // Remove '#' prefix and split if there are parameters (e.g., #profile/userId)
    const route = hash.substring(1).split('/')[0];
    const routeParams = hash.substring(1).split('/')[1]; // e.g., userId

    // Show loader while changing view content
    if (appContentContainer) appContentContainer.innerHTML = '<p class="text-center text-neutral-grey col-span-full">Loading content...</p>';

    switch (route) {
        case 'feed':
            if (typeof initializeFeedView === 'function') initializeFeedView();
            break;
        case 'profile':
            const userId = routeParams || (currentUser ? currentUser.uid : null); // Use route param or current user's ID
            if (userId) {
                if (typeof renderUserProfile === 'function') renderUserProfile(userId);
            } else {
                alert('Please log in or specify a user profile.');
                window.location.hash = '#feed'; // Redirect back
            }
            break;
        case 'chat':
            if (typeof renderChat === 'function') renderChat();
            break;
        case 'admin':
            if (isAdmin) {
                if (typeof renderAdminPanel === 'function') renderAdminPanel();
            } else {
                alert('You do not have administrator privileges.');
                window.location.hash = '#feed'; // Redirect back
            }
            break;
        default:
            // Default case: show feed
            if (typeof initializeFeedView === 'function') initializeFeedView();
    }
}

// Listen for hash changes to handle routing without page reload
window.addEventListener('hashchange', renderCurrentView);

// Subscribe to Firebase real-time listeners (needs implementation in specific modules)
function subscribeToAppState() {
    console.log("Subscribing to Firebase real-time updates...");

    // Subscribe to posts for real-time feed updates (using Firestore listeners)
    // The actual listener setup will be in feed.js
    if (typeof subscribeToPostsFeed === 'function') {
        subscribeToPostsFeed();
    }

    // Subscribe to chat updates (using Firestore listeners)
    // The actual listener setup will be in chat.js
    if (currentUser && typeof subscribeToChat === 'function') {
        subscribeToChat();
    }

    // Subscribe to user status/role changes if necessary for admin panel or other features
    // The actual listener setup will be in admin.js or user management modules
    // Example: subscribeToUserUpdates(); // Function to be defined elsewhere
}


// ---- Make core functions globally accessible if needed, or use exports ----
// export { initializeApp, fetchCurrentUser, logoutUser, renderCurrentView }; // For module usage
// Making globally accessible for simplicity with CDN setup
window.initializeApp = initializeApp;
window.fetchCurrentUser = fetchCurrentUser;
window.logoutUser = logoutUser;
window.renderCurrentView = renderCurrentView;
window.isAdmin = () => isAdmin; // Getter for admin status


// ---- Ensure initialization happens after DOM is ready ----
// Call initializeApp() once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});
