// ---- Admin Panel Logic ----

let userSubscription = null; // For admin user updates
let postSubscriptionForAdmin = null; // For admin post updates

// Cache admin elements
let paymentToggle, userTableBody, postTableBody;

function initializeAdminModule() {
    paymentToggle = document.getElementById('payment-toggle');
    userTableBody = document.getElementById('user-table-body');
    postTableBody = document.getElementById('post-table-body');

    // Attach listeners
    paymentToggle?.addEventListener('change', handlePaymentToggleChange);

     // Add modal handlers
    const closeAdminModalBtn = document.getElementById('close-admin-modal');
    closeAdminModalBtn?.addEventListener('click', () => hideModal('admin-panel-modal'));
     const adminModalOverlay = document.getElementById('admin-panel-modal');
     adminModalOverlay?.addEventListener('click', (event) => {
         if (event.target === adminModalOverlay) {
             hideModal('admin-panel-modal');
         }
     });

     // Set rating modal setup (assuming modal exists and is initialized here)
    initializeSetRatingModal();
}

function renderAdminPanel() {
    if (!isAdmin) {
        alert('You are not an administrator.');
        window.location.hash = '#feed'; // Redirect back
        return;
    }
    showModal('admin-panel-modal');
    loadAdminData();
}

// Load initial data for admin panel
async function loadAdminData() {
    showLoader();
    try {
        // Fetch payment setting (example: stored in a config document or env variable)
        // For simplicity, let's assume it's not dynamically fetched here, but set initially.
        // If it were in Appwrite:
        // const settings = await databases.getDocument(DB_ID, SETTINGS_COLLECTION_ID, 'payment_settings');
        // paymentToggle.checked = settings.requirePayment;

        fetchUsersForAdmin();
        fetchPostsForAdmin();

        // Setup realtime subscriptions for admin panel
         subscribeToUserUpdates();
         subscribeToPostUpdatesForAdmin();

    } catch (error) {
        console.error("Error loading admin data:", error);
        alert("Failed to load admin data. Please try again.");
    } finally {
        hideLoader();
    }
}

// Fetch users for the admin table
async function fetchUsersForAdmin() {
    if (!userTableBody) return;
    userTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Loading users...</td></tr>';
    try {
        const usersResponse = await databases.listDocuments(DB_ID, USER_COLLECTION_ID, [Appwrite.Query.orderAsc('createdAt')]);
        userTableBody.innerHTML = ''; // Clear loading state

        if (usersResponse.total === 0) {
            userTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No users found.</td></tr>';
            return;
        }

        usersResponse.documents.forEach(user => {
            if (user.$id === currentUser.appwriteId) return; // Don't show actions for self

            const isUserAdmin = user.roles?.includes('admin');
            const isUserMod = user.roles?.includes('moderator');
            const avatarUrl = user.avatarUrl ? storage.getFilePreview(appwriteConfig.storageBucketId, user.avatarUrl, 40, 40).href : 'https://via.placeholder.com/40?text=U';

            const row = document.createElement('tr');
            row.dataset.userId = user.$id;
            row.innerHTML = `
                <td class="px-4 py-2 flex items-center">
                    <img src="${avatarUrl}" alt="Avatar" class="w-8 h-8 rounded-full mr-2">
                    ${user.displayName || user.showroomName || 'Unknown'}
                </td>
                <td class="px-4 py-2">${user.email}</td>
                <td class="px-4 py-2">${user.status || 'N/A'}</td>
                <td class="px-4 py-2">${user.roles ? user.roles.join(', ') : 'user'}</td>
                <td class="px-4 py-2 space-x-2">
                    ${isUserAdmin ? '<span class="text-yellow-400 font-bold">Admin</span>' : `
                        <button class="bg-green-500 hover:bg-green-600 text-white py-1 px-2 rounded text-xs activate-user-btn" data-user-id="${user.$id}" ${user.status === 'active' ? 'disabled' : ''}>Activate</button>
                        <button class="bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded text-xs reject-user-btn" data-user-id="${user.$id}">Reject</button>
                        <button class="bg-purple-500 hover:bg-purple-600 text-white py-1 px-2 rounded text-xs promote-mod-btn" data-user-id="${user.$id}" ${isUserMod ? 'disabled' : ''}>Promote Mod</button>
                        <button class="bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded text-xs set-rating-btn" data-user-id="${user.$id}">Set Rating</button>
                    `}
                 </td>
            `;

            // Add event listeners for actions (only if not admin)
            if (!isUserAdmin) {
                row.querySelector('.activate-user-btn').addEventListener('click', () => updateUserStatus(user.$id, 'active'));
                row.querySelector('.reject-user-btn').addEventListener('click', () => updateUserStatus(user.$id, 'rejected'));
                row.querySelector('.promote-mod-btn').addEventListener('click', () => promoteUser(user.$id, 'moderator'));
                row.querySelector('.set-rating-btn').addEventListener('click', () => showSetRatingModal(user.$id));
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
    if (!postTableBody) return;
    postTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Loading posts...</td></tr>';
    try {
        const postsResponse = await databases.listDocuments(DB_ID, POST_COLLECTION_ID, [Appwrite.Query.orderAsc('createdAt')]);
        postTableBody.innerHTML = ''; // Clear loading state

        if (postsResponse.total === 0) {
            postTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4">No posts found.</td></tr>';
            return;
        }

        // Use a cache for seller names to avoid repeated fetches
        const sellerNameCache = {};
        async function getSellerName(sellerId) {
            if (sellerNameCache[sellerId]) return sellerNameCache[sellerId];
            try {
                const userDoc = await databases.getDocument(DB_ID, USER_COLLECTION_ID, sellerId);
                const name = userDoc.displayName || userDoc.showroomName || 'Unknown Seller';
                sellerNameCache[sellerId] = name;
                return name;
            } catch (error) {
                console.warn(`Could not fetch seller name for ${sellerId}:`, error);
                sellerNameCache[sellerId] = 'Unknown Seller';
                return 'Unknown Seller';
            }
        }

        for (const post of postsResponse.documents) {
            const sellerName = await getSellerName(post.sellerId);
            const row = document.createElement('tr');
            row.dataset.postId = post.$id;
            row.innerHTML = `
                <td class="px-4 py-2">${post.name || 'Unnamed'} (${post.model || 'N/A'})</td>
                <td class="px-4 py-2">${sellerName}</td>
                <td class="px-4 py-2">${post.approvalStatus || 'pending'}</td>
                <td class="px-4 py-2 space-x-2">
                    <button class="bg-green-500 hover:bg-green-600 text-white py-1 px-2 rounded text-xs approve-post-btn" data-post-id="${post.$id}" ${post.approvalStatus === 'approved' ? 'disabled' : ''}>Approve</button>
                    <button class="bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded text-xs reject-post-btn" data-post-id="${post.$id}" ${post.approvalStatus === 'rejected' ? 'disabled' : ''}>Reject</button>
                    <button class="bg-gray-500 hover:bg-gray-600 text-white py-1 px-2 rounded text-xs view-post-btn" data-post-id="${post.$id}">View</button>
                </td>
            `;
            row.querySelector('.approve-post-btn').addEventListener('click', () => updatePostStatus(post.$id, 'approved'));
            row.querySelector('.reject-post-btn').addEventListener('click', () => updatePostStatus(post.$id, 'rejected'));
            row.querySelector('.view-post-btn').addEventListener('click', () => {
                // Fetch post details including seller again for showCarDetails, or pass it here if available
                // For now, re-fetch the post doc if needed by showCarDetails
                databases.getDocument(DB_ID, POST_COLLECTION_ID, post.$id).then(fullPost => {
                    fetchSellerInfo(post.$id).then(seller => showCarDetails(fullPost, seller));
                });
            });
            postTableBody.appendChild(row);
        }
    } catch (error) {
        console.error("Error fetching posts for admin:", error);
        postTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500">Failed to load posts.</td></tr>';
    }
}


// ---- Admin Actions ----

async function updateUserStatus(userId, newStatus) {
    showLoader();
    try {
        await databases.updateDocument(DB_ID, USER_COLLECTION_ID, userId, { status: newStatus });
        alert(`User status updated to ${newStatus}.`);
        fetchUsersForAdmin(); // Refresh table
    } catch (error) {
        console.error(`Error updating user status to ${newStatus} for ${userId}:`, error);
        alert(`Failed to update status: ${error.message}`);
    } finally {
        hideLoader();
    }
}

async function updatePostStatus(postId, newStatus) {
    showLoader();
    try {
        await databases.updateDocument(DB_ID, POST_COLLECTION_ID, postId, { approvalStatus: newStatus });
        alert(`Post status updated to ${newStatus}.`);
        fetchPostsForAdmin(); // Refresh table
        // Potentially trigger a realtime update if subscribed
    } catch (error) {
        console.error(`Error updating post status to ${newStatus} for ${postId}:`, error);
        alert(`Failed to update status: ${error.message}`);
    } finally {
        hideLoader();
    }
}

async function promoteUser(userId, role) {
    showLoader();
    try {
        const userDoc = await databases.getDocument(DB_ID, USER_COLLECTION_ID, userId);
        let currentRoles = userDoc.roles || [];
        if (currentRoles.includes(role)) {
            alert('User already has this role.');
            hideLoader(); return;
        }
        const updatedRoles = [...currentRoles, role];
        await databases.updateDocument(DB_ID, USER_COLLECTION_ID, userId, { roles: updatedRoles });
        alert(`User promoted to ${role}.`);
        fetchUsersForAdmin(); // Refresh table
    } catch (error) {
        console.error(`Error promoting user ${userId} to ${role}:`, error);
        alert(`Failed to promote user: ${error.message}`);
    } finally {
        hideLoader();
    }
}

function initializeSetRatingModal() {
     // Cache elements for the set rating modal
    const setRatingModal = document.getElementById('set-rating-modal'); // Assuming modal exists
    if (!setRatingModal) return;

    const ratingForm = document.getElementById('set-rating-form');
    const modalUserIdInput = document.getElementById('modal-user-id'); // Hidden input to store user ID
    const userRatingInput = document.getElementById('user-rating-input');
    const closeRatingModalBtn = document.getElementById('close-rating-modal');

    // Add handlers
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

async function showSetRatingModal(userId) {
    const setRatingModal = document.getElementById('set-rating-modal');
    if (!setRatingModal) return;

    // Set the user ID for the form
    const modalUserIdInput = document.getElementById('modal-user-id');
    if (modalUserIdInput) modalUserIdInput.value = userId;

    // Optional: Fetch current rating and pre-fill input
    try {
        const userDoc = await databases.getDocument(DB_ID, USER_COLLECTION_ID, userId);
        const userRatingInput = document.getElementById('user-rating-input');
        if (userRatingInput) {
            userRatingInput.value = userDoc.rating !== undefined ? userDoc.rating : '';
        }
    } catch (error) {
        console.warn(`Could not fetch current rating for user ${userId}:`, error);
    }

    showModal('set-rating-modal');
}

async function handleSetRatingSubmit(event) {
    event.preventDefault();
    const setRatingModal = document.getElementById('set-rating-modal');
    if (!setRatingModal) return;

    const userId = document.getElementById('modal-user-id')?.value;
    const ratingValue = parseFloat(document.getElementById('user-rating-input')?.value);

    if (!userId || isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
        alert('Please enter a valid rating between 1 and 5.');
        return;
    }

    showLoader();
    try {
        await databases.updateDocument(DB_ID, USER_COLLECTION_ID, userId, { rating: ratingValue });
        alert('Rating updated successfully.');
        hideModal('set-rating-modal');
        fetchUsersForAdmin(); // Refresh user table
    } catch (error) {
        console.error(`Error setting rating for user ${userId}:`, error);
        alert(`Failed to set rating: ${error.message}`);
    } finally {
        hideLoader();
    }
}


function handlePaymentToggleChange() {
    // Update the setting in Appwrite (e.g., in a settings collection)
    const isPaymentEnabled = paymentToggle.checked;
    console.log('Payment requirement changed to:', isPaymentEnabled);
    alert('Payment setting updated (simulation).');
    // Implement actual Appwrite update here
}

// ---- Realtime Subscriptions for Admin ----
function subscribeToUserUpdates() {
     if (userSubscription) userSubscription.unsubscribe();
     userSubscription = realtime.subscribe(`collections.${USER_COLLECTION_ID}.documents`, (event) => {
        // When user data changes (status, roles, rating), update the admin table
        // Need to check if the changed user affects the current admin view
        fetchUsersForAdmin(); // Simple refresh strategy
    });
}

function subscribeToPostUpdatesForAdmin() {
     if (postSubscriptionForAdmin) postSubscriptionForAdmin.unsubscribe();
     postSubscriptionForAdmin = realtime.subscribe(`collections.${POST_COLLECTION_ID}.documents`, (event) => {
        // When post data changes (approvalStatus), update the admin table
        fetchPostsForAdmin(); // Simple refresh strategy
    });
}

// ---- Initialize Admin Module ----
document.addEventListener('DOMContentLoaded', () => {
     initializeAdminModule();
});

// ---- Export Functions ----
// export { renderAdminPanel };
window.renderAdminPanel = renderAdminPanel;
window.initializeSetRatingModal = initializeSetRatingModal; // Export initialization too
