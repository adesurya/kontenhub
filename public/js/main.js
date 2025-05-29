// Main JavaScript file for Media Management App

$(document).ready(function() {
    // Initialize application
    initializeApp();
});

function initializeApp() {
    // Mobile menu toggle
    initializeMobileMenu();
    
    // User dropdown
    initializeUserDropdown();
    
    // Flash messages
    initializeFlashMessages();
    
    // Form enhancements
    initializeForms();
    
    // File upload
    initializeFileUpload();
    
    // Search functionality
    initializeSearch();
    
    // Wishlist functionality
    initializeWishlist();
    
    // Pagination
    initializePagination();
    
    // Loading states
    initializeLoadingStates();
    
    // Tooltips and modals
    initializeTooltips();
    
    // Image lazy loading
    initializeLazyLoading();
    
    // Keyboard shortcuts
    initializeKeyboardShortcuts();
}

// Mobile Menu
function initializeMobileMenu() {
    const mobileToggle = $('#mobileMenuToggle');
    const navbarMenu = $('#navbarMenu');
    
    mobileToggle.on('click', function() {
        navbarMenu.toggleClass('active');
        $(this).toggleClass('active');
        
        // Toggle hamburger animation
        const spans = $(this).find('span');
        if ($(this).hasClass('active')) {
            spans.eq(0).css('transform', 'rotate(45deg) translate(5px, 5px)');
            spans.eq(1).css('opacity', '0');
            spans.eq(2).css('transform', 'rotate(-45deg) translate(7px, -6px)');
        } else {
            spans.css({
                'transform': 'none',
                'opacity': '1'
            });
        }
    });
    
    // Close mobile menu when clicking outside
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.navbar').length) {
            navbarMenu.removeClass('active');
            mobileToggle.removeClass('active');
            mobileToggle.find('span').css({
                'transform': 'none',
                'opacity': '1'
            });
        }
    });
}

// User Dropdown
function initializeUserDropdown() {
    const dropdownToggle = $('#userDropdownToggle');
    const dropdownMenu = $('#userDropdownMenu');
    const dropdown = $('.user-dropdown');
    
    dropdownToggle.on('click', function(e) {
        e.stopPropagation();
        dropdown.toggleClass('active');
    });
    
    // Close dropdown when clicking outside
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.user-dropdown').length) {
            dropdown.removeClass('active');
        }
    });
    
    // Close dropdown when pressing escape
    $(document).on('keydown', function(e) {
        if (e.key === 'Escape') {
            dropdown.removeClass('active');
        }
    });
}

// Flash Messages
function initializeFlashMessages() {
    // Auto-hide flash messages after 5 seconds
    setTimeout(function() {
        $('.flash-message').fadeOut(500, function() {
            $(this).remove();
        });
    }, 5000);
    
    // Manual close button
    $('.flash-close').on('click', function() {
        $(this).closest('.flash-message').fadeOut(300, function() {
            $(this).remove();
        });
    });
}

// Form Enhancements
function initializeForms() {
    // Form validation
    $('form').on('submit', function(e) {
        const form = $(this);
        let isValid = true;
        
        // Clear previous error states
        form.find('.form-input, .form-select, .form-textarea').removeClass('error');
        form.find('.error-message').remove();
        
        // Validate required fields
        form.find('[required]').each(function() {
            const field = $(this);
            const value = field.val().trim();
            
            if (!value) {
                field.addClass('error');
                field.after('<div class="error-message">This field is required</div>');
                isValid = false;
            }
        });
        
        // Validate email fields
        form.find('input[type="email"]').each(function() {
            const field = $(this);
            const value = field.val().trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (value && !emailRegex.test(value)) {
                field.addClass('error');
                field.after('<div class="error-message">Please enter a valid email address</div>');
                isValid = false;
            }
        });
        
        // Validate password confirmation
        const password = form.find('input[name="password"]');
        const confirmPassword = form.find('input[name="confirm_password"]');
        
        if (password.length && confirmPassword.length) {
            if (password.val() !== confirmPassword.val()) {
                confirmPassword.addClass('error');
                confirmPassword.after('<div class="error-message">Passwords do not match</div>');
                isValid = false;
            }
        }
        
        if (!isValid) {
            e.preventDefault();
            // Scroll to first error
            const firstError = form.find('.error').first();
            if (firstError.length) {
                $('html, body').animate({
                    scrollTop: firstError.offset().top - 100
                }, 300);
            }
        }
    });
    
    // Real-time validation
    $('.form-input, .form-select, .form-textarea').on('blur', function() {
        const field = $(this);
        field.removeClass('error');
        field.siblings('.error-message').remove();
        
        if (field.prop('required') && !field.val().trim()) {
            field.addClass('error');
            field.after('<div class="error-message">This field is required</div>');
        }
    });
    
    // Password strength indicator
    $('input[name="password"]').on('input', function() {
        const password = $(this).val();
        const strengthIndicator = $(this).siblings('.password-strength');
        
        if (strengthIndicator.length === 0) {
            $(this).after('<div class="password-strength"><div class="strength-bar"></div><div class="strength-text"></div></div>');
        }
        
        const strength = calculatePasswordStrength(password);
        const strengthBar = $(this).siblings('.password-strength').find('.strength-bar');
        const strengthText = $(this).siblings('.password-strength').find('.strength-text');
        
        strengthBar.removeClass('weak medium strong').addClass(strength.class);
        strengthBar.css('width', strength.percentage + '%');
        strengthText.text(strength.text);
    });
}

// File Upload
function initializeFileUpload() {
    // Drag and drop functionality
    $('.file-upload-area').on('dragover dragenter', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).addClass('drag-over');
    });
    
    $('.file-upload-area').on('dragleave dragend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('drag-over');
    });
    
    $('.file-upload-area').on('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('drag-over');
        
        const files = e.originalEvent.dataTransfer.files;
        handleFileSelection(files, $(this));
    });
    
    // File input change
    $('.file-input').on('change', function() {
        const files = this.files;
        const uploadArea = $(this).closest('.file-upload-area');
        handleFileSelection(files, uploadArea);
    });
    
    // Preview uploaded files
    function handleFileSelection(files, uploadArea) {
        const previewContainer = uploadArea.find('.file-preview');
        previewContainer.empty();
        
        Array.from(files).forEach(file => {
            const fileItem = createFilePreview(file);
            previewContainer.append(fileItem);
        });
        
        if (files.length > 0) {
            uploadArea.addClass('has-files');
        }
    }
    
    function createFilePreview(file) {
        const fileItem = $(`
            <div class="file-preview-item">
                <div class="file-icon">
                    <i class="fas ${getFileIcon(file.type)}"></i>
                </div>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${formatFileSize(file.size)}</div>
                </div>
                <button type="button" class="file-remove">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `);
        
        // Remove file functionality
        fileItem.find('.file-remove').on('click', function() {
            fileItem.remove();
            // Update file input if needed
        });
        
        // Show image preview
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                fileItem.find('.file-icon').html(`<img src="${e.target.result}" alt="Preview">`);
            };
            reader.readAsDataURL(file);
        }
        
        return fileItem;
    }
}

// Search Functionality
function initializeSearch() {
    const searchInput = $('.search-input');
    const searchSuggestions = $('.search-suggestions');
    let searchTimeout;
    
    searchInput.on('input', function() {
        const query = $(this).val().trim();
        
        clearTimeout(searchTimeout);
        
        if (query.length >= 2) {
            searchTimeout = setTimeout(() => {
                performSearch(query);
            }, 300);
        } else {
            searchSuggestions.hide();
        }
    });
    
    function performSearch(query) {
        $.ajax({
            url: '/api/media/search',
            method: 'GET',
            data: { q: query, limit: 5 },
            success: function(response) {
                if (response.success && response.data.mediaFiles.length > 0) {
                    displaySearchSuggestions(response.data.mediaFiles);
                } else {
                    searchSuggestions.hide();
                }
            },
            error: function() {
                searchSuggestions.hide();
            }
        });
    }
    
    function displaySearchSuggestions(mediaFiles) {
        const suggestionsList = mediaFiles.map(media => `
            <a href="/media/${media.id}" class="search-suggestion-item">
                <div class="suggestion-thumbnail">
                    ${media.thumbnail_url ? 
                        `<img src="${media.thumbnail_url}" alt="${media.title}">` :
                        `<i class="fas ${getFileIcon(media.file_type)}"></i>`
                    }
                </div>
                <div class="suggestion-info">
                    <div class="suggestion-title">${media.title}</div>
                    <div class="suggestion-meta">${media.category.name} • ${media.file_type}</div>
                </div>
            </a>
        `).join('');
        
        searchSuggestions.html(suggestionsList).show();
    }
    
    // Hide suggestions when clicking outside
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.search-container').length) {
            searchSuggestions.hide();
        }
    });
}

// Wishlist Functionality
function initializeWishlist() {
    $('.wishlist-btn').on('click', function(e) {
        e.preventDefault();
        const btn = $(this);
        const mediaId = btn.data('media-id');
        const isInWishlist = btn.hasClass('in-wishlist');
        
        // Prevent double clicks
        if (btn.hasClass('loading')) return;
        
        btn.addClass('loading');
        
        const url = isInWishlist ? 
            `/api/user/wishlist/${mediaId}` : 
            '/api/user/wishlist';
        
        const method = isInWishlist ? 'DELETE' : 'POST';
        const data = isInWishlist ? {} : { media_id: mediaId };
        
        $.ajax({
            url: url,
            method: method,
            data: data,
            success: function(response) {
                if (response.success) {
                    btn.toggleClass('in-wishlist');
                    btn.find('i').toggleClass('fas far');
                    
                    // Update button text
                    const text = btn.find('.btn-text');
                    if (text.length) {
                        text.text(isInWishlist ? 'Add to Wishlist' : 'Remove from Wishlist');
                    }
                    
                    // Show success message
                    showNotification(response.message, 'success');
                    
                    // Update wishlist count in navbar
                    updateWishlistCount(isInWishlist ? -1 : 1);
                }
            },
            error: function(xhr) {
                const response = xhr.responseJSON;
                showNotification(response.message || 'An error occurred', 'error');
            },
            complete: function() {
                btn.removeClass('loading');
            }
        });
    });
}

// Pagination
function initializePagination() {
    $('.pagination-btn').on('click', function(e) {
        e.preventDefault();
        
        if ($(this).hasClass('active') || $(this).hasClass('disabled')) {
            return;
        }
        
        const url = $(this).attr('href');
        if (url) {
            showLoadingOverlay();
            window.location.href = url;
        }
    });
}

// Loading States
function initializeLoadingStates() {
    // Add loading state to forms
    $('form').on('submit', function() {
        const submitBtn = $(this).find('button[type="submit"]');
        if (submitBtn.length) {
            submitBtn.prop('disabled', true);
            submitBtn.html('<div class="spinner"></div> Processing...');
        }
        showLoadingOverlay();
    });
    
    // Add loading state to important links
    $('a[data-loading="true"]').on('click', function() {
        showLoadingOverlay();
    });
}

// Tooltips and Modals
function initializeTooltips() {
    // Simple tooltip implementation
    $('[data-tooltip]').hover(
        function() {
            const tooltip = $('<div class="tooltip">' + $(this).data('tooltip') + '</div>');
            $('body').append(tooltip);
            
            const offset = $(this).offset();
            tooltip.css({
                top: offset.top - tooltip.outerHeight() - 10,
                left: offset.left + ($(this).outerWidth() / 2) - (tooltip.outerWidth() / 2)
            });
        },
        function() {
            $('.tooltip').remove();
        }
    );
    
    // Modal functionality
    $('[data-modal]').on('click', function(e) {
        e.preventDefault();
        const modalId = $(this).data('modal');
        showModal(modalId);
    });
    
    $('.modal-close, .modal-backdrop').on('click', function() {
        hideModal();
    });
    
    // Close modal on escape key
    $(document).on('keydown', function(e) {
        if (e.key === 'Escape') {
            hideModal();
        }
    });
}

// Image Lazy Loading
function initializeLazyLoading() {
    const images = $('img[data-src]');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    imageObserver.unobserve(img);
                }
            });
        });
        
        images.each(function() {
            imageObserver.observe(this);
        });
    } else {
        // Fallback for older browsers
        images.each(function() {
            this.src = this.dataset.src;
        });
    }
}

// Keyboard Shortcuts
function initializeKeyboardShortcuts() {
    $(document).on('keydown', function(e) {
        // Ctrl/Cmd + K for search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            $('.search-input').focus();
        }
        
        // Escape to close modals/dropdowns
        if (e.key === 'Escape') {
            hideModal();
            $('.user-dropdown').removeClass('active');
            $('.search-suggestions').hide();
        }
    });
}

// Utility Functions

function showLoadingOverlay() {
    $('#loading-overlay').removeClass('hidden');
}

function hideLoadingOverlay() {
    $('#loading-overlay').addClass('hidden');
}

function showNotification(message, type = 'info') {
    const notification = $(`
        <div class="flash-message flash-${type}">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="flash-close">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `);
    
    const container = $('.flash-messages');
    if (container.length === 0) {
        $('body').append('<div class="flash-messages"></div>');
    }
    
    $('.flash-messages').append(notification);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        notification.fadeOut(300, function() {
            $(this).remove();
        });
    }, 5000);
    
    // Manual close
    notification.find('.flash-close').on('click', function() {
        notification.fadeOut(300, function() {
            $(this).remove();
        });
    });
}

function showModal(modalId) {
    const modal = $(`#${modalId}`);
    if (modal.length) {
        modal.addClass('active');
        $('body').addClass('modal-open');
    }
}

function hideModal() {
    $('.modal').removeClass('active');
    $('body').removeClass('modal-open');
}

function updateWishlistCount(delta) {
    const countElement = $('.wishlist-count');
    if (countElement.length) {
        const currentCount = parseInt(countElement.text()) || 0;
        const newCount = Math.max(0, currentCount + delta);
        countElement.text(newCount);
        
        if (newCount === 0) {
            countElement.hide();
        } else {
            countElement.show();
        }
    }
}

function getFileIcon(fileType) {
    const iconMap = {
        'image': 'fa-image',
        'audio': 'fa-music',
        'video': 'fa-video',
        'application/pdf': 'fa-file-pdf',
        'application/zip': 'fa-file-archive',
        'text': 'fa-file-alt'
    };
    
    for (const [type, icon] of Object.entries(iconMap)) {
        if (fileType.includes(type)) {
            return icon;
        }
    }
    
    return 'fa-file';
}

function getNotificationIcon(type) {
    const iconMap = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    };
    
    return iconMap[type] || 'fa-info-circle';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function calculatePasswordStrength(password) {
    let score = 0;
    
    // Length check
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    
    // Character type checks
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    
    // Pattern checks
    if (!/(.)\1{2,}/.test(password)) score += 1; // No repeated characters
    if (!/012|123|234|345|456|567|678|789|890|abc|bcd|cde/.test(password.toLowerCase())) score += 1;
    
    if (score < 3) {
        return { class: 'weak', percentage: 25, text: 'Weak' };
    } else if (score < 6) {
        return { class: 'medium', percentage: 60, text: 'Medium' };
    } else {
        return { class: 'strong', percentage: 100, text: 'Strong' };
    }
}

// AJAX Setup
$.ajaxSetup({
    beforeSend: function(xhr, settings) {
        // Add CSRF token if available
        const csrfToken = $('meta[name="csrf-token"]').attr('content');
        if (csrfToken) {
            xhr.setRequestHeader('X-CSRF-TOKEN', csrfToken);
        }
        
        // Add auth token if available
        const authToken = localStorage.getItem('auth_token');
        if (authToken) {
            xhr.setRequestHeader('Authorization', 'Bearer ' + authToken);
        }
    }
});

// Global error handler
$(document).ajaxError(function(event, xhr, settings) {
    if (xhr.status === 401) {
        // Unauthorized - redirect to login
        window.location.href = '/login';
    } else if (xhr.status === 403) {
        showNotification('Access denied', 'error');
    } else if (xhr.status >= 500) {
        showNotification('Server error occurred', 'error');
    }
});

// Performance monitoring
if ('performance' in window) {
    window.addEventListener('load', function() {
        setTimeout(function() {
            const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
            console.log('Page load time:', loadTime + 'ms');
            
            // Send performance data to analytics if needed
            if (loadTime > 3000) {
                console.warn('Slow page load detected');
            }
        }, 0);
    });
}

// Service Worker registration (for PWA features)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful');
            })
            .catch(function(err) {
                console.log('ServiceWorker registration failed');
            });
    });
}