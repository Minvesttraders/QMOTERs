// ---- Admin Panel Logic ----

// Cache admin elements and Firebase references
let paymentToggle, userTableBody, postTableBody;
let userListListener = null;
let postListListener = null;

// Collection names assumed globally or defined here
// const FIREBASE_USERS_COLLECTION = 'users';
// const FIREBASE_POSTS_COLLECTION = 'posts';

function initializeAdminModule() {
    // Cache admin-related DOM elements
    paymentToggle = document.getElementById('payment-toggle');
    userTableBody = document.getElementById('user-table-body');
    postTableBody = document.getElementById('post-table-body');

    // Attach event listeners
    paymentToggle?.addEventListener('change', handlePaymentToggleChange);

    // Attach modal close listeners (if not handled globally)
    const closeAdminModalBtn = document.getElementById('close-admin-modal');
    closeAdminModalBtn?.addEventListener('click', () => hideModal('admin-panel-modal'));
    const adminModalOverlay = document.getElementById('admin-panel-modal');
    adminModalOverlay?.addEventListener('click', (event) => {
        if (event.target === adminModalOverlay) { // Clicked on the backdrop
            hideModal('admin-panel-modal');
        }
    });

    // Initialize the Set Rating Modal
    initializeSetRatingModal();
}

// Render the admin panel interface
function renderAdminPanel() {
    if (!isAdmin) { // Check if current user is admin
        alert('You do not have administrator privileges.');
        window.location.hash = '#feed'; // Redirect back to feed
        return;
    }
    showModal('admin-panel-modal');
    loadAdminData(); // Fetch and display data once modal is shown
}

// Load initial data for admin panel (users, posts) and set up listeners
async function loadAdminData() {
    if (!firebaseDb) {
        console.error("Firebase DB not initialized for Admin Panel.");
        return;
    }
    showLoader();
    try {
        // Fetch payment settings (Assuming it's stored in Firestore)
        // Example: const settingsDoc = await firebaseDb.collection('settings').doc('payment').get();
        // if (settingsDoc.exists) paymentToggle.checked = settingsDoc.data().requirePayment;
        // For simplicity, payment toggle is just a UI element for now.

        fetchUsersForAdmin(); // Load users table
        fetchPostsForAdmin(); // Load posts table

        // Set up Firestore listeners for real-time updates in admin tables
        setupAdminListeners();

    } catch (error) {
        console.error("Error loading admin data:", error);
        alert("Failed to load admin data. Please try again.");
    } finally {
        hideLoader();
    }
}

// Fetch users for the admin table
async function fetchUsersForAdmin() {
    if (!userTableBody || !firebaseDb) return;
    userTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Loading users...</td></tr>';
    try {
        const usersSnapshot = await firebaseDb.collection(FIREBASE_USERS_COLLECTION)
            .orderBy('createdAt', 'asc') // Order by creation date
            .get();

        userTableBody.innerHTML = ''; // Clear loading state

        if (usersSnapshot.empty) {
            userTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No users found.</td></tr>';
            return;
        }

        usersSnapshot.forEach(userDoc => {
            const user = userDoc.data();
            const userId = userDoc.id;

            if (userId === currentUser.uid) return; // Skip current user

            const isUserAdmin = user.roles?.includes('admin');
            const isUserMod = user.roles?.includes('moderator');
            let avatarUrl = 'https://via.placeholder.com/40?text=U'; // Default avatar
            if (user.avatarUrl && firebaseStorage) {
                try {
                    avatarUrl = firebaseStorage.ref().child(`${'car_images'}/${user.avatarUrl}`).getDownloadURL();
                } catch (e) { console.warn("Could not get user avatar URL:", e); }
            }

            const row = document.createElement('tr');
            row.dataset.userId = userId;
            row.innerHTML = `
                <td class="px-4 py-2 flex items-center">
                    <img src="${avatarUrl}" alt="Avatar" class="w-8 h-8 rounded-full mr-2" onerror="this.onerror=null;this.src='https://via.placeholder.com/40?text=U';" >
                    ${user.displayName || user.showroomName || 'Unknown'}
                </td>
                <td class="px-4 py-2">${user.email}</td>
                <td class="px-4 py-2">${user.status || 'N/A'}</td>
                <td class="px-4 py-2">${user.roles ? user.roles.join(', ') : 'user'}</td>
                <td class="px-4 py-2 space-x-2">
                    ${isUserAdmin ? '<span class="text-yellow-400 font-bold">Admin</span>' : `
                        <button class="bg-green-500 hover:bg-green-600 text-white py-1 px-2 rounded text-xs activate-user-btn" data-user-id="${userId}" ${user.status === 'active' ? 'disabled' : ''}>Activate</button>
                        <button class="bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded text-xs reject-user-btn" data-user-id="${userId}" ${user.status === 'rejected' ? 'disabled' : ''}>Reject</button>
                        <button class="bg-purple-500 hover:bg-purple-600 text-white py-1 px-2 rounded text-xs promote-mod-btn" data-user-id="${userId}" ${isUserMod ? 'disabled' : ''}>Promote Mod</button>
                        <button class="bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded text-xs set-rating-btn" data-user-id="${userId}">Set Rating</button>
                    `}
                 </td>
            `;

            // Add event listeners for actions
            if (!isUserAdmin) { // Only attach if current user isn't admin and this row isn't for admin
                row.querySelector('.activate-user-btn').addEventListener('click', () => updateUserStatus(userId, 'active'));
                row.querySelector('.reject-user-btn').addEventListener('click', () => updateUserStatus(userId, 'rejected'));
                row.querySelector('.promote-mod-btn').addEventListener('click', () => promoteUser(userId, 'moderator'));
                row.querySelector('.set-rating-btn').addEventListener('click', () => showSetRatingModal(userId));
            }
            userTableBody.appendChild(row);
        });

    } catch (error) {
        console.error("Error fetching users for admin:", error);
        userTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Failed to load users.</td></tr>';
    }
}

// Fetch posts for admin review table
async function fetchPostsForAdmin() {
    if (!postTableBody || !firebaseDb) return;
    postTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Loading posts...</td></tr>';
    try {
        const postsSnapshot = await firebaseDb.collection(FIREBASE_POSTS_COLLECTION)
            .orderBy('createdAt', 'desc') // Order by creation time
            .get();

        postTableBody.innerHTML = ''; // Clear loading state

        if (postsSnapshot.empty) {
            postTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4">No posts found.</td></tr>';
            return;
        }

        // Cache seller names to avoid redundant fetches
        const sellerNameCache = {};
        async function getSellerName(sellerId) {
            if (sellerNameCache[sellerId]) return sellerNameCache[sellerId];
            if (!sellerId) return 'Unknown Seller';
            try {
                const userDoc = await firebaseDb.collection(FIREBASE_USERS_COLLECTION).doc(sellerId).get();
                const name = userDoc.data()?.displayName || userDoc.data()?.showroomName || 'Unknown Seller';
                sellerNameCache[sellerId] = name;
                return name;
            } catch (error) {
                console.warn(`Could not fetch seller name for ${sellerId}:`, error);
                sellerNameCache[sellerId] = 'Unknown Seller';
                return 'Unknown Seller';
            }
        }

        const rows = []; // Store rows to append later for efficiency
        for (const doc of postsSnapshot.docs) {
            const post = { id: doc.id, ...doc.data() };
            const sellerName = await getSellerName(post.sellerId);
            const row = document.createElement('tr');
            row.dataset.postId = post.id;
            row.innerHTML = `
                <td class="px-4 py-2">${post.name || 'Unnamed'} (${post.model || 'N/A'})</td>
                <td class="px-4 py-2">${sellerName}</td>
                <td class="px-4 py-2">${post.approvalStatus || 'pending'}</td>
                <td class="px-4 py-2 space-x-2">
                    <button class="bg-green-500 hover:bg-green-600 text-white py-1 px-2 rounded text-xs approve-post-btn" data-post-id="${post.id}" ${post.approvalStatus === 'approved' ? 'disabled' : ''}>Approve</button>
                    <button class="bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded text-xs reject-post-btn" data-post-id="${post.id}" ${post.approvalStatus === 'rejected' ? 'disabled' : ''}>Reject</button>
                    <button class="bg-gray-500 hover:bg-gray-600 text-white py-1 px-2 rounded text-xs view-post-btn" data-post-id="${post.id}">View</button>
                </td>
            `;
            // Add event listeners
            row.querySelector('.approve-post-btn').addEventListener('click', () => updatePostStatus(post.id, 'approved'));
            row.querySelector('.reject-post-btn').addEventListener('click', () => updatePostStatus(post.id, 'rejected'));
            row.querySelector('.view-post-btn').addEventListener('click', async () => {
                // Need to fetch seller info again if not bundled
                 let sellerInfo = null;
                if (post.sellerId) {
                    const sellerDoc = await firebaseDb.collection(FIREBASE_USERS_COLLECTION).doc(post.sellerId).get();
                    sellerInfo = sellerDoc.exists ? sellerDoc.data() : null;
                 }
                 showCarDetails(post, sellerInfo); // Reuse from feed.js
            });
            rows.push(row);
        }
        // Append all rows at once for better performance
        rows.forEach(row => postTableBody.appendChild(row));

    } catch (error) {
        console.error("Error fetching posts for admin:", error);
        postTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500">Failed to load posts.</td></tr>';
    }
}

// ---- Admin Actions ----

// Update user status (active, rejected, etc.)
async function updateUserStatus(userId, newStatus) {
    showLoader();
    try {
        await firebaseDb.collection(FIREBASE_USERS_COLLECTION).doc(userId).update({ status: newStatus });
        alert(`User status updated to ${newStatus}.`);
        // Real-time listener will refresh the table, or manually refresh
        fetchUsersForAdmin();
    } catch (error) {
        console.error(`Error updating user status to ${newStatus} for ${userId}:`, error);
        alert(`Failed to update status: ${error.message}`);
    } finally {
        hideLoader();
    }
}

// Update post status (approved, rejected, pending)
async function updatePostStatus(postId, newStatus) {
    showLoader();
    try {
        await firebaseDb.collection(FIREBASE_POSTS_COLLECTION).doc(postId).update({ approvalStatus: newStatus });
        alert(`Post status updated to ${newStatus}.`);
        // Real-time listener will refresh the table, or manually refresh
        fetchPostsForAdmin();
    } catch (error) {
        console.error(`Error updating post status to ${newStatus} for ${postId}:`, error);
        alert(`Failed to update status: ${error.message}`);
    } finally {
        hideLoader();
    }
}

// Promote user to moderator role
async function promoteUser(userId, role) {
    showLoader();
    try {
        const userDocRef = firebaseDb.collection(FIREBASE_USERS_COLLECTION).doc(userId);
        const userDoc = await userDocRef.get();
        let currentRoles = userDoc.data()?.roles || [];

        if (currentRoles.includes(role)) {
            alert(`User already has the '${role}' role.`);
            hideLoader(); return;
        }
        // Add the new role using FieldValue.arrayUnion
        await userDocRef.update({
            roles: firebase.firestore.FieldValue.arrayUnion(role)
        });
        alert(`User promoted to ${role}.`);
        fetchUsersForAdmin(); // Refresh the table
    } catch (error) {
        console.error(`Error promoting user ${userId} to ${role}:`, error);
        alert(`Failed to promote user: ${error.message}`);
    } finally {
        hideLoader();
    }
}

// ---- Set Rating Modal Logic ----
let ratingForm, modalUserIdInput, userRatingInput;

function initializeSetRatingModal() {
    // Cache elements for the set rating modal
    const setRatingModal = document.getElementById('set-rating-modal');
    if (!setRatingModal) return; // Exit if modal doesn't exist

    ratingForm = document.getElementById('set-rating-form');
    modalUserIdInput = document.getElementById('modal-user-id');
    userRatingInput = document.getElementById('user-rating-input');
    const closeRatingModalBtn = document.getElementById('close-rating-modal');

    // Add event listeners
    ratingForm?.addEventListener('submit', handleSetRatingSubmit);
    closeRatingModalBtn?.addEventListener('click', () => hideModal('set-rating-modal'));

    // Click outside handler
    const ratingModalOverlay = document.getElementById('set-rating-modal');
    ratingModalOverlay?.addEventListener('click', (event) => {
        if (event.target === ratingModalOverlay) {
            hideModal('set-rating-modal');
        }
    });
}

// Shows the modal to set rating for a specific user
async function showSetRatingModal(userId) {
    if (!firebaseDb || !userId) {
        console.error("Firebase DB or User ID missing for set rating.");
        return;
    }
    showModal('set-rating-modal');
    // Set the user ID in a hidden input field within the modal
    if (modalUserIdInput) modalUserIdInput.value = userId;

    // Fetch current rating and pre-fill the input
    try {
        const userDoc = await firebaseDb.collection(FIREBASE_USERS_COLLECTION).doc(userId).get();
        if (userRatingInput) {
            userRatingInput.value = userDoc.data()?.rating !== undefined ? userDoc.data().rating : '';
        }
    } catch (error) {
        console.warn(`Could not fetch current rating for user ${userId}:`, error);
        if (userRatingInput) userRatingInput.value = ''; // Clear if fetch fails
    }
}

// Handles the submission of the set rating form
async function handleSetRatingSubmit(event) {
    event.preventDefault();
    if (!ratingForm || !modalUserIdInput || !userRatingInput || !firebaseDb) return;

    const userId = modalUserIdInput.value;
    const ratingValue = parseFloat(userRatingInput.value);

    // Validate rating input
    if (!userId || isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
        alert('Please enter a valid rating between 1 and 5.');
        return;
    }

    showLoader();
    try {
        // Update user's rating in Firestore
        await firebaseDb.collection(FIREBASE_USERS_COLLECTION).doc(userId).update({ rating: ratingValue });
        alert('Rating updated successfully.');
        hideModal('set-rating-modal'); // Close the modal
        fetchUsersForAdmin(); // Refresh the user table to show updated rating (or potentially just update the specific row)
    } catch (error) {
        console.error(`Error setting rating for user ${userId}:`, error);
        alert(`Failed to set rating: ${error.message}`);
    } finally {
        hideLoader();
    }
}

// Handles the payment toggle change (simulated action)
function handlePaymentToggleChange() {
    const isPaymentEnabled = paymentToggle.checked;
    console.log('Payment requirement changed to:', isPaymentEnabled);
    alert('Payment setting updated (simulation).');
    // TODO: Implement actual Firebase Firestore update for payment settings if stored there.
    // Example:
    // try {
    //     await firebaseDb.collection('settings').doc('payment').update({ requirePayment: isPaymentEnabled });
    //     alert('Payment setting updated successfully.');
    // } catch (error) { ... }
}

// ---- Real-time Listeners for Admin Panel ----
function setupAdminListeners() {
    // Setup listener for user changes (status, roles, etc.)
    if (userListListener) userListListener(); // Unsubscribe previous if exists
    userListListener = firebaseDb.collection(FIREBASE_USERS_COLLECTION).onSnapshot((snapshot) => {
        console.log("User snapshot received. Refreshing user table.");
        fetchUsersForAdmin(); // Refresh user table on changes
    }, (error) => {
        console.error("Error listening to users collection:", error);
        // Handle error, maybe show a message in the table area
    });

    // Setup listener for post changes (approval status, etc.)
    if (postListListener) postListListener(); // Unsubscribe previous if exists
    postListListener = firebaseDb.collection(FIREBASE_POSTS_COLLECTION).onSnapshot((snapshot) => {
        console.log("Post snapshot received. Refreshing post table.");
        fetchPostsForAdmin(); // Refresh post table on changes
    }, (error) => {
        console.error("Error listening to posts collection:", error);
        // Handle error
    });
}

// Cleanup listeners when modal is closed (important to prevent memory leaks)
function cleanupAdminListeners() {
    if (userListListener) {
        userListListener(); // Unsubscribe
        userListListener = null;
    }
    if (postListListener) {
        postListListener(); // Unsubscribe
        postListListener = null;
    }
}

// ---- Module Initialization ----
document.addEventListener('DOMContentLoaded', () => {
     initializeAdminModule();
     // Listeners are set up when loadAdminData is called after modal is shown.
});

// ---- Export/Make Functions Accessible ----
window.renderAdminPanel = renderAdminPanel;
window.initializeSetRatingModal = initializeSetRatingModal;
window.cleanupAdminListeners = cleanupAdminListeners; // Crucial for closing modals
