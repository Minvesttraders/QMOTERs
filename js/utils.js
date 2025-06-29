// ---- Utility Functions ----

// Currency Formatter (using Intl.NumberFormat, standard JS feature)
function formatCurrency(amount) {
    if (typeof amount !== 'number') {
        return 'N/A'; // Handle invalid input gracefully
    }
    try {
        // Using 'en-PK' locale for PKR, adjust if needed
        return new Intl.NumberFormat('en-PK', {
            style: 'currency',
            currency: 'PKR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    } catch (e) {
        console.warn("Could not format currency:", e);
        return `PKR ${amount.toLocaleString()}`; // Fallback formatting
    }
}

// Fetch seller info from Firestore using sellerId
async function fetchSellerInfo(sellerId) {
    if (!sellerId || !firebaseDb) return null; // Exit if no ID or DB not ready
    try {
        // Fetch user document from Firestore
        const userDoc = await firebaseDb.collection(FIREBASE_USERS_COLLECTION).doc(sellerId).get();
        if (userDoc.exists) {
            return userDoc.data(); // Return the user data object
        } else {
            console.warn(`Seller document not found for ID: ${sellerId}`);
            return null;
        }
    } catch (error) {
        console.warn(`Error fetching seller info for ${sellerId}:`, error);
        return null;
    }
}

// Generic function to format date/time if needed
function formatDateTime(isoStringOrTimestamp) {
    if (!isoStringOrTimestamp) return 'N/A';
    try {
        let date;
        if (isoStringOrTimestamp instanceof firebase.firestore.Timestamp) {
            // If it's a Firestore Timestamp object
            date = isoStringOrTimestamp.toDate();
        } else if (typeof isoStringOrTimestamp === 'string' || typeof isoStringOrTimestamp === 'number') {
            // If it's a string or number (like Date.now() or ISO string)
            date = new Date(isoStringOrTimestamp);
        } else {
            throw new Error("Invalid date format");
        }
        return date.toLocaleString(); // Standard JS formatting
    } catch (error) {
        console.warn("Could not format date:", error);
        return 'Invalid Date';
    }
}

// ---- Text Updates based on Language ----
function updateUIText(lang) {
    console.log(`Updating UI text for: ${lang}`);

    // Example: Update header elements
    const headerAppName = document.querySelector('header .font-bold');
    if (headerAppName) {
        headerAppName.textContent = lang === 'ur' ? 'کوئٹہ کارز' : 'Quetta Cars';
    }
     const postCarBtn = document.getElementById('post-car-btn');
     if (postCarBtn) {
         postCarBtn.innerHTML = lang === 'ur' ? '<i class="fas fa-plus mr-2"></i> کار پوسٹ کریں' : '<i class="fas fa-plus mr-2"></i> Post Car';
     }
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.placeholder = lang === 'ur' ? 'میک یا ماڈل کے لحاظ سے تلاش کریں...' : 'Search by Make or Model...';
    }
     const searchInputMobile = document.getElementById('search-input-mobile');
     if (searchInputMobile) {
        searchInputMobile.placeholder = lang === 'ur' ? 'میک یا ماڈل کے لحاظ سے تلاش کریں...' : 'Search by Make or Model...';
    }

    // Example: Update Auth Modal Text
    const authModalTitle = document.querySelector('#auth-modal .modal-content h2'); // More specific selector
     if (authModalTitle) {
        authModalTitle.textContent = lang === 'ur' ? 'خوش آمدید!' : 'Welcome!';
    }
    // Find login/signup buttons and update text
    const loginBtn = document.querySelector('#login-form button[type="submit"]');
    if (loginBtn) loginBtn.textContent = lang === 'ur' ? 'لاگ ان کریں' : 'Login';
    const signupBtn = document.querySelector('#signup-form button[type="submit"]');
     if (signupBtn) signupBtn.textContent = lang === 'ur' ? 'سائن اپ کریں' : 'Sign Up';
     const showSignupText = document.getElementById('show-signup-btn');
    if (showSignupText) showSignupText.textContent = lang === 'ur' ? 'سائن اپ کریں' : 'Sign Up';
    const showLoginText = document.getElementById('show-login-btn');
    if (showLoginText) showLoginText.textContent = lang === 'ur' ? 'لاگ ان کریں' : 'Login';


    // Placeholder for other text updates needed across the application
    // Add more selectors and text content for different languages here.
}

// Export functions if using modules, or make globally accessible
window.formatCurrency = formatCurrency;
window.fetchSellerInfo = fetchSellerInfo;
window.formatDateTime = formatDateTime;
window.updateUIText = updateUIText;
