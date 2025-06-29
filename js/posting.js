// ---- Posting Car Logic ----

// Cache elements related to posting
let imagePreviewContainer, carImagesInput, postCarForm;

function initializePostingModule() {
    imagePreviewContainer = document.getElementById('image-preview');
    carImagesInput = document.getElementById('car-images');
    postCarForm = document.getElementById('post-car-form');

    // Add event listeners
    carImagesInput?.addEventListener('change', handleImageSelect);
    postCarForm?.addEventListener('submit', handlePostCarSubmit);

    // Close handler for the modal (if not handled globally by app.js)
     const closePostModalBtn = document.getElementById('close-post-modal');
     closePostModalBtn?.addEventListener('click', () => hideModal('post-car-modal'));

    // Click outside listener for modal (if not handled globally)
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
        // Assuming toggleAuthModal is globally available from app.js
        if (typeof toggleAuthModal === 'function') toggleAuthModal();
        return;
    }
    // Reset the form and previews before opening
    postCarForm?.reset();
    if(imagePreviewContainer) imagePreviewContainer.innerHTML = '';
    showModal('post-car-modal');
}

// Handles image selection and shows previews
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

// Handles the submission of the post car form using Firebase
async function handlePostCarSubmit(event) {
    event.preventDefault();
    if (!currentUser || !firebaseAuth || !firebaseDb || !firebaseStorage) {
        alert('You must be logged in and Firebase services must be initialized.');
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
        createdAt: firebase.firestore.FieldValue.serverTimestamp() // Use server timestamp
    };

    // Basic validation
    if (!postData.name || !postData.model || !postData.price || isNaN(postData.price) || postData.price <= 0) {
        alert('Please fill in Car Name, Model Year, and Price (must be valid and positive).');
        return;
    }

    showLoader();
    const imageFiles = carImagesInput.files;
    const uploadedImageFileNames = []; // Store file names (references) from Storage

    try {
        // Upload images to Firebase Storage first
        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];
            if (!file.type.startsWith('image/')) continue;

            // Create a unique file name using timestamp and random string for uniqueness in Storage
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${file.name}`;
            const storageRef = firebaseStorage.ref().child(`${'car_images'}/${fileName}`); // Path in Storage
            const snapshot = await storageRef.put(file); // Upload the file

            // Store the file name (which serves as the reference for getDownloadURL)
            uploadedImageFileNames.push(fileName);
        }

        postData.images = uploadedImageFileNames; // Save the array of image file names

        // Save the post data to Firestore
        await firebaseDb.collection(FIREBASE_POSTS_COLLECTION).add(postData); // .add() creates a new doc with auto ID

        hideModal('post-car-modal'); // Close the modal
        postCarForm.reset();        // Reset the form fields
        if(imagePreviewContainer) imagePreviewContainer.innerHTML = ''; // Clear image previews
        alert('Car posted successfully! It is awaiting admin approval.');

    } catch (error) {
        console.error("Error posting car:", error);
        alert(`Failed to post car: ${error.message}. Please check file sizes or permissions and try again.`);
    } finally {
        hideLoader();
    }
}

// ---- Module Initialization ----
// Ensure necessary initializations happen
document.addEventListener('DOMContentLoaded', () => {
     initializePostingModule();
});

// ---- Export/Make Functions Accessible ----
window.openPostCarModal = openPostCarModal; // Make callable globally or via app.js
// window.handleImageSelect = handleImageSelect; // Called directly via listener
// window.handlePostCarSubmit = handlePostCarSubmit; // Called directly via listener
