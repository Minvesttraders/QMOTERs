// ---- Authentication Logic ----

// Cache Authentication related DOM elements
let loginForm, signupForm, authModal, signupFormContainer;

function initializeAuthModule() {
    // Ensure elements are cached correctly
    loginForm = document.getElementById('login-form');
    signupForm = document.getElementById('signup-form');
    authModal = document.getElementById('auth-modal');
    signupFormContainer = document.getElementById('signup-form-container');

    // Event listeners are generally attached in app.js for robustness,
    // but this function ensures the module is ready if called explicitly.
    // Specific button listeners (show signup/login, form submits) are in app.js.
}

// Handles the login submission
async function loginUser(email, password) {
    if (!firebaseAuth) {
        console.error("Firebase Auth not initialized.");
        return;
    }
    showLoader(); // Assuming showLoader is globally available from app.js
    try {
        // Use Firebase Authentication signInWithEmailAndPassword
        await firebaseAuth.signInWithEmailAndPassword(email, password);
        // The `onAuthStateChanged` listener in app.js will handle user state update and UI changes.

        hideModal('auth-modal'); // Close the authentication modal
        alert('Login successful!');

    } catch (error) {
        console.error("Firebase Login failed:", error);
        // Display user-friendly error message
        alert(`Login failed: ${error.message}. Please check your credentials.`);
    } finally {
        hideLoader();
    }
}

// Handles the signup process
async function signupUser(name, email, password) {
    if (!firebaseAuth || !firebaseDb) {
        console.error("Firebase services not initialized.");
        return;
    }
    showLoader();
    try {
        // 1. Create user in Firebase Authentication
        const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user; // Get the user object

        // 2. Update user profile with display name
        await user.updateProfile({
            displayName: name
        });

        // 3. Create user document in Firestore 'users' collection
        // Use Firestore's FieldValue.serverTimestamp() for accurate timestamp
        await firebaseDb.collection(FIREBASE_USERS_COLLECTION).doc(user.uid).set({
            displayName: name,
            email: email,
            status: 'active', // Default status
            roles: ['user'],  // Default role
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            // Initialize other profile fields
            avatarUrl: null,
            showroomName: name, // Use name as initial showroom name
            contactInfo: null,
            rating: 0
        });

        // 4. User is already logged in after createUserWithEmailAndPassword.
        // The `onAuthStateChanged` listener in app.js will update `currentUser` and UI.

        // 5. Check if this is the very first user and grant admin role
        await checkAndGrantAdminRole(user.uid);

        // Close modal and show success message
        hideModal('auth-modal');
        alert('Signup successful! Welcome aboard.');

    } catch (error) {
        console.error("Firebase Signup failed:", error);
        alert(`Signup failed: ${error.message}. Please try again.`);
    } finally {
        hideLoader();
    }
}

// Helper to grant admin role to the first user
async function checkAndGrantAdminRole(userId) {
    if (!firebaseDb) return;
    try {
        // Check if the 'users' collection is empty by trying to get the first document
        const usersSnapshot = await firebaseDb.collection(FIREBASE_USERS_COLLECTION).limit(1).get();

        if (usersSnapshot.empty) {
            console.log("This is the first user. Granting admin role.");
            // Update the user's document to include the 'admin' role
            await firebaseDb.collection(FIREBASE_USERS_COLLECTION).doc(userId).update({
                roles: firebase.firestore.FieldValue.arrayUnion('admin'), // Add admin role
                status: 'active'
            });
            // Note: `isAdmin` flag is updated in fetchCurrentUser via onAuthStateChanged listener
        }
    } catch (error) {
        console.error("Error checking/granting admin role:", error);
    }
}

// Handles switching between Login and Signup forms within the modal
function switchAuthView(showSignup) {
    // Ensure signupFormContainer element is correctly referenced
    if (!signupFormContainer) signupFormContainer = document.getElementById('signup-form-container');

    if (showSignup) {
        signupFormContainer?.classList.remove('hidden');
        loginForm?.classList.add('hidden');
    } else {
        signupFormContainer?.classList.add('hidden');
        loginForm?.classList.remove('hidden');
    }
}

// ---- Module Initialization ----
// Ensure this module is initialized if needed independently, otherwise handled by app.js
document.addEventListener('DOMContentLoaded', () => {
     initializeAuthModule();
});

// Export functions if using modules (otherwise they are available via app.js mapping or global scope)
// window.loginUser = loginUser; // Example if not using app.js mapping
// window.signupUser = signupUser;
// window.switchAuthView = switchAuthView;
