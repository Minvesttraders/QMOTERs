// ---- Posting Car Logic ----

// Cache elements related to posting
let imagePreviewContainer;
let carImagesInput;
let postCarForm;

function initializePostingModule() {
    imagePreviewContainer = document.getElementById('image-preview');
    carImagesInput = document.getElementById('car-images');
    postCarForm = document.getElementById('post-car-form'); // The form element itself

    // Add event listeners
    carImagesInput?.addEventListener('change', handleImageSelect);
    postCarForm?.addEventListener('submit', handlePostCarSubmit);

    // Add close handler for the modal
     const closePostModalBtn = document.getElementById('close-post-modal');
     closePostModalBtn?.addEventListener('click', () => hideModal('post-car-modal'));

    // Add generic listener for clicking outside the modal content
    const postModalOverlay = document.getElementById('post-car-modal');
    postModalOverlay?.addEventListener('click', (event) => {
        if (event.target === postModalOverlay) { // Clicked on the backdrop
            hideModal('post-car-modal');
        }
    });
}

function openPostCarModal() {
    if (!currentUser) {
        alert('Please log in to post a car.');
        toggleAuthModal(); // Show login/signup modal
        return;
    }
    // Reset the form and previews
    postCarForm?.reset();
    imagePreviewContainer?.innerHTML = '';
    showModal('post-car-modal');
}

function handleImageSelect(event) {
    if (!imagePreviewContainer) return;
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

async function handlePostCarSubmit(event) {
    event.preventDefault();
    if (!currentUser) {
        alert('You must be logged in to post a car.');
        return;
    }

    // Gather form data
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
        sellerId: currentUser.appwriteId, // Link to the user
        approvalStatus: 'pending' // Default status for admin review
    };

    // Basic validation
    if (!postData.name || !postData.model || !postData.price) {
        alert('Please fill in Car Name, Model Year, and Price.');
        return;
    }
    if (isNaN(postData.price) || postData.price <= 0) {
        alert('Please enter a valid price.');
        return;
    }

    showLoader();
    const imageFiles = carImagesInput.files;
    const uploadedImageIds = [];

    try {
        // Upload images first
        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];
            if (!file.type.startsWith('image/')) continue;

            const uploadedFile = await storage.createFile(
                appwriteConfig.storageBucketId,
                Appwrite.ID.unique(),
                file
            );
            uploadedImageIds.push(uploadedFile.$id);
        }

        postData.images = uploadedImageIds;

        // Create the post document in Appwrite
        await databases.createDocument(DB_ID, POST_COLLECTION_ID, Appwrite.ID.unique(), postData);

        hideModal('post-car-modal');
        postCarForm.reset();
        imagePreviewContainer.innerHTML = ''; // Clear previews
        alert('Car posted successfully! It is awaiting admin approval.');

        // The realtime subscription should handle updating the feed if the post becomes approved.
        // For now, we don't force a re-render here as the post is pending.

    } catch (error) {
        console.error("Error posting car:", error);
        alert(`Failed to post car: ${error.message}. Please check file sizes and try again.`);
    } finally {
        hideLoader();
    }
}

// ---- Initialize Posting View ----
// Call this when the posting related UI elements are needed (e.g., on click)
// Or ensure the initialisation runs when app.js loads
document.addEventListener('DOMContentLoaded', () => {
     initializePostingModule();
});

// ---- Exported Functions ----
// export { openPostCarModal }; // Make this available globally or via app.js import
window.openPostCarModal = openPostCarModal; // Make globally available for the button handler in app.js
