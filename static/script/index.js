// Create and append necessary elements for loader and error messages
const createDynamicElements = () => {
    const inputSection = document.querySelector('.input-section');

    // Create loader elements
    const loader = document.createElement('div');
    loader.id = 'loader';
    loader.style.display = 'none';
    
    const loaderText = document.createElement('div');
    loaderText.id = 'loaderText';
    loaderText.className = 'loadingtext';
    const loaderParagraph = document.createElement('p');
    loaderText.appendChild(loaderParagraph);
    loader.appendChild(loaderText);

    // Create error message element
    const errorMessage = document.createElement('div');
    errorMessage.id = 'errorMessage';
    errorMessage.style.display = 'none';
    errorMessage.style.color = 'red';
    errorMessage.style.marginTop = '1rem';
    errorMessage.style.textAlign = 'center';

    // Insert elements after input section
    inputSection.insertAdjacentElement('afterend', loader);
    inputSection.insertAdjacentElement('afterend', errorMessage);
};

// Check if URL has available formats
const checkAvailableFormats = (options) => {
    const hasVideoResolutions = options.available_v_resolutions && 
                              options.available_v_resolutions.length > 0;
    const hasAudioExtensions = options.available_a_extensions && 
                              options.available_a_extensions.length > 0;
    
    return hasVideoResolutions || hasAudioExtensions;
};

// Handle URL validation and format checking
const validateAndCheckFormats = async (url, loader, loaderText, errorMessage, nextButton) => {
    try {
        // Validate URL and check formats in one request
        const validateResponse = await fetch('/validate_url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        const validateResult = await validateResponse.json();

        if (!validateResult.valid) {
            throw new Error(validateResult.error || 'Invalid URL.');
        }

        // If everything is valid, proceed to download options page
        window.location.href = '/download-options?url=' + encodeURIComponent(url);

    } catch (error) {
        loader.style.display = 'none';
        errorMessage.textContent = error.message;
        errorMessage.style.display = 'block';
        nextButton.style.pointerEvents = 'auto';
        nextButton.style.opacity = '1';
    }
};


// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    createDynamicElements();
    initializeFormHandler();
    initializeQualityHandler();
    initializeClipboardHandler();
});



// Handle clipboard detection and validation
const initializeClipboardHandler = () => {
    const inputBox = document.querySelector('.inputbox input');
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loaderText').querySelector('p');
    const errorMessage = document.getElementById('errorMessage');
    const nextButton = document.querySelector('.button');

    // Function to handle clipboard content
    const handleClipboardContent = async (clipboardText) => {
        if (!clipboardText.trim() || clipboardText === inputBox.value) return;

        // Clear previous messages and show the loader
        errorMessage.style.display = 'none';
        loader.style.display = 'block';
        loaderText.textContent = 'Checking URL';

        await validateAndCheckFormats(
            clipboardText,
            loader,
            loaderText,
            errorMessage,
            nextButton
        );
    };

    // Check clipboard on page load
    navigator.clipboard.readText()
        .then(handleClipboardContent)
        .catch(err => {
            console.log('Failed to read clipboard:', err);
        });

    // Listen for focus on input box to check clipboard again
    inputBox.addEventListener('focus', () => {
        navigator.clipboard.readText()
            .then(handleClipboardContent)
            .catch(err => {
                console.log('Failed to read clipboard:', err);
            });
    });
};

// Handle form submission
const initializeFormHandler = () => {
    const inputBox = document.querySelector('.inputbox input');
    const nextButton = document.querySelector('.button');
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loaderText').querySelector('p');
    const errorMessage = document.getElementById('errorMessage');

    nextButton.addEventListener('click', async (event) => {
        event.preventDefault();

        const url = inputBox.value.trim();
        
        if (!url) {
            errorMessage.textContent = 'Please enter a URL';
            errorMessage.style.display = 'block';
            return;
        }

        // Clear previous messages and show the loader
        errorMessage.style.display = 'none';
        loader.style.display = 'block';
        loaderText.textContent = 'Checking URL';
        nextButton.style.pointerEvents = 'none';
        nextButton.style.opacity = '0.7';

        await validateAndCheckFormats(
            url,
            loader,
            loaderText,
            errorMessage,
            nextButton
        );
    });
};

// Handle quality options on download page
const initializeQualityHandler = () => {
    const qualityOptions = document.querySelectorAll('input[name="resolution"]');
    const extensionOptions = document.querySelectorAll('input[name="extension"]');
    const selectedUrlInput = document.getElementById('selected-url');

    if (!qualityOptions.length) return; // Skip if not on download options page

    function updateUrl() {
        const selectedQuality = document.querySelector('input[name="resolution"]:checked');
        const selectedExtension = document.querySelector('input[name="extension"]:checked');

        if (selectedQuality && selectedExtension) {
            selectedUrlInput.value = selectedQuality.dataset.url;
        }
    }

    qualityOptions.forEach(option => option.addEventListener('change', updateUrl));
    extensionOptions.forEach(option => option.addEventListener('change', updateUrl));

    // Initialize the URL on page load
    updateUrl();
};

// Handle back button and page refresh
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        window.location.reload();
    }
});

// Add loading animation styles
const style = document.createElement('style');
style.textContent = `
    .loadingtext {
        text-align: center;
        margin-top: 1rem;
        color: #07E44D;
    }

    .loadingtext p::after {
        position: absolute;
        animation: dotAnimation 3s infinite linear;
        content: "";
    }

    @keyframes dotAnimation {
        0% { content: ""; }
        25% { content: "."; }
        50% { content: ".."; }
        75% { content: "..."; }
        100% { content: ""; }
    }
`;
document.head.appendChild(style);





// FAQs


// Add this to your index.js file
document.addEventListener('DOMContentLoaded', () => {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Close all FAQ items
            faqItems.forEach(otherItem => {
                otherItem.classList.remove('active');
            });
            
            // Toggle current item
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });
});