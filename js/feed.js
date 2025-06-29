// ---- Feed Display Logic ----

let postSubscription = null; // To hold the realtime subscription object

// Cache feed elements
const carFeed = document.getElementById('car-feed'); // Assume this ID exists in index.html's main content area
const searchInputMobile = document.getElementById('search-input-mobile'); // Need access to this for search

function renderCarCard(post, sellerInfo = {}) {
    const imageUrl = post.images && post.images.length > 0
        ? storage.getFilePreview(appwriteConfig.storageBucketId, post.images[0]).href
        : 'https://via.placeholder.com/300x200.png?text=No+Image'; // Fallback image

    const card = document.createElement('div');
    // Use CSS classes for styling from styles.css and Tailwind
    card.className = `bg-gray-700 rounded-lg shadow-md overflow-hidden cursor-pointer card-container transition duration-300 hover:shadow-xl hover:scale-105`;
    card.dataset.postId = post.$id; // For easy lookup/updates

    // Basic card structure. Could be made more dynamic based on available data.
    card.innerHTML = `
        <div class="card">
            <img src="${imageUrl}" alt="${post.name || 'Car'}" class="card-image">
            <div class="card-body">
                <h3 class="card-title">${post.name || 'Unnamed Car'}</h3>
                <p class="card-subtitle">${post.model || 'Unknown Model'} - ${post.condition === 'new' ? 'New' : 'Used'}</p>
                <p class="card-price">${formatCurrency(post.price || 0)}</p>
                ${sellerInfo.showroomName ? `<p class="text-xs text-neutral-grey mt-1">by ${sellerInfo.showroomName}</p>` : ''}
                ${sellerInfo.rating ? `<div class="text-yellow-400 text-sm"><i class="fas fa-star"></i> ${sellerInfo.rating}/5</div>` : ''}
            </div>
        </div>
    `;

    // Add click listener to open detail modal
    card.addEventListener('click', () => showCarDetails(post, sellerInfo));
    return card;
}

async function renderFeed(filter = '') {
    if (!carFeed) {
        console.error("Car feed element not found!");
        return;
    }
    carFeed.innerHTML = ''; // Clear existing feed
    emptyState.classList.add('hidden'); // Hide empty state

    showLoader();
    try {
        let query = undefined;
        if (filter) {
            // Appwrite supports text search for specific fields. If you have 'name' and 'model' text-indexed.
            query = [
                 Appwrite.Query.or([
                     Appwrite.Query.search('name', filter),
                     Appwrite.Query.search('model', filter)
                 ]),
                 // Ensure posts are approved before displaying publicly
                 Appwrite.Query.equal('approvalStatus', 'approved')
             ];
        } else {
            // Default query for public feed: only approved posts
            query = [Appwrite.Query.equal('approvalStatus', 'approved')];
        }

        // Fetch posts
        const postsResponse = await databases.listDocuments(DB_ID, POST_COLLECTION_ID, query);
        const posts = postsResponse.documents;

        if (posts.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }

        // Fetch seller details for each post (can be optimized if many posts)
        const sellerPromises = posts.map(async (post) => {
            try {
                const sellerDoc = await databases.getDocument(DB_ID, USER_COLLECTION_ID, post.sellerId);
                return { ...post, seller: sellerDoc };
            } catch (sellerError) {
                console.warn(`Could not fetch seller ${post.sellerId} for post ${post.$id}:`, sellerError);
                return { ...post, seller: null };
            }
        });
        const postsWithSellers = await Promise.all(sellerPromises);

        // Render cards
        postsWithSellers.forEach(post => {
            carFeed.appendChild(renderCarCard(post, post.seller));
        });

    } catch (error) {
        console.error("Error fetching posts:", error);
        carFeed.innerHTML = '<p class="text-center text-red-500 col-span-full">Failed to load cars. Please try again later.</p>';
    } finally {
        hideLoader();
    }
}

// Function to show detailed view of a car (might open a modal)
function showCarDetails(post, seller) {
    if (carDetailModal && typeof showModal === 'function') {
        // Populate the modal elements (defined elsewhere or here)
        const detailName = document.getElementById('detail-car-name');
        const detailModel = document.getElementById('detail-car-model');
        const detailPrice = document.getElementById('detail-car-price');
        const detailDescription = document.getElementById('detail-car-description');
        const mainCarImage = document.getElementById('main-car-image');
        const thumbnailGallery = document.getElementById('thumbnail-gallery');

        if (detailName) detailName.textContent = post.name || 'Unnamed Car';
        if (detailModel) detailModel.textContent = `Model Year: ${post.model || 'N/A'}`;
        if (detailPrice) detailPrice.textContent = formatCurrency(post.price || 0); // Use currency formatter from utils
        if (detailDescription) detailDescription.textContent = post.description || 'No description available.';

        // Seller info
        const sellerNameEl = document.getElementById('detail-seller-name');
        const sellerContactEl = document.getElementById('detail-seller-contact');
        const sellerRatingEl = document.getElementById('detail-seller-rating');
        const sellerAvatarEl = document.getElementById('detail-seller-avatar');

        if (seller) {
            if (sellerNameEl) sellerNameEl.textContent = seller.showroomName || seller.displayName || 'Unknown Seller';
            if (sellerContactEl) sellerContactEl.textContent = seller.contactInfo || '';
            if (sellerRatingEl) sellerRatingEl.textContent = seller.rating !== undefined ? seller.rating : 'N/A';
            if (sellerAvatarEl) {
                sellerAvatarEl.src = seller.avatarUrl ? storage.getFilePreview(appwriteConfig.storageBucketId, seller.avatarUrl).href : 'https://via.placeholder.com/64?text=Seller';
                sellerAvatarEl.alt = seller.showroomName || 'Seller Avatar';
            }
        } else {
            if (sellerNameEl) sellerNameEl.textContent = 'Seller Info Unavailable';
             if (sellerContactEl) sellerContactEl.textContent = '';
             if (sellerRatingEl) sellerRatingEl.textContent = 'N/A';
        }


        // Image Gallery
        if (mainCarImage && thumbnailGallery) {
             if (post.images && post.images.length > 0) {
                 mainCarImage.src = storage.getFilePreview(appwriteConfig.storageBucketId, post.images[0]).href;
                thumbnailGallery.innerHTML = ''; // Clear existing thumbs

                 post.images.forEach((imgId, index) => {
                    const thumbUrl = storage.getFilePreview(appwriteConfig.storageBucketId, imgId, 150, 150).href;
                    const imgElement = document.createElement('img');
                    imgElement.src = thumbUrl;
                    imgElement.alt = `Car Image ${index + 1}`;
                    imgElement.className = `w-20 h-20 object-cover rounded-md cursor-pointer transition duration-300 ${index === 0 ? 'border-2 border-electric-teal' : 'hover:opacity-80'}`;
                    imgElement.addEventListener('click', () => {
                        mainCarImage.src = storage.getFilePreview(appwriteConfig.storageBucketId, imgId).href;
                        // Update active thumbnail styling
                         document.querySelectorAll('#thumbnail-gallery img').forEach(img => img.classList.remove('border-2', 'border-electric-teal'));
                         imgElement.classList.add('border-2', 'border-electric-teal');
                    });
                    thumbnailGallery.appendChild(imgElement);
                 });
             } else {
                mainCarImage.src = 'https://via.placeholder.com/600x400.png?text=No+Images';
                 thumbnailGallery.innerHTML = '<p class="text-neutral-grey">No images available.</p>';
            }
        }

        showModal('car-detail-modal');
    }
}

// ---- Realtime Subscription ----
function subscribeToPostsFeed() {
    // Unsubscribe from previous if it exists
    if (postSubscription) {
        postSubscription.unsubscribe();
    }

    console.log("Subscribing to post updates...");
    // Subscribe to changes in the 'posts' collection
    postSubscription = realtime.subscribe(`collections.${POST_COLLECTION_ID}.documents`, (event) => {
        console.log('Post update received:', event);
        const updatedPost = event.payload;
        const currentFilter = (searchInput?.value || searchInputMobile?.value || '').trim().toLowerCase();

        if (event.event === 'databases.documents.create') {
            // If the new post matches the current filter, add it to the feed
             if (updatedPost.approvalStatus === 'approved' && (!currentFilter || updatedPost.name?.toLowerCase().includes(currentFilter) || updatedPost.model?.toLowerCase().includes(currentFilter))) {
                 fetchSellerInfo(updatedPost.$id).then(seller => {
                    carFeed.prepend(renderCarCard(updatedPost, seller)); // Add to top
                 });
            }
        } else if (event.event === 'databases.documents.update') {
            const existingCard = carFeed.querySelector(`[data-post-id="${updatedPost.$id}"]`);
            const matchesFilter = !currentFilter || updatedPost.name?.toLowerCase().includes(currentFilter) || updatedPost.model?.toLowerCase().includes(currentFilter);

            if (updatedPost.approvalStatus === 'approved' && matchesFilter) {
                // Post is approved and matches filter: update or re-render card
                 fetchSellerInfo(updatedPost.$id).then(seller => {
                    const newCard = renderCarCard(updatedPost, seller);
                    if (existingCard) {
                        carFeed.replaceChild(newCard, existingCard); // Replace existing
                    } else {
                         carFeed.prepend(newCard); // Add if it wasn't visible before
                    }
                 });
            } else if (existingCard) {
                // Post existed but no longer matches filter or is not approved: remove it
                existingCard.remove();
                if (carFeed.children.length === 0) {
                    emptyState.classList.remove('hidden');
                }
            }
        } else if (event.event === 'databases.documents.delete') {
            // Remove the card if it exists
            const cardToRemove = carFeed.querySelector(`[data-post-id="${updatedPost.$id}"]`);
            if (cardToRemove) {
                cardToRemove.remove();
                if (carFeed.children.length === 0) {
                    emptyState.classList.remove('hidden');
                }
            }
        }
    });
}

// Helper to fetch seller info (can be cached)
async function fetchSellerInfo(postId) {
    try {
        const postDoc = await databases.getDocument(DB_ID, POST_COLLECTION_ID, postId);
        if (postDoc.sellerId) {
            return await databases.getDocument(DB_ID, USER_COLLECTION_ID, postDoc.sellerId);
        }
    } catch (error) {
        console.warn(`Could not fetch seller info for post ${postId}:`, error);
    }
    return null;
}


// ---- Module Initialization ----
// This ensures the feed renders on initial load or when the view changes to #feed
function initializeFeedView() {
    console.log("Initializing Feed View...");
    renderFeed(); // Render the feed initially
    if (!postSubscription) { // Only subscribe if not already subscribed
         subscribeToPostsFeed();
    }
}

// Make functions available globally or export them
window.renderFeed = renderFeed;
window.initializeFeedView = initializeFeedView;
window.showCarDetails = showCarDetails;
