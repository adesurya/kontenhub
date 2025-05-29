// User-specific JavaScript functionality

$(document).ready(function() {
    initializeUserFeatures();
});

function initializeUserFeatures() {
    initializeMediaPlayer();
    initializeDownloadHandler();
    initializeSubscriptionHandler();
    initializeProfileUpload();
    initializeFilters();
}

// Media Player functionality
function initializeMediaPlayer() {
    $('.media-preview-btn').on('click', function(e) {
        e.preventDefault();
        const mediaId = $(this).data('media-id');
        const mediaType = $(this).data('media-type');
        const mediaUrl = $(this).data('media-url');
        
        openMediaModal(mediaId, mediaType, mediaUrl);
    });
}

function openMediaModal(mediaId, mediaType, mediaUrl) {
    const modal = $(`
        <div class="modal media-modal active">
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Media Preview</h3>
                    <button class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="media-player">
                        ${getMediaPlayer(mediaType, mediaUrl)}
                    </div>
                    <div class="media-actions">
                        <button class="btn btn-primary download-btn" data-media-id="${mediaId}">
                            <i class="fas fa-download"></i>
                            Download
                        </button>
                        <button class="btn btn-secondary wishlist-btn" data-media-id="${mediaId}">
                            <i class="far fa-heart"></i>
                            Add to Wishlist
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `);
    
    $('body').append(modal);
    $('body').addClass('modal-open');
    
    // Close modal handlers
    modal.find('.modal-close, .modal-backdrop').on('click', function() {
        modal.remove();
        $('body').removeClass('modal-open');
    });
}

function getMediaPlayer(mediaType, mediaUrl) {
    switch(mediaType) {
        case 'image':
            return `<img src="${mediaUrl}" alt="Preview" style="max-width: 100%; max-height: 500px;">`;
        case 'audio':
            return `<audio controls style="width: 100%;"><source src="${mediaUrl}" type="audio/mpeg"></audio>`;
        case 'video':
            return `<video controls style="width: 100%; max-height: 500px;"><source src="${mediaUrl}" type="video/mp4"></video>`;
        default:
            return `<div class="preview-placeholder"><i class="fas fa-file"></i><p>Preview not available</p></div>`;
    }
}

// Download Handler
function initializeDownloadHandler() {
    $(document).on('click', '.download-btn', function(e) {
        e.preventDefault();
        const mediaId = $(this).data('media-id');
        const btn = $(this);
        
        if (btn.hasClass('loading')) return;
        
        btn.addClass('loading');
        btn.html('<div class="spinner"></div> Generating...');
        
        $.ajax({
            url: `/api/media/download/${mediaId}`,
            method: 'GET',
            success: function(response) {
                if (response.success) {
                    // Start download
                    window.open(response.data.downloadUrl, '_blank');
                    
                    showNotification('Download started successfully!', 'success');
                    
                    // Update subscription info
                    updateSubscriptionInfo();
                } else {
                    showNotification(response.message, 'error');
                }
            },
            error: function(xhr) {
                const response = xhr.responseJSON;
                if (xhr.status === 403 && response.redirectTo) {
                    showNotification(response.message, 'warning');
                    setTimeout(() => {
                        window.location.href = response.redirectTo;
                    }, 2000);
                } else {
                    showNotification(response.message || 'Download failed', 'error');
                }
            },
            complete: function() {
                btn.removeClass('loading');
                btn.html('<i class="fas fa-download"></i> Download');
            }
        });
    });
}

// Subscription Handler
function initializeSubscriptionHandler() {
    $('.subscribe-btn').on('click', function(e) {
        e.preventDefault();
        const packageId = $(this).data('package-id');
        const packageName = $(this).data('package-name');
        const packagePrice = $(this).data('package-price');
        
        showSubscriptionModal(packageId, packageName, packagePrice);
    });
}

function showSubscriptionModal(packageId, packageName, packagePrice) {
    const modal = $(`
        <div class="modal subscription-modal active">
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Confirm Subscription</h3>
                    <button class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="subscription-details">
                        <h4>${packageName}</h4>
                        <p class="price">${formatPrice(packagePrice)}</p>
                        <div class="package-features">
                            <div class="feature-item">
                                <i class="fas fa-check"></i>
                                <span>High-quality downloads</span>
                            </div>
                            <div class="feature-item">
                                <i class="fas fa-check"></i>
                                <span>Unlimited streaming</span>
                            </div>
                            <div class="feature-item">
                                <i class="fas fa-check"></i>
                                <span>Premium support</span>
                            </div>
                        </div>
                    </div>
                    <form class="subscription-form">
                        <input type="hidden" name="package_id" value="${packageId}">
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" name="terms" required>
                                <span class="checkmark"></span>
                                I agree to the <a href="/terms" target="_blank">Terms of Service</a>
                            </label>
                        </div>
                        <button type="submit" class="btn btn-primary btn-lg w-full">
                            <i class="fas fa-credit-card"></i>
                            Proceed to Payment
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `);
    
    $('body').append(modal);
    $('body').addClass('modal-open');
    
    // Form submission
    modal.find('.subscription-form').on('submit', function(e) {
        e.preventDefault();
        processSubscription($(this).serialize());
    });
    
    // Close modal
    modal.find('.modal-close, .modal-backdrop').on('click', function() {
        modal.remove();
        $('body').removeClass('modal-open');
    });
}

function processSubscription(formData) {
    $.ajax({
        url: '/api/payment/create',
        method: 'POST',
        data: formData,
        success: function(response) {
            if (response.success && response.data.transaction.payment_url) {
                // Redirect to payment gateway
                window.location.href = response.data.transaction.payment_url;
            } else {
                showNotification('Failed to create payment', 'error');
            }
        },
        error: function(xhr) {
            const response = xhr.responseJSON;
            showNotification(response.message || 'Payment creation failed', 'error');
        }
    });
}

// Profile Upload
function initializeProfileUpload() {
    $('.avatar-upload').on('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                $('.user-avatar img').attr('src', e.target.result);
            };
            reader.readAsDataURL(file);
            
            // Upload avatar
            uploadAvatar(file);
        }
    });
}

function uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);
    
    $.ajax({
        url: '/api/user/avatar',
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            if (response.success) {
                showNotification('Avatar updated successfully', 'success');
            }
        },
        error: function() {
            showNotification('Failed to update avatar', 'error');
        }
    });
}

// Filters
function initializeFilters() {
    $('.filter-btn').on('click', function() {
        const filter = $(this).data('filter');
        const value = $(this).data('value');
        
        // Update active state
        $(this).siblings().removeClass('active');
        $(this).addClass('active');
        
        // Apply filter
        applyFilter(filter, value);
    });
    
    $('.sort-select').on('change', function() {
        const sort = $(this).val();
        applySorting(sort);
    });
}

function applyFilter(filter, value) {
    const currentUrl = new URL(window.location);
    
    if (value === 'all') {
        currentUrl.searchParams.delete(filter);
    } else {
        currentUrl.searchParams.set(filter, value);
    }
    
    currentUrl.searchParams.delete('page'); // Reset pagination
    window.location.href = currentUrl.toString();
}

function applySorting(sort) {
    const currentUrl = new URL(window.location);
    currentUrl.searchParams.set('sort', sort);
    currentUrl.searchParams.delete('page'); // Reset pagination
    window.location.href = currentUrl.toString();
}

// Utility Functions
function updateSubscriptionInfo() {
    $.ajax({
        url: '/api/auth/profile',
        method: 'GET',
        success: function(response) {
            if (response.success && response.data.user.activeSubscription) {
                const subscription = response.data.user.activeSubscription;
                $('.downloads-remaining').text(subscription.downloads_remaining);
                
                // Update progress bar if exists
                const progress = (subscription.downloads_used / (subscription.downloads_used + subscription.downloads_remaining)) * 100;
                $('.subscription-progress').css('width', progress + '%');
            }
        }
    });
}

function formatPrice(price) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR'
    }).format(price);
}

// Infinite Scroll (optional)
function initializeInfiniteScroll() {
    let loading = false;
    let page = 1;
    
    $(window).on('scroll', function() {
        if (loading) return;
        
        if ($(window).scrollTop() + $(window).height() >= $(document).height() - 100) {
            loading = true;
            page++;
            
            loadMoreMedia(page);
        }
    });
}

function loadMoreMedia(page) {
    const currentUrl = new URL(window.location);
    currentUrl.searchParams.set('page', page);
    
    $.ajax({
        url: '/api/media/search?' + currentUrl.searchParams.toString(),
        method: 'GET',
        success: function(response) {
            if (response.success && response.data.mediaFiles.length > 0) {
                appendMediaItems(response.data.mediaFiles);
            }
        },
        complete: function() {
            loading = false;
        }
    });
}

function appendMediaItems(mediaFiles) {
    const mediaGrid = $('.media-grid');
    
    mediaFiles.forEach(media => {
        const mediaCard = createMediaCard(media);
        mediaGrid.append(mediaCard);
    });
}

function createMediaCard(media) {
    return $(`
        <div class="media-card" data-media-id="${media.id}">
            <div class="media-thumbnail">
                ${media.thumbnail_url ? 
                    `<img src="${media.thumbnail_url}" alt="${media.title}">` :
                    `<div class="placeholder-icon"><i class="fas ${getFileIcon(media.file_type)}"></i></div>`
                }
                <div class="media-type-badge">${media.file_type}</div>
                <div class="media-actions">
                    <button class="media-action-btn wishlist-btn" data-media-id="${media.id}">
                        <i class="far fa-heart"></i>
                    </button>
                    <button class="media-action-btn media-preview-btn" data-media-id="${media.id}" data-media-type="${media.file_type}">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
            <div class="media-content">
                <h3 class="media-title">${media.title}</h3>
                <div class="media-meta">
                    <span><i class="fas fa-folder"></i> ${media.category.name}</span>
                    <span><i class="fas fa-download"></i> ${media.download_count}</span>
                </div>
                ${media.description ? `<p class="media-description">${media.description}</p>` : ''}
                <div class="media-footer">
                    <div class="media-tags">
                        ${media.tags ? media.tags.map(tag => `<span class="media-tag">${tag}</span>`).join('') : ''}
                    </div>
                    <button class="btn btn-primary btn-sm download-btn" data-media-id="${media.id}">
                        <i class="fas fa-download"></i>
                        Download
                    </button>
                </div>
            </div>
        </div>
    `);
}