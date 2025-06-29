// ---- User Profile Logic ----

// Cache profile elements and Firebase references
let profileModal, profileAvatar, profileShowroomName, profileContact, profileRating, profilePostsGrid;

function initializeProfileModule() {
    // Cache DOM elements related to profile modal
    profileModal = document.getElementById('profile-modal');
    profileAvatar = document.getElementById('profile-avatar');
    profileShowroomName = document.getElementById('profile-showroom-name');
    profileContact = document.getElementById('profile-contact');
    profileRating = document.getElementById('profile-rating');
    profilePostsGrid = document.getElementById('profile-posts-grid');

    // Add close handler for the modal
    const closeProfileModalBtn = document.getElementById('close-profile-modal');
    closeProfileModalBtn?.addEventListener('click', () => hideModal('profile-modal'));

    // Add click outside handler for the modal backdrop
    const profileModalOverlay = document.getElementById('profile-modal');
    profileModalOverlay?.addEventListener('click', (event) => {
        if (event.target === profileModalOverlay) { // Clicked on the backdrop
            hideModal('profile-modal');
        }
    });
}

// Function to display a user's profile by fetching data from Firestore
async function renderUserProfile(userId) {
    if (!profileModal || !userId || !firebaseDb) {
        console.error("Profile modal, userId, or Firebase DB not ready!");
        return;
    }

    showLoader(); // Show loading indicator
    // Clear previous content
    if(profileAvatar) profileAvatar.src = 'https://via.placeholder.com/150?text=Loading...'; // Placeholder during load
    if(profileShowroomName) profileShowroomName.textContent = 'Loading...';
    if(profileContact) profileContact.textContent = 'Loading...';
    if(profileRating) profileRating.textContent = '...';
    if(profilePostsGrid) profilePostsGrid.innerHTML = '<p class="text-center text-neutral-grey col-span-full">Loading posts...</p>';

    try {
        // Fetch user document from Firestore
        const userDocRef = firebaseDb.collection(FIREBASE_USERS_COLLECTION).doc(userId);
        const userDoc = await userDocRef.get();

        if (!userDoc.exists) {
            throw new Error("User profile not found.");
        }
        const userData = userDoc.data();

        // Display user information
        if (profileShowroomName) profileShowroomName.textContent = userData.showroomName || userData.displayName || 'Unknown Dealer';
        if (profileContact) profileContact.textContent = userData.contactInfo || 'No contact information available.';
        if (profileRating) profileRating.textContent = userData.rating !== undefined ? userData.rating : 'N/A';
        if (profileAvatar) {
            let avatarUrl = 'https://via.placeholder.com/150?text=Profile'; // Default
            if (userData.avatarUrl && firebaseStorage) {
                try {
                    avatarUrl = await firebaseStorage.ref().child(`${'car_images'}/${userData.avatarUrl}`).getDownloadURL();
                } catch (e) { console.warn("Could not get avatar URL:", e); }
            }
            profileAvatar.src = avatarUrl;
            profileAvatar.alt = userData.showroomName || 'User Avatar';
        }

        // Fetch user's posts from Firestore
        const userPostsSnapshot = await firebaseDb.collection(FIREBASE_POSTS_COLLECTION)
            .where('sellerId', '==', userId)
            .where('approvalStatus', '==', 'approved') // Only show approved posts
            .orderBy('createdAt', 'desc')
            .get();

        profilePostsGrid.innerHTML = ''; // Clear loading message
        if (userPostsSnapshot.empty) {
            profilePostsGrid.innerHTML = '<p class="text-center text-neutral-grey col-span-full">This dealer has no listings.</p>';
        } else {
            userPostsSnapshot.forEach(doc => {
                const postData = { id: doc.id, ...doc.data() };
                const miniCard = renderMiniCarCard(postData); // Helper to render smaller cards
                profilePostsGrid.appendChild(miniCard);
            });
        }

        // Show the profile modal
        showModal('profile-modal');

    } catch (error) {
        console.error(`Error fetching profile for user ${userId}:`, error);
        alert('Could not load profile details.');
        if(profileModal) hideModal('profile-modal');
    } finally {
        hideLoader();
    }
}

// Helper function to render smaller car cards for the profile view
function renderMiniCarCard(post) {
    let imageUrl = 'https://via.placeholder.com/150x100.png?text=No+Image';
    if (post.images && post.images.length > 0 && firebaseStorage) {
        try {
            imageUrl = firebaseStorage.ref().child(`${'car_images'}/${post.images[0]}`).getDownloadURL();
        } catch (e) { console.warn("Could not get mini image URL:", e); }
    }

    const card = document.createElement('div');
    card.className = 'bg-gray-700 rounded-md shadow-sm overflow-hidden cursor-pointer transition duration-300 hover:shadow-md';
    card.dataset.postId = post.id;
    card.innerHTML = `
        <img src="${imageUrl}" alt="${post.name || 'Car'}" class="w-full h-24 object-cover" onerror="this.onerror=null;this.src='https://via.placeholder.com/150x100.png?text=No+Image';" >
        <div class="p-2">
            <h4 class="text-sm font-semibold text-electric-teal truncate">${post.name || 'Unnamed Car'}</h4>
            <p class="text-xs text-neutral-grey">${post.model || 'N/A'}</p>
        </div>
    `;
    // Re-use showCarDetails function for clicking on these cards
    card.addEventListener('click', () => {
        // We need the full post data and seller info here for showCarDetails
        // For simplicity, we re-fetch or assume post object passed is sufficient
        // A better way would be to fetch seller info here as well if not already bundled
        showCarDetails(post); // Assuming showCarDetails is available and fetches seller internally if needed
    });
    return card;
}


// ---- Module Initialization ----
document.addEventListener('DOMContentLoaded', () => {
     initializeProfileModule();
});

// ---- Export/Make Functions Accessible ----
window.renderUserProfile = renderUserProfile; // Make globally available for app.js routing
