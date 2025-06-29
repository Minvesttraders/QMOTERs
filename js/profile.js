// ---- User Profile Logic ----

// Cache profile elements (assuming these exist in the HTML, maybe inside a modal)
let profileModal, profileAvatar, profileShowroomName, profileContact, profileRating, profilePostsGrid;
let currentUserProfileSubscription = null;

function initializeProfileModule() {
    profileModal = document.getElementById('profile-modal');
    profileAvatar = document.getElementById('profile-avatar');
    profileShowroomName = document.getElementById('profile-showroom-name');
    profileContact = document.getElementById('profile-contact');
    profileRating = document.getElementById('profile-rating');
    profilePostsGrid = document.getElementById('profile-posts-grid');

    const closeProfileModalBtn = document.getElementById('close-profile-modal');
    closeProfileModalBtn?.addEventListener('click', () => hideModal('profile-modal'));

     // Add generic listener for clicking outside the modal content
     const profileModalOverlay = document.getElementById('profile-modal');
     profileModalOverlay?.addEventListener('click', (event) => {
         if (event.target === profileModalOverlay) {
             hideModal('profile-modal');
         }
     });
}

// Function to display a user's profile
async function renderUserProfile(userId) {
    if (!profileModal || !userId) return;

    showLoader();
    // Clear previous content
    profilePostsGrid.innerHTML = '<p class="text-center text-neutral-grey col-span-full">Loading posts...</p>';
    if(profileAvatar) profileAvatar.src = 'https://via.placeholder.com/150?text=Loading...';
    if(profileShowroomName) profileShowroomName.textContent = 'Loading...';
    if(profileContact) profileContact.textContent = 'Loading...';
    if(profileRating) profileRating.textContent = '...';

    try {
        // Fetch user document
        const userDoc = await databases.getDocument(DB_ID, USER_COLLECTION_ID, userId);

        // Display user info
        if (profileShowroomName) profileShowroomName.textContent = userDoc.showroomName || userDoc.displayName || 'Unknown Dealer';
        if (profileContact) profileContact.textContent = userDoc.contactInfo || 'No contact information available.';
        if (profileRating) profileRating.textContent = userDoc.rating !== undefined ? userDoc.rating : 'N/A';
        if (profileAvatar) {
            const avatarUrl = userDoc.avatarUrl ? storage.getFilePreview(appwriteConfig.storageBucketId, userDoc.avatarUrl).href : 'https://via.placeholder.com/150?text=Profile';
            profileAvatar.src = avatarUrl;
            profileAvatar.alt = userDoc.showroomName || 'User Avatar';
        }

        // Fetch and display user's posts
        const userPostsResponse = await databases.listDocuments(DB_ID, POST_COLLECTION_ID, [
            Appwrite.Query.equal('sellerId', userId),
            Appwrite.Query.equal('approvalStatus', 'approved'), // Only show approved posts
            Appwrite.Query.orderDesc('createdAt') // Latest first
        ]);

        profilePostsGrid.innerHTML = ''; // Clear loading message
        if (userPostsResponse.total > 0) {
            userPostsResponse.documents.forEach(post => {
                const miniCard = renderMiniCarCard(post); // Helper to render smaller cards
                profilePostsGrid.appendChild(miniCard);
            });
        } else {
            profilePostsGrid.innerHTML = '<p class="text-center text-neutral-grey col-span-full">This dealer has no listings.</p>';
        }

        // Show the profile modal
        showModal('profile-modal');

        // Optional: Subscribe to updates for this user's profile if needed (e.g., rating changes)
        // subscribeToUserProfile(userId);

    } catch (error) {
        console.error(`Error fetching profile for user ${userId}:`, error);
        alert('Could not load profile details.');
        if(profileModal) hideModal('profile-modal'); // Hide if error
    } finally {
        hideLoader();
    }
}

// Helper function to render smaller cards for the profile view
function renderMiniCarCard(post) {
    const imageUrl = post.images && post.images.length > 0
        ? storage.getFilePreview(appwriteConfig.storageBucketId, post.images[0], 150, 150).href // Smaller image
        : 'https://via.placeholder.com/150x100.png?text=No+Image';

    const card = document.createElement('div');
    card.className = 'bg-gray-700 rounded-md shadow-sm overflow-hidden cursor-pointer transition duration-300 hover:shadow-md';
    card.dataset.postId = post.$id;
    card.innerHTML = `
        <img src="${imageUrl}" alt="${post.name || 'Car'}" class="w-full h-24 object-cover">
        <div class="p-2">
            <h4 class="text-sm font-semibold text-electric-teal truncate">${post.name || 'Unnamed Car'}</h4>
            <p class="text-xs text-neutral-grey">${post.model || 'N/A'}</p>
        </div>
    `;
    card.addEventListener('click', () => showCarDetails(post)); // Reuse showCarDetails from feed.js
    return card;
}


// ---- Initialize Profile Module ----
// Call this once on app load to set up event listeners for the modal
document.addEventListener('DOMContentLoaded', () => {
     initializeProfileModule();
});

// ---- Exported Functions ----
// export { renderUserProfile };
window.renderUserProfile = renderUserProfile; // Make globally available
