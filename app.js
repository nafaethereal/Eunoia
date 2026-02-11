// Import Firebase SDKs (NO STORAGE!)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, onSnapshot, serverTimestamp, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- FIREBASE CONFIGURATION (REPLACE WITH YOUR KEYS) ---
const firebaseConfig = {
    apiKey: "AIzaSyAg_CR0S1E90ys5-bMOAS1sfgdaYHfnTIE",
    authDomain: "eunoia-c365c.firebaseapp.com",
    projectId: "eunoia-c365c",
    storageBucket: "eunoia-c365c.firebasestorage.app",
    messagingSenderId: "373307127847",
    appId: "1:373307127847:web:fea202234770f45eee3602",
    measurementId: "G-J0JFDDF0FH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM ELEMENTS ---
const landingPage = document.querySelector('.landing-page');
const dashboardPage = document.querySelector('.dashboard-page');
const loginBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const tabButtons = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.content-section');

// Global State
let lastLoadedEntries = []; // All journal entries
let photoEntries = []; // Journal photos for lightbox
let galleryPhotos = []; // Gallery photos for lightbox
let currentPhotoIndex = -1;
let categories = ['Digital Art', 'Traditional Art', 'Canva', 'Figma', 'Sketch', 'Other'];
let isSelectMode = false;
let overviewChart = null; // Variable for the Chart.js instance
let currentOverviewSelection = ""; // Track current active month-year selection

// --- AUTHENTICATION ---
const provider = new GoogleAuthProvider();

if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        signInWithPopup(auth, provider)
            .then((result) => {
                console.log("Logged in:", result.user);
            }).catch((error) => {
                console.error("Login failed:", error);
                showAlert("Login Error", "Login failed. Please try again.");
            });
    });
}

// Logout with confirmation
const logoutModal = document.getElementById('logout-modal');
const confirmLogoutBtn = document.getElementById('confirm-logout');
const cancelLogoutBtn = document.getElementById('cancel-logout');

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        logoutModal.classList.remove('hidden');
    });
}

if (cancelLogoutBtn) {
    cancelLogoutBtn.addEventListener('click', () => {
        logoutModal.classList.add('hidden');
    });
}

if (confirmLogoutBtn) {
    confirmLogoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.reload();
        });
    });
}

onAuthStateChanged(auth, (user) => {
    const isDashboard = window.location.pathname.includes('dashboard.html');

    if (user) {
        if (!isDashboard) {
            window.location.href = 'dashboard.html';
            return;
        }

        // Populate Dashboard UI
        if (dashboardPage) dashboardPage.classList.remove('hidden');
        if (landingPage) landingPage.classList.add('hidden');

        if (userAvatar) userAvatar.src = user.photoURL;
        if (userName) userName.textContent = user.displayName.split(' ')[0];

        loadJournal(user.uid);
        loadGallery();
        loadCategories();
        initOverview(user.uid);
        updateOverview(user.uid);
    } else {
        if (isDashboard) {
            window.location.href = 'index.html';
            return;
        }

        if (landingPage) {
            landingPage.classList.remove('hidden');
            landingPage.style.display = 'flex';
        }
        if (dashboardPage) dashboardPage.classList.add('hidden');
    }
});

// --- NAVIGATION ---
tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        // Update Nav UI
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Show Section
        const tabName = btn.getAttribute('data-tab');
        sections.forEach(sec => sec.classList.remove('active'));
        document.getElementById(`${tabName}-section`).classList.add('active');

        // Re-render journal if switching back to it
        if (tabName === 'journal') {
            renderJournalItems();
        }
        if (tabName === 'overview') {
            const user = auth.currentUser;
            if (user) updateOverview(user.uid);
        }
    });
});

// --- GALLERY LOGIC (BASE64 APPROACH) ---
const uploadModal = document.getElementById('upload-modal');
const openUploadBtn = document.getElementById('open-upload-modal');
const closeUploadBtn = document.querySelector('.close-modal');
const uploadForm = document.getElementById('upload-form');
const fileInput = document.getElementById('art-file');
const previewImg = document.getElementById('image-preview');

openUploadBtn.addEventListener('click', () => uploadModal.classList.remove('hidden'));
closeUploadBtn.addEventListener('click', () => uploadModal.classList.add('hidden'));

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // Check file size (max 1MB recommended for Base64)
        if (file.size > 1024 * 1024) {
            showAlert("Gambar Terlalu Besar", "Maksimal 1MB. Coba kompres dulu ya.");
            fileInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            previewImg.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const file = fileInput.files[0];
    const category = document.getElementById('art-category').value;
    const caption = document.getElementById('art-caption').value;
    const submitBtn = document.getElementById('upload-submit-btn');

    if (!file) return;

    try {
        submitBtn.textContent = "Uploading...";
        submitBtn.disabled = true;

        // Convert image to Base64
        const base64Image = await fileToBase64(file);

        // Save to Firestore (NO STORAGE NEEDED!)
        await addDoc(collection(db, "gallery_posts"), {
            uid: user.uid,
            authorName: user.displayName,
            imageData: base64Image, // Base64 string
            category: category,
            caption: caption,
            createdAt: serverTimestamp()
        });

        uploadModal.classList.add('hidden');
        uploadForm.reset();
        previewImg.classList.add('hidden');
        showAlert("Success", "Artwork uploaded successfully!");
    } catch (error) {
        console.error("Upload error:", error);
        showAlert("Error", "Failed to upload. See console.");
    } finally {
        submitBtn.textContent = "Upload";
        submitBtn.disabled = false;
    }
});

// Helper: Convert File to Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function renderGalleryItems() {
    const galleryGrid = document.getElementById('gallery-grid');
    galleryGrid.innerHTML = '';

    galleryPhotos.forEach((item, index) => {
        const el = document.createElement('div');
        el.className = 'gallery-item';
        el.innerHTML = `
            <div class="gallery-actions">
                <button class="btn-gallery-action action-edit-post" data-id="${item.id}" title="Edit Artwork"><i class="fas fa-edit"></i></button>
                <button class="btn-gallery-action action-delete-post" data-id="${item.id}" title="Delete Artwork"><i class="fas fa-trash-alt"></i></button>
            </div>
            <img src="${item.imageData}" alt="${item.category}" class="gallery-img" data-gallery-index="${index}">
            <div class="gallery-info">
                <span class="gallery-category">${item.category}</span>
                <p class="gallery-caption">${item.caption || ''}</p>
            </div>
        `;
        galleryGrid.appendChild(el);
    });

    // Lightbox trigger is now handled by global delegation
}

// Global Gallery Listeners (Removed - handled by main delegation)

function renderFilterButtons() {
    const filterBars = document.querySelectorAll('.filter-bar');
    if (!filterBars.length) return;

    const buttonsHtml = `
        <button class="filter-btn active" data-filter="all">All</button>
        ${categories.map(cat => `<button class="filter-btn" data-filter="${cat}">${cat}</button>`).join('')}
    `;

    filterBars.forEach(bar => {
        bar.innerHTML = buttonsHtml;
    });
}

let galleryUnsubscribe = null;

function loadGallery(filter = 'all') {
    const grid = document.getElementById('gallery-grid');
    if (grid) grid.innerHTML = '<div class="loading-state">Loading gallery...</div>';

    if (galleryUnsubscribe) {
        galleryUnsubscribe();
    }

    const collectionRef = collection(db, "gallery_posts");
    let q;
    if (filter === 'all') {
        q = query(collectionRef, orderBy("createdAt", "desc"));
    } else {
        q = query(collectionRef, where("category", "==", filter), orderBy("createdAt", "desc"));
    }

    galleryUnsubscribe = onSnapshot(q, (snapshot) => {
        galleryPhotos = [];
        snapshot.forEach((doc) => {
            galleryPhotos.push({ id: doc.id, ...doc.data() });
        });

        if (snapshot.empty) {
            if (grid) grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #8F8B85; padding: 40px;">No photos uploaded yet</p>`;
            if (filter === 'all') updateLastUploadInfo(null);
            galleryPhotos = []; // Ensure it's empty
        } else {
            renderGalleryItems();
            if (filter === 'all') {
                const lastPost = galleryPhotos[0];
                if (lastPost && lastPost.createdAt) {
                    updateLastUploadInfo(lastPost.createdAt.toDate());
                }
            }
        }
    }, (error) => {
        console.error("Gallery snapshot error:", error);

        if (error.code === 'failed-precondition' || error.message.includes('index')) {
            const indexLink = error.message.match(/https:\/\/[^\s]+/);
            const msg = indexLink
                ? `Gallery index required for filtering. Please click this link to create it: ${indexLink[0]}`
                : "Gallery index required. Please check Firebase console to create a composite index for 'category' and 'createdAt'.";
            showAlert("Index Required", msg);
        } else {
            if (grid) grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #dc3545;">Failed to load gallery.</p>';
        }
    });
}

// Global Filter Bar Listener (Added once)
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;

    const bar = btn.closest('.filter-bar');
    if (!bar) return;

    // Update UI
    bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const category = btn.getAttribute('data-filter');
    loadGallery(category);
});

function updateLastUploadInfo(date) {
    const el = document.getElementById('gallery-last-upload');
    if (!el) return;
    if (!date) {
        el.textContent = '';
        return;
    }
    const now = new Date();
    const diff = now - date;
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));

    let timeStr = "";
    if (diffDays === 0) {
        timeStr = "Today at " + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        timeStr = "Yesterday at " + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else {
        timeStr = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) + " at " + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    el.textContent = `Last update: ${timeStr}`;
}


// --- JOURNAL LOGIC ---
const journalEntry = document.getElementById('journal-entry');
const moodSelect = document.getElementById('mood-select');
const ratingInput = document.getElementById('rating-input');
const saveJournalBtn = document.getElementById('save-journal-btn');
const journalPhotoInput = document.getElementById('journal-photo');
const journalPhotoPreview = document.getElementById('journal-photo-preview');
const journalPreviewImg = document.getElementById('journal-preview-img');
const removeJournalPhotoBtn = document.getElementById('remove-journal-photo');
let currentJournalPhoto = null;
// Mood emoji mapping
const moodEmojis = {
    amazing: '🤩',
    happy: '😊',
    good: '😄',
    content: '😌',
    neutral: '😐',
    tired: '😴',
    sad: '😢',
    anxious: '😰',
    angry: '😠',
    terrible: '😭'
};

// Mood numeric values for avg calculation
const moodValues = {
    amazing: 10,
    happy: 8,
    good: 7,
    content: 6,
    neutral: 5,
    tired: 4,
    sad: 3,
    anxious: 2,
    angry: 2,
    terrible: 1
};

// --- 10-STAR RATING LOGIC ---
const starsContainer = document.getElementById('rating-stars');
let currentRating = 3; // Default

// Initialize stars (10 stars)
function initStars() {
    if (!starsContainer) return;
    starsContainer.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
        const star = document.createElement('span');
        star.textContent = '★';
        star.dataset.value = i;
        star.style.cursor = 'pointer';
        star.style.color = i <= currentRating ? '#ffd700' : '#e4e5e9';
        star.style.fontSize = '1.5rem';

        star.addEventListener('click', () => {
            currentRating = i;
            if (ratingInput) ratingInput.value = currentRating;
            updateStars();
        });

        // Optional: Hover effect
        star.addEventListener('mouseover', () => updateStars(i));
        star.addEventListener('mouseout', () => updateStars(currentRating));

        starsContainer.appendChild(star);
    }
    if (ratingInput) ratingInput.value = currentRating;
}

function updateStars(rating = currentRating) {
    if (!starsContainer) return;
    const stars = starsContainer.children;
    for (let i = 0; i < stars.length; i++) {
        stars[i].style.color = (i + 1) <= rating ? '#ffd700' : '#e4e5e9';
    }
}

// Call init
initStars();

// Journal Photo Preview
journalPhotoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        // Check file size (max 500KB)
        if (file.size > 500 * 1024) {
            alert('Photo too large! Max 500KB. Please compress it.');
            journalPhotoInput.value = '';
            return;
        }

        currentJournalPhoto = await fileToBase64(file);
        journalPreviewImg.src = currentJournalPhoto;
        journalPhotoPreview.classList.remove('hidden');
    }
});

removeJournalPhotoBtn.addEventListener('click', () => {
    currentJournalPhoto = null;
    journalPhotoInput.value = '';
    journalPhotoPreview.classList.add('hidden');
});

// Save Entry
saveJournalBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;

    const content = journalEntry.value.trim();
    if (!content) {
        alert("Please write something first.");
        return;
    }

    const rating = parseFloat(ratingInput.value) || 5;
    if (rating < 0 || rating > 10) {
        alert("Rating must be between 0 and 10.");
        return;
    }

    try {
        showLoading(true);

        const now = new Date();
        const entryData = {
            uid: user.uid,
            content: content,
            mood: moodSelect.value,
            rating: rating,
            createdAt: serverTimestamp(),
            dateString: now.toLocaleDateString('id-ID'),
            timeString: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };

        // Add photo if exists
        if (currentJournalPhoto) {
            entryData.photoData = currentJournalPhoto;
        }

        await addDoc(collection(db, "journal_entries"), entryData);

        journalEntry.value = '';
        currentJournalPhoto = null;
        journalPhotoInput.value = '';
        journalPhotoPreview.classList.add('hidden');
        ratingInput.value = 5;
        moodSelect.value = 'neutral';

        renderJournalItems(); // Force immediate render after save
        showLoading(false);
        await showAlert("Berhasil", "Cerita kamu telah tersimpan.");
    } catch (e) {
        console.error("Error saving journal:", e);
        showLoading(false);
        showAlert("Error", "Gagal menyimpan. Silakan cek konsol.");
    }
});

// --- LIGHTBOX LOGIC ---
const lightbox = document.getElementById('photo-lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.querySelector('.lightbox-close');
const lightboxPrev = document.getElementById('lightbox-prev');
const lightboxNext = document.getElementById('lightbox-next');
const lightboxCounter = document.getElementById('lightbox-counter');
const lightboxEditBtn = document.getElementById('lightbox-edit-photo');
const lightboxDeleteBtn = document.getElementById('lightbox-delete-photo');

// --- LIGHTBOX REFINED ---
let currentLightboxContext = 'journal'; // 'journal' or 'gallery'

function openLightbox(index, context = 'journal') {
    currentLightboxContext = context;
    currentPhotoIndex = index;
    updateLightbox();
    lightbox.classList.remove('hidden');

    const lightboxActions = document.querySelector('.lightbox-actions');
    if (context === 'gallery') {
        lightboxActions.classList.add('hidden');
    } else {
        lightboxActions.classList.remove('hidden');
    }
}

function updateLightbox() {
    const list = currentLightboxContext === 'journal' ? photoEntries : galleryPhotos;
    const item = list[currentPhotoIndex];
    if (!item) {
        lightbox.classList.add('hidden');
        return;
    }

    lightboxImg.src = currentLightboxContext === 'journal' ? item.photoData : item.imageData;
    lightboxCounter.textContent = `${currentPhotoIndex + 1} / ${list.length}`;

    // Show/hide nav buttons based on list length and index
    lightboxPrev.style.visibility = (currentPhotoIndex > 0) ? 'visible' : 'hidden';
    lightboxNext.style.visibility = (currentPhotoIndex < list.length - 1) ? 'visible' : 'hidden';
}

function navigateLightbox(dir) {
    const list = currentLightboxContext === 'journal' ? photoEntries : galleryPhotos;
    if (dir === 'next' && currentPhotoIndex < list.length - 1) {
        currentPhotoIndex++;
    } else if (dir === 'prev' && currentPhotoIndex > 0) {
        currentPhotoIndex--;
    }
    updateLightbox();
}

// Fixed position navigation event listeners
lightboxNext.addEventListener('click', (e) => {
    e.stopPropagation();
    navigateLightbox('next');
});

lightboxPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    navigateLightbox('prev');
});

lightboxClose.addEventListener('click', () => lightbox.classList.add('hidden'));

// Keyboard Navigation
document.addEventListener('keydown', (e) => {
    if (lightbox.classList.contains('hidden')) return;
    if (e.key === 'ArrowRight') navigateLightbox('next');
    if (e.key === 'ArrowLeft') navigateLightbox('prev');
    if (e.key === 'Escape') lightbox.classList.add('hidden');
});

// Touch Swipe Support
let touchStartX = 0;
let touchEndX = 0;

lightbox.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

lightbox.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const swipeDistance = touchEndX - touchStartX;
    if (Math.abs(swipeDistance) > 50) {
        if (swipeDistance > 0) navigateLightbox('prev');
        else navigateLightbox('next');
    }
}, { passive: true });

// --- DELEGATED EVENTS FOR DYNAMIC CONTENT ---
document.addEventListener('click', (e) => {
    // Gallery Edit
    const editBtn = e.target.closest('.action-edit-post');
    if (editBtn) {
        openEditGalleryModal(editBtn.getAttribute('data-id'));
    }

    // Gallery Delete
    const deleteBtn = e.target.closest('.action-delete-post');
    if (deleteBtn) {
        deleteGalleryPost(deleteBtn.getAttribute('data-id'));
    }

    // Lightbox Trigger (Journal)
    if (e.target.classList.contains('journal-photo')) {
        const index = parseInt(e.target.getAttribute('data-photo-index'));
        openLightbox(index, 'journal');
    }

    // Lightbox Trigger (Gallery)
    if (e.target.classList.contains('gallery-img')) {
        const index = parseInt(e.target.getAttribute('data-gallery-index'));
        openLightbox(index, 'gallery');
    }

    // Journal Edit (Delegated)
    const journalEditBtn = e.target.closest('.btn-edit');
    if (journalEditBtn) {
        console.log("Edit button clicked:", journalEditBtn.getAttribute('data-id'));
        openEditModal(journalEditBtn.getAttribute('data-id'));
    }

    // Journal Delete (Delegated)
    const journalDeleteBtn = e.target.closest('.btn-delete');
    if (journalDeleteBtn) {
        console.log("Delete button clicked:", journalDeleteBtn.getAttribute('data-id'));
        deleteJournalEntry(journalDeleteBtn.getAttribute('data-id'));
    }
});

lightboxEditBtn.addEventListener('click', () => {
    if (currentLightboxContext !== 'journal') return;
    const entry = photoEntries[currentPhotoIndex];
    lightbox.classList.add('hidden');
    openEditModal(entry.id);
});

lightboxDeleteBtn.addEventListener('click', async () => {
    if (currentLightboxContext !== 'journal') return;
    const entry = photoEntries[currentPhotoIndex];
    if (await showConfirm("Delete Photo", "Are you sure you want to delete this photo and its entry?")) {
        lightbox.classList.add('hidden');
        deleteJournalEntry(entry.id);
    }
});

function renderJournalItems() {
    const listContainer = document.getElementById('journal-entries-container');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (lastLoadedEntries.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center; color: #8F8B85; padding: 20px;">No journal entries yet. You can start writing whenever you’re ready.</p>';
        return;
    }

    lastLoadedEntries.forEach((entryItem) => {
        const el = document.createElement('div');
        el.className = 'journal-card-wrapper';
        el.innerHTML = `
            ${isSelectMode ? `<input type="checkbox" class="journal-checkbox" data-id="${entryItem.id}">` : ''}
            <div class="journal-card" style="flex: 1;">
                <div class="journal-meta">
                    <span>${entryItem.data.dateString} ${entryItem.timeDisplay}</span>
                    <span>${entryItem.moodEmoji} • ${entryItem.data.rating}/10</span>
                </div>
                <p>${entryItem.data.content}</p>
                ${entryItem.photoData ? `<img src="${entryItem.photoData}" alt="Journal photo" class="journal-photo" data-photo-index="${photoEntries.findIndex(p => p.id === entryItem.id)}">` : ''}
                <div class="journal-actions">
                    <button class="btn-edit" data-id="${entryItem.id}" title="Edit Entry"><i class="fas fa-edit"></i></button>
                    <button class="btn-delete" data-id="${entryItem.id}" title="Delete Entry"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `;
        listContainer.appendChild(el);
    });

    // Re-attach listeners for bulk selection only
    if (isSelectMode) {
        document.querySelectorAll('.journal-checkbox').forEach(cb => {
            cb.addEventListener('change', updateSelectedCount);
        });
    }

    // Lightbox and Action triggers are now handled by global delegation
}

// Load Journal
function loadJournal(uid) {
    const q = query(collection(db, "journal_entries"), where("uid", "==", uid), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        photoEntries = [];
        lastLoadedEntries = [];
        let totalMood = 0;
        let totalRating = 0;
        let count = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            const entryId = doc.id;
            const moodEmoji = moodEmojis[data.mood] || '😐';
            const timeDisplay = data.timeString || '';

            const entryItem = {
                id: entryId,
                data: data,
                photoData: data.photoData,
                moodEmoji: moodEmoji,
                timeDisplay: timeDisplay
            };

            lastLoadedEntries.push(entryItem);
            if (data.photoData) {
                photoEntries.push(entryItem);
            }

            // Stats
            totalMood += moodValues[data.mood] || 5;
            totalRating += data.rating || 5;
            count++;
        });

        // Update Stats UI
        const avgMoodVal = count > 0 ? totalMood / count : 0;
        const avgRating = count > 0 ? (totalRating / count).toFixed(1) : 0;

        // Calculate avg mood text
        let avgMoodText = '-';
        if (count > 0) {
            if (avgMoodVal >= 9) avgMoodText = 'Amazing 🤩';
            else if (avgMoodVal >= 8) avgMoodText = 'Happy 😊';
            else if (avgMoodVal >= 7) avgMoodText = 'Good 😄';
            else if (avgMoodVal >= 6) avgMoodText = 'Content 😌';
            else if (avgMoodVal >= 5) avgMoodText = 'Neutral 😐';
            else if (avgMoodVal >= 4) avgMoodText = 'Tired 😴';
            else if (avgMoodVal >= 3) avgMoodText = 'Sad 😢';
            else avgMoodText = 'Terrible 😭';
        }

        // Update Stats UI (Global) - Only if they exist in DOM
        const moodEl = document.getElementById('stat-mood');
        const ratingEl = document.getElementById('stat-rating');
        const entriesEl = document.getElementById('stat-entries');

        if (moodEl) moodEl.textContent = avgMoodText;
        if (ratingEl) ratingEl.textContent = `${avgRating}/10`;
        if (entriesEl) entriesEl.textContent = count;

        renderJournalItems();
    }, (error) => {
        console.error("Error loading journal:", error);
        const listContainer = document.getElementById('journal-entries-container');
        if (!listContainer) return;

        if (error.code === 'failed-precondition' || error.message.includes('index')) {
            listContainer.innerHTML = `
                <div style="padding: 20px; background: #fff3cd; border-radius: 8px; color: #856404;">
                    <strong>⚠️ Firestore Index Required</strong>
                    <p>Please create a Firestore index by clicking this link:</p>
                    <a href="${error.message.match(/https:\/\/[^\s]+/)}" target="_blank" style="color: #7A5C45; text-decoration: underline;">Create Index</a>
                    <p style="margin-top: 10px; font-size: 0.9rem;">After creating the index, wait 1-2 minutes and refresh the page.</p>
                </div>
            `;
        } else {
            listContainer.innerHTML = `<p style="text-align: center; color: #dc3545; padding: 20px;">Error loading entries. Check console for details.</p>`;
        }
    });
}

// Update Date
const todayDateEl = document.getElementById('today-date');
if (todayDateEl) {
    todayDateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// --- OVERVIEW LOGIC REFINED ---
function initOverview(uid) {
    const selector = document.getElementById('overview-month-year');
    if (!selector) return;

    selector.innerHTML = '';
    const now = new Date();

    // Last 12 months
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthYear = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const val = `${d.getFullYear()}-${d.getMonth() + 1}`;
        selector.innerHTML += `<option value="${val}">${monthYear}</option>`;
    }

    selector.addEventListener('change', () => updateOverview(uid));
}

let overviewUnsubscribe = null;

async function updateOverview(uid) {
    const selector = document.getElementById('overview-month-year');
    if (!selector) return;

    if (overviewUnsubscribe) {
        overviewUnsubscribe(); // Clean up previous listener
    }

    const selection = selector.value;
    currentOverviewSelection = selection;
    const [year, month] = selection.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    // Watch for selected month changes (Real-time!)
    const qThis = query(
        collection(db, "journal_entries"),
        where("uid", "==", uid),
        where("createdAt", ">=", startOfMonth),
        where("createdAt", "<=", endOfMonth),
        orderBy("createdAt", "asc")
    );

    overviewUnsubscribe = onSnapshot(qThis, async (snapThis) => {
        // Guard: only process if this snapshot matches the current selection
        if (selection !== currentOverviewSelection) return;

        const thisMonthData = [];
        let thisTotalRating = 0;
        let thisTotalMood = 0;
        let thisCount = 0;

        snapThis.forEach(doc => {
            const data = doc.data();
            thisMonthData.push(data);
            thisTotalRating += data.rating || 0;
            thisTotalMood += moodValues[data.mood] || 5;
            thisCount++;
        });

        // Previous month comparison
        const lastMonthStart = new Date(year, month - 2, 1, 0, 0, 0);
        const lastMonthEnd = new Date(year, month - 1, 0, 23, 59, 59);
        const qLast = query(
            collection(db, "journal_entries"),
            where("uid", "==", uid),
            where("createdAt", ">=", lastMonthStart),
            where("createdAt", "<=", lastMonthEnd)
        );

        const snapLast = await getDocs(qLast);
        const lastMonthData = snapLast.docs.map(doc => doc.data());
        const lastCount = snapLast.size;
        const uniqueDaysLast = new Set(lastMonthData.map(data => {
            const d = data.createdAt ? data.createdAt.toDate() : new Date();
            return d.toLocaleDateString('id-ID');
        })).size;
        const uniqueDaysThis = new Set(thisMonthData.map(entry => {
            const d = entry.createdAt ? entry.createdAt.toDate() : new Date();
            return d.toLocaleDateString('id-ID');
        })).size;

        document.getElementById('stat-presence').textContent = `${uniqueDaysThis} Days`;

        // Presence Comparison Line
        const diffPresence = uniqueDaysThis - uniqueDaysLast;
        const diffPresenceStr = diffPresence >= 0 ? `+${diffPresence} from last month` : `${diffPresence} dari bulan lalu`;
        const presenceDiffEl = document.getElementById('stat-presence-diff');
        if (presenceDiffEl) {
            presenceDiffEl.textContent = (uniqueDaysThis === 0 && uniqueDaysLast === 0) ? '-' : diffPresenceStr;
            presenceDiffEl.style.color = diffPresence >= 0 ? '#198754' : '#dc3545';
        }

        // Rhythm Logic (gentle & casual)
        let rhythmText = 'No data yet';

        if (uniqueDaysThis > 0) {
            if (uniqueDaysThis >= 15) {
                rhythmText = 'Your writing rhythm feels very consistent this month.';
            } else if (uniqueDaysThis >= uniqueDaysLast) {
                rhythmText = 'Your writing rhythm feels more stable this month.';
            } else {
                rhythmText = 'Your writing rhythm feels a bit slower this month.';
            }
        }


        document.getElementById('stat-rhythm').textContent = rhythmText;


        let reflectionText = 'Whenever you feel ready to write, this space will be here for you.';

        if (uniqueDaysThis > 0) {
            if (diffPresence > 0) {
                reflectionText = 'This month, you showed up for yourself a little more. Moving at your own pace is more than enough.';
            } else if (diffPresence < 0) {
                reflectionText = 'This month felt quite full. It’s okay if writing had to wait.';
            } else {
                reflectionText = 'Your writing pace stayed steady this month. Keep following your own rhythm.';
            }
        }


        document.getElementById('stat-reflection').textContent = reflectionText;

        // Avg Mood text for monthly view
        const avgMoodVal = thisCount > 0 ? thisTotalMood / thisCount : 0;
        let avgMoodText = '-';
        if (thisCount > 0) {
            if (avgMoodVal >= 9) avgMoodText = 'Amazing 🤩';
            else if (avgMoodVal >= 8) avgMoodText = 'Happy 😊';
            else if (avgMoodVal >= 7) avgMoodText = 'Good 😄';
            else if (avgMoodVal >= 6) avgMoodText = 'Calm 😌';
            else if (avgMoodVal >= 5) avgMoodText = 'Neutral 😐';
            else if (avgMoodVal >= 4) avgMoodText = 'Tired 😴';
            else if (avgMoodVal >= 3) avgMoodText = 'Sad 😢';
            else avgMoodText = 'Terrible 😭';
        }
        document.getElementById('stat-mood-monthly').textContent = avgMoodText;

        // Avg Rating for monthly view
        const avgRatingMonthly = thisCount > 0 ? (thisTotalRating / thisCount).toFixed(1) : 0;
        document.getElementById('stat-rating-monthly').textContent = thisCount > 0 ? `${avgRatingMonthly}/10` : '-';

        // Render Chart
        renderChart(thisMonthData, year, month);
    }, (error) => {
        console.error("Overview subscription error:", error);

        if (error.code === 'failed-precondition' || error.message.includes('index')) {
            const indexLink = error.message.match(/https:\/\/[^\s]+/);
            const msg = indexLink
                ? `Firestore index required. Please click this link to create the index: ${indexLink[0]}`
                : "Firestore index required. Please check Firebase console for details.";
            showAlert("Index Required", msg);
        } else {
            showAlert("Error", "Failed to load monthly overview data. Check console for details.");
        }
    });
}

function renderChart(data, year, month) {
    const ctx = document.getElementById('overview-chart').getContext('2d');
    if (overviewChart) overviewChart.destroy();

    // Group by day
    const daysInMonth = new Date(year, month, 0).getDate();
    const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const moodDailyPoints = new Array(daysInMonth).fill(null);
    const ratingDailyPoints = new Array(daysInMonth).fill(null);

    data.forEach(entry => {
        // Fallback for null createdAt (pending server timestamp)
        const date = entry.createdAt ? entry.createdAt.toDate() : new Date();
        const day = date.getDate();
        if (day <= daysInMonth) {
            moodDailyPoints[day - 1] = moodValues[entry.mood] || 5;
            ratingDailyPoints[day - 1] = entry.rating;
        }
    });

    overviewChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Daily Rating',
                    data: ratingDailyPoints,
                    borderColor: '#7A5C45', // --primary-wood
                    backgroundColor: 'rgba(122, 92, 69, 0.15)',
                    tension: 0.4,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#7A5C45',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    fill: true,
                    spanGaps: true
                },
                {
                    label: 'Daily Mood',
                    data: moodDailyPoints,
                    borderColor: '#CBB8A3', // --secondary-beige
                    borderDash: [5, 5],
                    tension: 0.4,
                    pointRadius: 2,
                    pointBackgroundColor: '#CBB8A3',
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 10,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Loading helper
function showLoading(show) {
    const loadingSpinner = document.getElementById('loading-spinner');
    if (show) {
        loadingSpinner.classList.remove('hidden');
    } else {
        loadingSpinner.classList.add('hidden');
    }
}

// --- EDIT JOURNAL MODAL ---
const editJournalModal = document.getElementById('edit-journal-modal');
const closeEditModalBtn = document.querySelector('.close-edit-modal');
const editJournalForm = document.getElementById('edit-journal-form');
const editRatingInput = document.getElementById('edit-rating-input');
const editPhotoInput = document.getElementById('edit-photo-input');
const editPhotoPreview = document.getElementById('edit-photo-preview');
const changeEditPhotoBtn = document.getElementById('change-edit-photo');
const removeEditPhotoBtn = document.getElementById('remove-edit-photo');
let currentEditEntryId = null;
let editCurrentPhotoData = null;

editRatingInput.addEventListener('input', () => {
    let value = parseFloat(editRatingInput.value);
    if (value < 0) editRatingInput.value = 0;
    if (value > 10) editRatingInput.value = 10;
});

// Photo actions in Edit Modal
changeEditPhotoBtn.addEventListener('click', () => editPhotoInput.click());

editPhotoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 500 * 1024) {
            showAlert("File Too Large", 'Photo too large! Max 500KB.');
            return;
        }
        editCurrentPhotoData = await fileToBase64(file);
        editPhotoPreview.src = editCurrentPhotoData;
        editPhotoPreview.classList.remove('hidden');
        changeEditPhotoBtn.textContent = "Change Photo"; // Update text
    }
});

removeEditPhotoBtn.addEventListener('click', () => {
    editCurrentPhotoData = null;
    editPhotoPreview.src = '';
    editPhotoPreview.classList.add('hidden');
    changeEditPhotoBtn.textContent = "Add Photo"; // Update text

});

closeEditModalBtn.addEventListener('click', () => {
    editJournalModal.classList.add('hidden');
});

// Open edit modal with data
async function openEditModal(entryId) {
    try {
        showLoading(true); // Provide immediate feedback
        const docRef = doc(db, "journal_entries", entryId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            currentEditEntryId = entryId;

            document.getElementById('edit-journal-entry').value = data.content;
            document.getElementById('edit-mood-select').value = data.mood;
            editRatingInput.value = data.rating;

            // Photo preview
            if (data.photoData) {
                editCurrentPhotoData = data.photoData;
                editPhotoPreview.src = data.photoData;
                editPhotoPreview.classList.remove('hidden');
                changeEditPhotoBtn.textContent = "Change Photo"; // Set initial text
            } else {
                editCurrentPhotoData = null;
                editPhotoPreview.src = '';
                editPhotoPreview.classList.add('hidden');
                changeEditPhotoBtn.textContent = "Add Photo"; // Set initial text
            }

            editJournalModal.classList.remove('hidden');
        }
        showLoading(false); // Hide loading after data is loaded
    } catch (error) {
        console.error("Error loading entry:", error);
        showLoading(false);
        showAlert("Error", "Failed to load entry for editing.");
    }
}

// Update journal entry
editJournalForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentEditEntryId) return;

    try {
        showLoading(true);

        const docRef = doc(db, "journal_entries", currentEditEntryId);
        const updatedData = {
            content: document.getElementById('edit-journal-entry').value,
            mood: document.getElementById('edit-mood-select').value,
            rating: parseFloat(editRatingInput.value) || 5
        };

        // Handle photo data (can be new base64 string or null if removed)
        if (editCurrentPhotoData) {
            updatedData.photoData = editCurrentPhotoData;
        } else {
            // Use deleteField() or simply remove the field if you want to completely delete it
            // For now, setting it to null or deleting the field is fine.
            // firebase's updateDoc works by merging, so we need to explicitly remove if we want it gone.
            updatedData.photoData = null;
        }

        await updateDoc(docRef, updatedData);

        editJournalModal.classList.add('hidden');
        showLoading(false);
        showAlert("Success", "Journal entry updated!");
    } catch (error) {
        console.error("Error updating entry:", error);
        showLoading(false);
        showAlert("Error", "Failed to update entry.");
    }
});

// Delete journal entry
async function deleteJournalEntry(entryId) {
    if (!await showConfirm("Delete Entry", "Are you sure you want to delete this entry?")) return;

    try {
        // Optimized: No loading spinner for simple delete to make it feel "langsung"
        const docRef = doc(db, "journal_entries", entryId);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error deleting entry:", error);
        showAlert("Error", "Gagal menghapus catatan.");
    }
}

// --- CUSTOM DIALOG SYSTEM ---
const customDialog = document.getElementById('custom-dialog');
const dialogTitle = document.getElementById('dialog-title');
const dialogMessage = document.getElementById('dialog-message');
const dialogConfirmBtn = document.getElementById('dialog-confirm');
const dialogCancelBtn = document.getElementById('dialog-cancel');

function showCustomDialog(title, message, type = 'alert') {
    return new Promise((resolve) => {
        dialogTitle.textContent = title;
        dialogMessage.textContent = message;

        if (type === 'confirm') {
            dialogCancelBtn.classList.remove('hidden');
        } else {
            dialogCancelBtn.classList.add('hidden');
        }

        customDialog.classList.remove('hidden');

        const onConfirm = () => {
            cleanup();
            resolve(true);
        };

        const onCancel = () => {
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            customDialog.classList.add('hidden');
            dialogConfirmBtn.removeEventListener('click', onConfirm);
            dialogCancelBtn.removeEventListener('click', onCancel);
        };

        dialogConfirmBtn.addEventListener('click', onConfirm);
        dialogCancelBtn.addEventListener('click', onCancel);
    });
}

const showAlert = (title, msg) => showCustomDialog(title, msg, 'alert');
const showConfirm = (title, msg) => showCustomDialog(title, msg, 'confirm');

// --- CATEGORY MANAGEMENT ---

async function loadCategories() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const catRef = doc(db, "user_settings", user.uid);
        const catSnap = await getDoc(catRef);

        if (catSnap.exists() && catSnap.data().categories) {
            categories = catSnap.data().categories;
        } else {
            // Use setDoc for initial creation
            const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            await setDoc(catRef, { categories: categories });
        }
        renderCategoryOptions();
        renderCategoryManager();
        renderFilterButtons();
    } catch (error) {
        console.error("Error loading categories:", error);
    }
}

function renderCategoryOptions() {
    const selects = [
        document.getElementById('art-category'),
        document.getElementById('edit-art-category'),
        document.getElementById('filter-category-select') // If exists
    ];

    const optionsHtml = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');

    selects.forEach(select => {
        if (select) select.innerHTML = optionsHtml;
    });
}

function renderCategoryManager() {
    const list = document.getElementById('category-list');
    if (!list) return;

    list.innerHTML = categories.map(cat => `
        <div class="category-item">
            <span>${cat}</span>
            <button class="btn-link text-delete delete-cat-btn" data-cat="${cat}"><i class="fas fa-times"></i></button>
        </div>
    `).join('');

    document.querySelectorAll('.delete-cat-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const catToDelete = btn.getAttribute('data-cat');
            const confirmed = await showConfirm("Delete Category", `Are you sure you want to delete "${catToDelete}"?`);
            if (confirmed) {
                categories = categories.filter(c => c !== catToDelete);
                await saveCategories();
            }
        });
    });
}

async function saveCategories() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const catRef = doc(db, "user_settings", user.uid);
        await updateDoc(catRef, { categories: categories });
        renderCategoryOptions();
        renderCategoryManager();
        renderFilterButtons();
        showAlert("Success", "Categories updated!");
    } catch (error) {
        console.error("Error saving categories:", error);
    }
}

const addCatBtn = document.getElementById('add-category-btn');
if (addCatBtn) {
    addCatBtn.addEventListener('click', async () => {
        const input = document.getElementById('new-category-name');
        const name = input.value.trim();
        if (name && !categories.includes(name)) {
            categories.push(name);
            input.value = '';
            await saveCategories();
        }
    });
}

const manageCatBtn = document.getElementById('manage-categories-btn');
if (manageCatBtn) {
    manageCatBtn.addEventListener('click', () => {
        const catModal = document.getElementById('category-modal');
        if (catModal) catModal.classList.remove('hidden');
    });
}

const closeCatModalBtn = document.querySelector('.close-category-modal');
if (closeCatModalBtn) {
    closeCatModalBtn.addEventListener('click', () => {
        const catModal = document.getElementById('category-modal');
        if (catModal) catModal.classList.add('hidden');
    });
}

// --- JOURNAL BULK ACTIONS ---
const bulkActionsUI = document.getElementById('journal-bulk-actions');
const toggleSelectBtn = document.getElementById('toggle-select-mode');
const selectedCountText = document.getElementById('selected-count');
const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
const cancelSelectionBtn = document.getElementById('cancel-selection-btn');

if (toggleSelectBtn) {
    toggleSelectBtn.addEventListener('click', () => {
        isSelectMode = true;
        if (bulkActionsUI) bulkActionsUI.classList.remove('hidden');
        toggleSelectBtn.style.display = 'none';
        renderJournalItems();
    });
}

if (cancelSelectionBtn) {
    cancelSelectionBtn.addEventListener('click', () => {
        isSelectMode = false;
        if (bulkActionsUI) bulkActionsUI.classList.add('hidden');
        if (toggleSelectBtn) toggleSelectBtn.style.display = 'inline-block';
        if (selectedCountText) selectedCountText.textContent = "0 items selected";
        renderJournalItems();
    });
}

function updateSelectedCount() {
    const checked = document.querySelectorAll('.journal-checkbox:checked');
    selectedCountText.textContent = `${checked.length} items selected`;
}

if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', async () => {
        const checked = document.querySelectorAll('.journal-checkbox:checked');
        if (checked.length === 0) return;

        const confirmed = await showConfirm("Bulk Delete", `Delete ${checked.length} selected entries? This action cannot be undone.`);
        if (confirmed) {
            showLoading(true);
            for (let cb of checked) {
                const entryId = cb.getAttribute('data-id');
                await deleteDoc(doc(db, "journal_entries", entryId));
            }
            showLoading(false);
            isSelectMode = false;
            if (bulkActionsUI) bulkActionsUI.classList.add('hidden');
            if (toggleSelectBtn) toggleSelectBtn.style.display = 'inline-block';
            renderJournalItems();
        }
    });
}

// --- GALLERY MANAGEMENT ---
const editGalleryModal = document.getElementById('edit-gallery-modal');
const editGalleryForm = document.getElementById('edit-gallery-form');
const editGalleryPhotoInput = document.getElementById('edit-gallery-photo-input');
const editGalleryPhotoPreview = document.getElementById('edit-gallery-photo-preview');
const changeGalleryPhotoBtn = document.getElementById('change-gallery-photo');
const removeGalleryPhotoBtn = document.getElementById('remove-gallery-photo');
let currentGalleryEditId = null;
let currentGalleryPhotoData = null;

async function openEditGalleryModal(postId) {
    try {
        const docRef = doc(db, "gallery_posts", postId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            currentGalleryEditId = postId;
            document.getElementById('edit-art-caption').value = data.caption || '';
            document.getElementById('edit-art-category').value = data.category;

            if (data.imageData) {
                currentGalleryPhotoData = data.imageData;
                editGalleryPhotoPreview.src = data.imageData;
                editGalleryPhotoPreview.classList.remove('hidden');
            } else {
                currentGalleryPhotoData = null;
                editGalleryPhotoPreview.classList.add('hidden');
            }
            editGalleryModal.classList.remove('hidden');
        }
    } catch (error) {
        console.error("Error loading post:", error);
    }
}

if (changeGalleryPhotoBtn) {
    changeGalleryPhotoBtn.addEventListener('click', () => editGalleryPhotoInput.click());
}

if (editGalleryPhotoInput) {
    editGalleryPhotoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 1024 * 1024) {
                showAlert("File Too Large", "Max 1MB allowed.");
                return;
            }
            currentGalleryPhotoData = await fileToBase64(file);
            if (editGalleryPhotoPreview) {
                editGalleryPhotoPreview.src = currentGalleryPhotoData;
                editGalleryPhotoPreview.classList.remove('hidden');
            }
        }
    });
}

if (removeGalleryPhotoBtn) {
    removeGalleryPhotoBtn.addEventListener('click', () => {
        currentGalleryPhotoData = null;
        if (editGalleryPhotoPreview) editGalleryPhotoPreview.classList.add('hidden');
    });
}

if (editGalleryForm) {
    editGalleryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentGalleryEditId) return;

        try {
            showLoading(true);
            const docRef = doc(db, "gallery_posts", currentGalleryEditId);
            await updateDoc(docRef, {
                caption: document.getElementById('edit-art-caption').value,
                category: document.getElementById('edit-art-category').value,
                imageData: currentGalleryPhotoData
            });
            if (editGalleryModal) editGalleryModal.classList.add('hidden');
            showLoading(false);
            showAlert("Success", "Artwork updated!");
        } catch (error) {
            console.error("Error updating artwork:", error);
            showLoading(false);
        }
    });
}

document.querySelector('.close-edit-gallery-modal').addEventListener('click', () => editGalleryModal.classList.add('hidden'));

async function deleteGalleryPost(postId) {
    const confirmed = await showConfirm("Delete Artwork", "Are you sure you want to delete this artwork? This action cannot be undone.");
    if (confirmed) {
        try {
            await deleteDoc(doc(db, "gallery_posts", postId));
        } catch (error) {
            console.error("Error deleting post:", error);
            showAlert("Error", "Gagal menghapus karya.");
        }
    }
}
