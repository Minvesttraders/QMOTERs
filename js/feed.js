// ---- Feed Display Logic ----

// Cache feed elements and Firebase references
let carFeed, searchInputMobile; // Assume searchInput is in app.js
let postsCollectionListener = null; // To hold the Firestore listener for posts

// Firestore Collection References
// Assumes these constants are available globally or imported
// const FIREBASE_POSTS_COLLECTION = 'posts';
// const FIREBASE_USERS_COLLECTION = 'users';

function initializeFeedModule() {
    carFeed = document.getElementById('car-feed');
    searchInputMobile = document.getElementById('search-input-mobile'); // Need this for mobile search listener

    // Listeners attached in app.js, but initialize actions here
    // Event listener for clicks on car cards happens in renderCarCard
}

// Render a single car card for the feed
function renderCarCard(post, sellerInfo = {}) {
    // Get image URL from Firebase Storage
    let imageUrl = 'https://via.placeholder.com/300x200.png?text=No+Image'; // Default placeholder
    if (post.images && post.images.length > 0 && firebaseStorage) {
        try {
            imageUrl = firebaseStorage.ref().child(`${'car_images'}/${post.images[0]}`).getDownloadURL();
        } catch (e) { console.warn("Could not get storage URL:", e); }
    }

    const card = document.createElement('div');
    card.className = `bg-gray-700 rounded-lg shadow-md overflow-hidden cursor-pointer card-container transition duration-300 hover:shadow-xl hover:scale-105`;
    card.dataset.postId = post.id; // Use Firestore document ID

    card.innerHTML = `
        <div class="card">
            <img src="${imageUrl}" alt="${post.name || 'Car'}" class="card-image" onerror="this.onerror=null;this.src='https://via.placeholder.com/300x200.png?text=No+Image';">
            <div class="card-body">
                <h3 class="card-title">${post.name || 'Unnamed Car'}</h3>
                <p class="card-subtitle">${post.model || 'Unknown Model'} - ${post.condition === 'new' ? 'New' : 'Used'}</p>
                <p class="card-price">${formatCurrency(post.price || 0)}</p> <!-- Assumes formatCurrency is global/imported -->
                ${sellerInfo?.showroomName ? `<p class="text-xs text-neutral-grey mt-1">by ${sellerInfo.showroomName}</p>` : ''}
                ${sellerInfo?.rating ? `<div class="text-yellow-400 text-sm"><i class="fas fa-star"></i> ${sellerInfo.rating}/5</div>` : ''}
            </div>
        </div>
    `;

    // Add click listener to open detail modal using the fetched post data
    card.addEventListener('click', () => {
        showCarDetails(post, sellerInfo); // Assumes showCarDetails is global/imported
    });
    return card;
}

// Fetch and display all posts, with optional filtering
async function renderFeed(filter = '') {
    if (!carFeed || !firebaseDb) {
        console.error("Car feed element or Firebase DB not ready!");
        return;
    }
    carFeed.innerHTML = ''; // Clear existing feed
    emptyState.classList.add('hidden'); // Hide empty state initially

    showLoader();
    try {
        let query = firebaseDb.collection(FIREBASE_POSTS_COLLECTION)
            .where('approvalStatus', '==', 'approved') // Only show approved posts
            .orderBy('createdAt', 'desc'); // Order by creation time, newest first

        if (filter) {
            // Firestore client-side filtering for search terms on name OR model
            // For true full-text search, consider Algolia or Firebase specific search solutions.
            // Basic client-side filter: fetch and then filter if necessary
            // For this example, let's assume basic server-side filtering using where on indexed fields if possible,
            // or fetch and filter client-side if search is complex.
            // Simple filter approach:
            const allPosts = await query.get(); // Fetch all approved posts first if server-side filter isn't robust
            const filteredPosts = allPosts.docs.filter(post => {
                const postData = post.data();
                return postData.name?.toLowerCase().includes(filter) ||
                       postData.model?.toLowerCase().includes(filter);
            });
             // Process filtered posts (convert to array of {id, data})
            const postsData = filteredPosts.map(doc => ({ id: doc.id, ...doc.data() }));
             displayPosts(postsData); // Function to process and display fetched posts

        } else {
            // If no filter, just get the ordered posts
             const postsSnapshot = await query.get();
            const postsData = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            displayPosts(postsData); // Function to process and display fetched posts
        }

    } catch (error) {
        console.error("Error fetching posts:", error);
        carFeed.innerHTML = '<p class="text-center text-red-500 col-span-full">Failed to load cars. Please try again later.</p>';
    } finally {
        hideLoader();
    }
}

// Helper function to process and display fetched posts, including seller info
async function displayPosts(postsData) {
    carFeed.innerHTML = ''; // Clear loading message
    if (postsData.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    // Fetch seller details for each post
    const postsWithSellers = await Promise.all(postsData.map(async (post) => {
        let seller = null;
        if (post.sellerId) {
            try {
                const sellerDoc = await firebaseDb.collection(FIREBASE_USERS_COLLECTION).doc(post.sellerId).get();
                if (sellerDoc.exists) {
                    seller = sellerDoc.data();
                    seller.uid = sellerDoc.id; // Add UID for potential use
                }
            } catch (error) {
                console.warn(`Could not fetch seller ${post.sellerId} for post ${post.id}:`, error);
            }
        }
        return { ...post, seller: seller };
    }));

    // Render the cards
    postsWithSellers.forEach(post => {
        carFeed.appendChild(renderCarCard(post, post.seller));
    });
}

// Show detailed view of a car (opens modal)
function showCarDetails(post, seller) {
    const detailName = document.getElementById('detail-car-name');
    const detailModel = document.getElementById('detail-car-model');
    const detailPrice = document.getElementById('detail-car-price');
    const detailDescription = document.getElementById('detail-car-description');
    const mainCarImage = document.getElementById('main-car-image');
    const thumbnailGallery = document.getElementById('thumbnail-gallery');

    // Populate basic info
    if (detailName) detailName.textContent = post.name || 'Unnamed Car';
    if (detailModel) detailModel.textContent = `Model Year: ${post.model || 'N/A'}`;
    if (detailPrice) detailPrice.textContent = formatCurrency(post.price || 0); // Assumes formatCurrency is global
    if (detailDescription) detailDescription.textContent = post.description || 'No description available.';

    // Populate Seller Info
    const sellerNameEl = document.getElementById('detail-seller-name');
    const sellerContactEl = document.getElementById('detail-seller-contact');
    const sellerRatingEl = document.getElementById('detail-seller-rating');
    const sellerAvatarEl = document.getElementById('detail-seller-avatar');

    if (seller) {
        if (sellerNameEl) sellerNameEl.textContent = seller.showroomName || seller.displayName || 'Unknown Seller';
        if (sellerContactEl) sellerContactEl.textContent = seller.contactInfo || '';
        if (sellerRatingEl) sellerRatingEl.textContent = seller.rating !== undefined ? seller.rating : 'N/A';
        if (sellerAvatarEl) {
            // Get seller avatar URL from Firebase Storage
            let avatarUrl = 'https://via.placeholder.com/64?text=Seller'; // Default placeholder
            if (seller.avatarUrl && firebaseStorage) {
                try {
                    avatarUrl = firebaseStorage.ref().child(`car_images/${seller.avatarUrl}`).getDownloadURL();
                } catch (e) { console.warn("Could not get seller avatar URL:", e); }
            }
            sellerAvatarEl.src = avatarUrl;
            sellerAvatarEl.alt = seller.showroomName || 'Seller Avatar';
        }
    } else {
        if (sellerNameEl) sellerNameEl.textContent = 'Seller Info Unavailable';
        if (sellerContactEl) sellerContactEl.textContent = '';
        if (sellerRatingEl) sellerRatingEl.textContent = 'N/A';
    }

    // Populate Image Gallery
    if (mainCarImage && thumbnailGallery) {
        if (post.images && post.images.length > 0 && firebaseStorage) {
            // Get download URLs for all images
            const imageUrlPromises = post.images.map(imgId =>
                firebaseStorage.ref().child(`${'car_images'}/${imgId}`).getDownloadURL()
                    .catch(e => { console.warn(`Could not get URL for image ${imgId}:`, e); return null; })
            );
            const imageUrls = await Promise.all(imageUrlPromises);

            mainCarImage.src = imageUrls[0] || 'https://via.placeholder.com/600x400.png?text=No+Images';

            thumbnailGallery.innerHTML = ''; // Clear existing thumbs
            imageUrls.forEach((thumbUrl, index) => {
                if (!thumbUrl) return; // Skip if URL fetch failed
                const imgElement = document.createElement('img');
                imgElement.src = thumbUrl;
                imgElement.alt = `Car Image ${index + 1}`;
                imgElement.className = `w-20 h-20 object-cover rounded-md cursor-pointer transition duration-300 ${index === 0 ? 'border-2 border-electric-teal' : 'hover:opacity-80'}`;
                imgElement.addEventListener('click', () => {
                    mainCarImage.src = thumbUrl;
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

    showModal('car-detail-modal'); // Assuming showModal is global
}

// Handles image selection for posting a car
function handleImageSelect(event) {
    if (!imagePreviewContainer) return; // Ensure element exists
    imagePreviewContainer.innerHTML = ''; // Clear previous previews
    const files = Array.from(event.target.files);

    if (files.length > 20) {
        alert('You can upload a maximum of 20 images.');
        event.target.value = ''; // Clear the input
        return;
    }

    files.forEach((file, index) => {
        if (!file.type.startsWith('image/')) {
            alert(`File "${file.name}" is not a valid image.`);
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgElement = document.createElement('img');
            imgElement.src = e.target.result;
            imgElement.className = 'w-20 h-20 object-cover rounded-md shadow';
            imagePreviewContainer.appendChild(imgElement);
        }
        reader.readAsDataURL(file);
    });
}

// Handles the submission of the post car form
async function handlePostCarSubmit(event) {
    event.preventDefault();
    if (!currentUser || !firebaseAuth || !firebaseDb || !firebaseStorage) {
        alert('You must be logged in and services must be initialized.');
        return;
    }

    // Get form values
    const carNameInput = document.getElementById('car-name');
    const carModelInput = document.getElementById('car-model');
    const carConditionInput = document.getElementById('car-condition');
    const carPriceInput = document.getElementById('car-price');
    const carDescriptionInput = document.getElementById('car-description');

    const postData = {
        name: carNameInput.value.trim(),
        model: carModelInput.value.trim(),
        condition: carConditionInput.value,
        price: parseFloat(carPriceInput.value),
        description: carDescriptionInput.value.trim(),
        sellerId: currentUser.uid, // Link to the user's Firebase UID
        approvalStatus: 'pending', // Default status for admin review
        createdAt: firebase.firestore.FieldValue.serverTimestamp() // Server timestamp
    };

    // Basic validation
    if (!postData.name || !postData.model || !postData.price || isNaN(postData.price) || postData.price <= 0) {
        alert('Please fill in Car Name, Model Year, Price (must be valid and positive).');
        return;
    }

    showLoader();
    const imageFiles = carImagesInput.files; // Assuming carImagesInput is cached correctly
    const uploadedImageIds = []; // Store file names/references from Storage

    try {
        // Upload images to Firebase Storage first
        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];
            if (!file.type.startsWith('image/')) continue; // Skip non-image files

            // Create a unique file name in Storage
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${file.name}`;
            const storageRef = firebaseStorage.ref().child(`${'car_images'}/${fileName}`);
            const snapshot = await storageRef.put(file);
            const downloadURL = await snapshot.ref.getDownloadURL(); // Get URL if needed immediately, otherwise just use filename

            uploadedImageIds.push(fileName); // Store the file name/reference
        }

        postData.images = uploadedImageIds;

        // Save the post data to Firestore
        await firebaseDb.collection(FIREBASE_POSTS_COLLECTION).add(postData); // .add() automatically creates a document with a new ID

        hideModal('post-car-modal'); // Close the modal
        postCarForm.reset();        // Reset the form
        imagePreviewContainer.innerHTML = ''; // Clear image previews
        alert('Car posted successfully! It is awaiting admin approval.');

        // Real-time listener in feed.js should pick up new posts automatically if they are approved later.

    } catch (error) {
        console.error("Error posting car:", error);
        alert(`Failed to post car: ${error.message}. Please check file sizes or permissions and try again.`);
    } finally {
        hideLoader();
    }
}

// ---- Realtime Subscription ----
let postsCollectionListener = null; // Holds the Firestore listener for posts

function subscribeToPostsFeed() {
    if (postsCollectionListener) {
        postsCollectionListener(); // Unsubscribe previous listener if it exists
        postsCollectionListener = null;
    }

    console.log("Subscribing to Firebase Firestore posts feed...");
    let postsQuery = firebaseDb.collection(FIREBASE_POSTS_COLLECTION)
        .where('approvalStatus', '==', 'approved')
        .orderBy('createdAt', 'desc');

    // Set up the Firestore listener
    postsCollectionListener = postsQuery.onSnapshot((snapshot) => {
        console.log("Post snapshot received.");
        // Process the snapshot data
        const postsData = [];
        snapshot.forEach((doc) => {
            postsData.push({ id: doc.id, ...doc.data() });
        });

        // Render the feed with new data
        displayPosts(postsData); // Re-render the entire feed based on new data

    }, (error) => {
        console.error("Error listening to posts collection:", error);
        carFeed.innerHTML = '<p class="text-center text-red-500 col-span-full">Failed to listen for real-time car updates.</p>';
    });
}


// ---- Module Initialization ----
// Initialize module and setup initial listeners/renderings when needed
document.addEventListener('DOMContentLoaded', () => {
    initializeFeedModule(); // Ensure module elements are cached etc.
    // Initial feed rendering happens in app.js after user session is checked.
    // Real-time subscription setup also happens in app.js (subscribeToAppState)
});

// ---- Export/Make Functions Accessible ----
// These functions might be called from app.js or other modules
window.renderFeed = renderFeed;
window.initializeFeedView = () => renderFeed(); // Function called by app.js for view navigation
window.showCarDetails = showCarDetails; // For handling clicks on cards
window.handleImageSelect = handleImageSelect; // For file input change event
window.handlePostCarSubmit = handlePostCarSubmit; // For form submission
window.subscribeToPostsFeed = subscribeToPostsFeed; // For app.js to subscribe
