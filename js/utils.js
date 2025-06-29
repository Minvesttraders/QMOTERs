// ---- Utility Functions ----

// Currency Formatter (Example for PKR)
function formatCurrency(amount) {
    if (typeof amount !== 'number') {
        return '$0.00'; // Or handle error/default
    }
    return new Intl.NumberFormat('en-PK', {
        style: 'currency',
        currency: 'PKR',
        minimumFractionDigits: 0, // No decimals for typical car prices
        maximumFractionDigits: 0
    }).format(amount);
}

// Generic function to fetch seller info (used in multiple places)
async function fetchSellerInfo(sellerId) {
    if (!sellerId) return null;
    try {
        // Cache seller info to avoid redundant fetches if possible
        // A simple global cache could work for performance
        const userDoc = await databases.getDocument(DB_ID, USER_COLLECTION_ID, sellerId);
        return userDoc;
    } catch (error) {
        console.warn(`Could not fetch seller info for ${sellerId}:`, error);
        return null;
    }
}

// Generic function to format date/time if needed
function formatDateTime(isoString) {
    if (!isoString) return 'N/A';
    try {
        return new Date(isoString).toLocaleString();
    } catch (error) {
        return 'Invalid Date';
    }
}

// --- Moved Loader and Modal Handling to app.js for core management ---
// If you want them truly separated, ensure app.js imports them or app.js provides the hooks.

// ---- Text Updates based on Language ----
function updateUIText(lang) {
    // Placeholder function to be called by app.js when language changes
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
    const authModalTitle = document.querySelector('#auth-modal h2');
     if (authModalTitle) {
        authModalTitle.textContent = lang === 'ur' ? 'خوش آمدید!' : 'Welcome!';
    }
    const loginBtn = document.querySelector('#login-form button[type="submit"]');
    if (loginBtn) loginBtn.textContent = lang === 'ur' ? 'لاگ ان کریں' : 'Login';
    const signupBtn = document.querySelector('#signup-form button[type="submit"]');
     if (signupBtn) signupBtn.textContent = lang === 'ur' ? 'سائن اپ کریں' : 'Sign Up';
     const showSignupText = document.getElementById('show-signup-btn');
    if (showSignupText) showSignupText.textContent = lang === 'ur' ? 'سائن اپ کریں' : 'Sign Up';
    const showLoginText = document.getElementById('show-login-btn');
    if (showLoginText) showLoginText.textContent = lang === 'ur' ? 'لاگ ان کریں' : 'Login';


    // Add more text updates for other elements (placeholders, labels, buttons, etc.)
    // This is where a proper i18n library would be very helpful.
}

// Export functions if using modules
/*
export {
    formatCurrency,
    fetchSellerInfo,
    formatDateTime,
    updateUIText
};
*/
window.formatCurrency = formatCurrency;
window.fetchSellerInfo = fetchSellerInfo;
window.updateUIText = updateUIText;
window.formatDateTime = formatDateTime;
