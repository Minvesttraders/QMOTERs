// ---- Authentication Functions ----

async function loginUser(email, password) {
    showLoader();
    try {
        // Attempt to create a session with email and password
        await account.createEmailPasswordSession(email, password);

        // If successful, fetch the current user data
        await fetchCurrentUser(); // Refreshes currentUser, isAdmin, etc.
        hideModal('auth-modal'); // Close the auth modal
        renderCurrentView(); // Refresh the view in case state changed (e.g., enabling "Post Car")
        alert('Login successful!');
    } catch (error) {
        console.error("Login failed:", error);
        alert(`Login failed: ${error.message}. Please check your credentials.`);
        // Optionally show specific error messages from Appwrite
    } finally {
        hideLoader();
    }
}

async function signupUser(name, email, password) {
    showLoader();
    try {
        // 1. Create the user account in Appwrite Authentication
        const user = await account.create(email, password, name); // Appwrite uses 'name' for display name

        // 2. Automatically sign in the new user
        await account.createEmailPasswordSession(email, password);

        // 3. Create the user's profile document in our 'users' collection
        await databases.createDocument(DB_ID, USER_COLLECTION_ID, user.$id, {
            appwriteUserId: user.$id,
            displayName: name, // Use name for display name
            email: email,
            status: 'active', // Default status; admin panel can change this
            roles: ['user'], // Initial role
            createdAt: new Date().toISOString(),
            // Default profile fields
            avatarUrl: null,
            showroomName: name, // Assume showroom name is same as provided name initially
            contactInfo: null,
            rating: 0 // Default rating
        });

        // 4. Fetch the current user data to update the global state
        await fetchCurrentUser(); // This will set isAdmin flag, update UI elements etc.

        // 5. Check if this is the first user and grant admin role
        await checkAndGrantAdminRole();

        hideModal('auth-modal'); // Close the auth modal
        renderCurrentView(); // Update view based on logged-in state
        alert('Signup successful! Welcome aboard.');

    } catch (error) {
        console.error("Signup failed:", error);
        alert(`Signup failed: ${error.message}. Please try again or check if the email is already registered.`);
    } finally {
        hideLoader();
    }
}

// Checks if the user signing up is the very first user and grants admin role
async function checkAndGrantAdminRole() {
    try {
        const usersResponse = await databases.listDocuments(DB_ID, USER_COLLECTION_ID, [Appwrite.Query.limit(1)]); // Get total count efficiently
        if (usersResponse.total === 0) {
            console.log("This is the first user. Granting admin role.");
            await databases.updateDocument(DB_ID, USER_COLLECTION_ID, currentUser.appwriteId, {
                roles: ['admin', 'user'], // Add admin role
                status: 'active'
            });
            // Update global state immediately
            isAdmin = true;
            usernameDisplay.textContent = currentUser.name + ' (Admin)'; // Update display
             adminPanelLink.classList.remove('hidden'); // Show admin panel link
            // No need to re-fetch user, just update flags and UI.
        }
    } catch (error) {
        console.error("Error checking/granting admin role:", error);
    }
}


async function logoutUser() {
    showLoader();
    try {
        await account.deleteSession('current');
        // Reset global state variables
        currentUser = null;
        isAdmin = false;
        isModerator = false;

        // Update UI elements
        usernameDisplay.textContent = 'Guest';
        profileIcon.classList.add('hidden');
        postCarBtn.classList.add('hidden');
        adminPanelLink.classList.add('hidden');
        userMenu.classList.add('hidden'); // Close menu

        // Redirect or refresh to reflect logged-out state
        window.location.hash = '#feed'; // Go back to feed
        renderCurrentView(); // Re-render feed, now as a guest
        alert('You have been logged out.');

    } catch (error) {
        console.error("Logout failed:", error);
        alert("Logout failed. Please try again.");
    } finally {
        hideLoader();
    }
}

// ---- Auth Modal UI Management ----
function switchAuthView(showSignup) {
    const loginFormContainer = document.getElementById('login-form'); // Assuming login form is directly in modal
    const signupFormContainer = document.getElementById('signup-form-container'); // Assuming signup form is in a nested div

    if (showSignup) {
        signupFormContainer?.classList.remove('hidden');
        loginFormContainer?.classList.add('hidden');
    } else {
        signupFormContainer?.classList.add('hidden');
        loginFormContainer?.classList.remove('hidden');
    }
}

function toggleAuthModal() {
    if (authModal.classList.contains('visible')) { // Check if visible class is used
        hideModal('auth-modal');
    } else {
        // Reset views before showing
        const loginFormContainer = document.getElementById('login-form');
        const signupFormContainer = document.getElementById('signup-form-container');
        signupFormContainer?.classList.add('hidden');
        loginFormContainer?.classList.remove('hidden');
        // Clear forms maybe
        loginForm?.reset();
        signupForm?.reset();
        showModal('auth-modal');
    }
}

// ---- Exported Functions (if using modules) ----
// If you are using JS modules (import/export), uncomment and adjust these
/*
export {
    loginUser,
    signupUser,
    logoutUser,
    toggleAuthModal,
    switchAuthView,
    fetchCurrentUser, // Need to ensure this is callable globally or managed by app.js
    isAdmin // Export state flags if needed by other modules directly
};
*/
