// Admin-specific JavaScript functionality

$(document).ready(function() {
    initializeAdminFeatures();
});

function initializeAdminFeatures() {
    initializeDataTables();
    initializeMediaUpload();
    initializeBulkActions();
    initializeUserManagement();
    initializeAnalytics();
    initializeFormModals();
}

// DataTables for admin lists
function initializeDataTables() {
    // Users table
    if ($('#usersTable').length) {
        $('#usersTable').DataTable({
            responsive: true,
            processing: true,
            serverSide: true,
            ajax: {
                url: '/api/admin/users',
                type: 'GET',
                data: function(d) {
                    return {
                        page: Math.floor(d.start / d.length) + 1,
                        limit: d.length,
                        search: d.search.value,
                        sort: d.columns[d.order[0].column].data,
                        order: d.order[0].dir.toUpperCase()
                    };
                },
                dataSrc: function(json) {
                    json.recordsTotal = json.data.pagination.totalItems;
                    json.recordsFiltered = json.data.pagination.totalItems;
                    return json.data.users;
                }
            },
            columns: [
                { data: 'id' },
                { data: 'full_name' },
                { data: 'email' },
                { data: 'role' },
                { 
                    data: 'is_active',
                    render: function(data) {
                        return data ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>';
                    }
                },
                { 
                    data: 'created_at',
                    render: function(data) {
                        return moment(data).format('DD/MM/YYYY');
                    }
                },
                {
                    data: null,
                    orderable: false,
                    render: function(data) {
                        return `
                            <div class="action-buttons">
                                <button class="btn btn-sm btn-secondary edit-user-btn" data-user-id="${data.id}">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-danger delete-user-btn" data-user-id="${data.id}">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        `;
                    }
                }
            ],
            order: [[0, 'desc']],
            pageLength: 25,
            dom: '<"top"lf>rt<"bottom"ip><"clear">'
        });
    }
    
    // Media table
    if ($('#mediaTable').length) {
        $('#mediaTable').DataTable({
            responsive: true,
            processing: true,
            serverSide: true,
            ajax: {
                url: '/api/media/list',
                type: 'GET',
                data: function(d) {
                    return {
                        page: Math.floor(d.start / d.length) + 1,
                        limit: d.length,
                        search: d.search.value,
                        sort: d.columns[d.order[0].column].data,
                        order: d.order[0].dir.toUpperCase()
                    };
                }
            },
            columns: [
                { 
                    data: 'thumbnail_url',
                    orderable: false,
                    render: function(data, type, row) {
                        if (data) {
                            return `<img src="${data}" alt="${row.title}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">`;
                        } else {
                            return `<div class="file-icon"><i class="fas ${getFileIcon(row.file_type)}"></i></div>`;
                        }
                    }
                },
                { data: 'title' },
                { data: 'category.name' },
                { data: 'file_type' },
                { 
                    data: 'file_size',
                    render: function(data) {
                        return formatFileSize(data);
                    }
                },
                { data: 'download_count' },
                { 
                    data: 'is_active',
                    render: function(data) {
                        return data ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>';
                    }
                },
                {
                    data: null,
                    orderable: false,
                    render: function(data) {
                        return `
                            <div class="action-buttons">
                                <button class="btn btn-sm btn-secondary edit-media-btn" data-media-id="${data.id}">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-danger delete-media-btn" data-media-id="${data.id}">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        `;
                    }
                }
            ],
            order: [[1, 'desc']],
            pageLength: 25
        });
    }
}

// Media Upload with drag & drop
function initializeMediaUpload() {
    const uploadArea = $('.file-upload-area');
    const fileInput = $('#mediaFile');
    const previewContainer = $('.upload-preview');
    const uploadForm = $('#mediaUploadForm');
    
    // Drag & Drop
    uploadArea.on('dragover dragenter', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).addClass('drag-over');
    });
    
    uploadArea.on('dragleave dragend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('drag-over');
    });
    
    uploadArea.on('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('drag-over');
        
        const files = e.originalEvent.dataTransfer.files;
        handleFileSelection(files);
    });
    
    // File input change
    fileInput.on('change', function() {
        handleFileSelection(this.files);
    });
    
    function handleFileSelection(files) {
        if (files.length > 0) {
            const file = files[0];
            
            // Validate file
            if (!validateFile(file)) return;
            
            // Show preview
            showFilePreview(file);
            
            // Enable form
            uploadForm.find('.upload-details').show();
            uploadForm.find('.submit-btn').prop('disabled', false);
        }
    }
    
    function validateFile(file) {
        const maxSize = 100 * 1024 * 1024; // 100MB
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac',
            'video/mp4', 'video/quicktime', 'video/x-msvideo'
        ];
        
        if (file.size > maxSize) {
            showNotification('File size exceeds 100MB limit', 'error');
            return false;
        }
        
        if (!allowedTypes.includes(file.type)) {
            showNotification('File type not supported', 'error');
            return false;
        }
        
        return true;
    }
    
    function showFilePreview(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            let preview = '';
            
            if (file.type.startsWith('image/')) {
                preview = `<img src="${e.target.result}" alt="Preview">`;
            } else if (file.type.startsWith('audio/')) {
                preview = `<audio controls><source src="${e.target.result}"></audio>`;
            } else if (file.type.startsWith('video/')) {
                preview = `<video controls width="300"><source src="${e.target.result}"></video>`;
            }
            
            previewContainer.html(`
                <div class="file-preview-item">
                    <div class="preview-content">${preview}</div>
                    <div class="file-info">
                        <h4>${file.name}</h4>
                        <p>${formatFileSize(file.size)}</p>
                    </div>
                </div>
            `).show();
        };
        reader.readAsDataURL(file);
    }
    
    // Form submission with progress
    uploadForm.on('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        const submitBtn = $(this).find('.submit-btn');
        const progressBar = $('.upload-progress');
        
        submitBtn.prop('disabled', true).html('<div class="spinner"></div> Uploading...');
        progressBar.show();
        
        $.ajax({
            url: '/api/media/upload',
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            xhr: function() {
                const xhr = new window.XMLHttpRequest();
                xhr.upload.addEventListener('progress', function(e) {
                    if (e.lengthComputable) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        progressBar.find('.progress-fill').css('width', percentComplete + '%');
                        progressBar.find('.progress-text').text(Math.round(percentComplete) + '%');
                    }
                });
                return xhr;
            },
            success: function(response) {
                if (response.success) {
                    showNotification('Media uploaded successfully!', 'success');
                    setTimeout(() => {
                        window.location.href = '/admin/media/list';
                    }, 1500);
                } else {
                    showNotification(response.message || 'Upload failed', 'error');
                }
            },
            error: function(xhr) {
                const response = xhr.responseJSON;
                showNotification(response.message || 'Upload failed', 'error');
            },
            complete: function() {
                submitBtn.prop('disabled', false).html('<i class="fas fa-upload"></i> Upload Media');
                progressBar.hide();
            }
        });
    });
}

// Bulk Actions
function initializeBulkActions() {
    // Select all checkbox
    $('.select-all').on('change', function() {
        const isChecked = $(this).is(':checked');
        $('.item-checkbox').prop('checked', isChecked);
        updateBulkActions();
    });
    
    // Individual checkboxes
    $(document).on('change', '.item-checkbox', function() {
        updateBulkActions();
    });
    
    // Bulk action buttons
    $('.bulk-delete').on('click', function() {
        const selectedIds = getSelectedIds();
        if (selectedIds.length === 0) {
            showNotification('Please select items to delete', 'warning');
            return;
        }
        
        if (confirm(`Are you sure you want to delete ${selectedIds.length} item(s)?`)) {
            bulkDelete(selectedIds);
        }
    });
    
    $('.bulk-activate').on('click', function() {
        const selectedIds = getSelectedIds();
        if (selectedIds.length === 0) {
            showNotification('Please select items to activate', 'warning');
            return;
        }
        
        bulkUpdateStatus(selectedIds, true);
    });
    
    $('.bulk-deactivate').on('click', function() {
        const selectedIds = getSelectedIds();
        if (selectedIds.length === 0) {
            showNotification('Please select items to deactivate', 'warning');
            return;
        }
        
        bulkUpdateStatus(selectedIds, false);
    });
    
    function updateBulkActions() {
        const selectedCount = $('.item-checkbox:checked').length;
        const bulkActions = $('.bulk-actions');
        
        if (selectedCount > 0) {
            bulkActions.show();
            bulkActions.find('.selected-count').text(selectedCount);
        } else {
            bulkActions.hide();
        }
    }
    
    function getSelectedIds() {
        return $('.item-checkbox:checked').map(function() {
            return $(this).val();
        }).get();
    }
    
    function bulkDelete(ids) {
        // Implementation depends on the current page (users, media, etc.)
        const currentPath = window.location.pathname;
        let endpoint = '';
        
        if (currentPath.includes('users')) {
            endpoint = '/api/admin/users/bulk';
        } else if (currentPath.includes('media')) {
            endpoint = '/api/media/bulk';
        }
        
        $.ajax({
            url: endpoint,
            method: 'DELETE',
            data: { ids: ids },
            success: function(response) {
                if (response.success) {
                    showNotification(`${ids.length} item(s) deleted successfully`, 'success');
                    location.reload();
                }
            },
            error: function(xhr) {
                const response = xhr.responseJSON;
                showNotification(response.message || 'Bulk delete failed', 'error');
            }
        });
    }
    
    function bulkUpdateStatus(ids, isActive) {
        const endpoint = window.location.pathname.includes('users') ? 
            '/api/admin/users/bulk-status' : '/api/media/bulk-status';
        
        $.ajax({
            url: endpoint,
            method: 'PUT',
            data: { ids: ids, is_active: isActive },
            success: function(response) {
                if (response.success) {
                    const action = isActive ? 'activated' : 'deactivated';
                    showNotification(`${ids.length} item(s) ${action} successfully`, 'success');
                    location.reload();
                }
            },
            error: function(xhr) {
                const response = xhr.responseJSON;
                showNotification(response.message || 'Bulk update failed', 'error');
            }
        });
    }
}

// User Management
function initializeUserManagement() {
    // Edit user
    $(document).on('click', '.edit-user-btn', function() {
        const userId = $(this).data('user-id');
        openUserEditModal(userId);
    });
    
    // Delete user
    $(document).on('click', '.delete-user-btn', function() {
        const userId = $(this).data('user-id');
        const userName = $(this).closest('tr').find('td:nth-child(2)').text();
        
        if (confirm(`Are you sure you want to delete user "${userName}"?`)) {
            deleteUser(userId);
        }
    });
    
    function openUserEditModal(userId) {
        $.ajax({
            url: `/api/admin/users/${userId}`,
            method: 'GET',
            success: function(response) {
                if (response.success) {
                    const user = response.data.user;
                    showUserEditForm(user);
                }
            },
            error: function() {
                showNotification('Failed to load user data', 'error');
            }
        });
    }
    
    function showUserEditForm(user) {
        const modal = $(`
            <div class="modal user-edit-modal active">
                <div class="modal-backdrop"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Edit User</h3>
                        <button class="modal-close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form class="user-edit-form">
                            <input type="hidden" name="user_id" value="${user.id}">
                            
                            <div class="form-group">
                                <label class="form-label">Email</label>
                                <input type="email" name="email" class="form-input" value="${user.email}" required>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">Role</label>
                                <select name="role" class="form-select">
                                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" name="is_active" ${user.is_active ? 'checked' : ''}>
                                    <span class="checkmark"></span>
                                    Active
                                </label>
                            </div>
                            
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary modal-close">Cancel</button>
                                <button type="submit" class="btn btn-primary">Update User</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `);
        
        $('body').append(modal);
        $('body').addClass('modal-open');
        
        // Form submission
        modal.find('.user-edit-form').on('submit', function(e) {
            e.preventDefault();
            updateUser($(this).serialize());
        });
        
        // Close modal
        modal.find('.modal-close, .modal-backdrop').on('click', function() {
            modal.remove();
            $('body').removeClass('modal-open');
        });
    }
    
    function updateUser(formData) {
        const userId = new URLSearchParams(formData).get('user_id');
        
        $.ajax({
            url: `/api/admin/users/${userId}`,
            method: 'PUT',
            data: formData,
            success: function(response) {
                if (response.success) {
                    showNotification('User updated successfully', 'success');
                    $('.user-edit-modal').remove();
                    $('body').removeClass('modal-open');
                    $('#usersTable').DataTable().ajax.reload();
                }
            },
            error: function(xhr) {
                const response = xhr.responseJSON;
                showNotification(response.message || 'Update failed', 'error');
            }
        });
    }
    
    function deleteUser(userId) {
        $.ajax({
            url: `/api/admin/users/${userId}`,
            method: 'DELETE',
            success: function(response) {
                if (response.success) {
                    showNotification('User deleted successfully', 'success');
                    $('#usersTable').DataTable().ajax.reload();
                }
            },
            error: function(xhr) {
                const response = xhr.responseJSON;
                showNotification(response.message || 'Delete failed', 'error');
            }
        });
    }
}

// Analytics Dashboard
function initializeAnalytics() {
    // Real-time stats updates
    if ($('.stats-grid').length) {
        updateStatsInRealTime();
        setInterval(updateStatsInRealTime, 30000); // Update every 30 seconds
    }
    
    // Initialize charts
    initializeCharts();
}

function updateStatsInRealTime() {
    $.ajax({
        url: '/api/admin/stats/realtime',
        method: 'GET',
        success: function(response) {
            if (response.success) {
                const stats = response.data;
                
                // Update stat cards with animation
                animateStatValue('.total-users .stat-value', stats.totalUsers);
                animateStatValue('.total-media .stat-value', stats.totalMedia);
                animateStatValue('.total-transactions .stat-value', stats.totalTransactions);
                animateStatValue('.active-subscriptions .stat-value', stats.activeSubscriptions);
            }
        }
    });
}

function animateStatValue(selector, newValue) {
    const element = $(selector);
    const currentValue = parseInt(element.text()) || 0;
    
    if (currentValue !== newValue) {
        $({ counter: currentValue }).animate({
            counter: newValue
        }, {
            duration: 1000,
            step: function() {
                element.text(Math.ceil(this.counter));
            }
        });
    }
}

function initializeCharts() {
    // Revenue chart
    if ($('#revenueChart').length) {
        const ctx = document.getElementById('revenueChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Revenue',
                    data: [12000, 19000, 15000, 25000, 22000, 30000],
                    borderColor: '#fe2c55',
                    backgroundColor: 'rgba(254, 44, 85, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
    
    // User growth chart
    if ($('#userGrowthChart').length) {
        const ctx = document.getElementById('userGrowthChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [{
                    label: 'New Users',
                    data: [65, 78, 90, 81],
                    backgroundColor: '#25f4ee'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
}

// Form Modals
function initializeFormModals() {
    // Category form modal
    $('#addCategoryBtn').on('click', function() {
        showCategoryModal();
    });
    
    // Package form modal
    $('#addPackageBtn').on('click', function() {
        showPackageModal();
    });
}

function showCategoryModal(category = null) {
    const isEdit = category !== null;
    const title = isEdit ? 'Edit Category' : 'Add Category';
    
    const modal = $(`
        <div class="modal category-modal active">
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form class="category-form">
                        ${isEdit ? `<input type="hidden" name="category_id" value="${category.id}">` : ''}
                        
                        <div class="form-group">
                            <label class="form-label">Name</label>
                            <input type="text" name="name" class="form-input" value="${isEdit ? category.name : ''}" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea name="description" class="form-textarea">${isEdit ? category.description || '' : ''}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Icon (Font Awesome class)</label>
                            <input type="text" name="icon" class="form-input" value="${isEdit ? category.icon : 'fas fa-folder'}" placeholder="fas fa-folder">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Color</label>
                            <input type="color" name="color" class="form-input" value="${isEdit ? category.color : '#6B7280'}">
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary modal-close">Cancel</button>
                            <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Create'} Category</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `);
    
    $('body').append(modal);
    $('body').addClass('modal-open');
    
    // Form submission
    modal.find('.category-form').on('submit', function(e) {
        e.preventDefault();
        saveCategoryForm($(this).serialize(), isEdit);
    });
    
    // Close modal
    modal.find('.modal-close, .modal-backdrop').on('click', function() {
        modal.remove();
        $('body').removeClass('modal-open');
    });
}

function saveCategoryForm(formData, isEdit) {
    const url = isEdit ? '/api/admin/categories/' + new URLSearchParams(formData).get('category_id') : '/api/admin/categories';
    const method = isEdit ? 'PUT' : 'POST';
    
    $.ajax({
        url: url,
        method: method,
        data: formData,
        success: function(response) {
            if (response.success) {
                showNotification(`Category ${isEdit ? 'updated' : 'created'} successfully`, 'success');
                $('.category-modal').remove();
                $('body').removeClass('modal-open');
                location.reload(); // Refresh the page to show new category
            }
        },
        error: function(xhr) {
            const response = xhr.responseJSON;
            showNotification(response.message || 'Operation failed', 'error');
        }
    });
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(fileType) {
    const iconMap = {
        'image': 'fa-image',
        'audio': 'fa-music',
        'video': 'fa-video'
    };
    return iconMap[fileType] || 'fa-file';
}form-label">Full Name</label>
                                <input type="text" name="full_name" class="form-input" value="${user.full_name}" required>
                            </div>
                            
                            <div class="form-group">
                                <label class="