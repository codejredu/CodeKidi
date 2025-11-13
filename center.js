/**
 * @fileoverview Sprite Center Editor module for the KidiCode application.
 * Encapsulates all UI and logic for editing a sprite's center point in a modal window.
 */

export class SpriteCenterEditor {
    constructor({ getActiveSprite, updateSpriteCenter }) {
        // Dependencies from main app
        this.getActiveSprite = getActiveSprite;
        this.updateSpriteCenter = updateSpriteCenter;

        // DOM Elements
        this.modal = document.getElementById('center-editor-modal');
        this.previewContainer = document.getElementById('center-editor-preview');
        this.saveButton = document.getElementById('center-editor-save-btn');
        this.cancelButton = document.getElementById('center-editor-cancel-btn');
        this.editButton = document.getElementById('prop-center-edit-btn');
        
        // State
        this.activeSprite = null;
        this.tempCenterX = 0.5;
        this.tempCenterY = 0.5;
        this.marker = null;
        this.previewImage = null;
    }

    init() {
        if (!this.modal || !this.editButton) {
            console.error('Sprite Center Editor modal elements not found in HTML.');
            return;
        }

        // Bind event handlers
        this.editButton.addEventListener('click', () => this.open());
        this.saveButton.addEventListener('click', () => this.save());
        this.cancelButton.addEventListener('click', () => this.close());
        this.previewContainer.addEventListener('click', (e) => this.handlePreviewClick(e));
        
        // Create marker element and add it to the preview container
        this.marker = document.createElement('div');
        this.marker.id = 'center-editor-marker';
        this.previewContainer.appendChild(this.marker);

        // Create image element for the preview
        this.previewImage = document.createElement('img');
        this.previewContainer.insertBefore(this.previewImage, this.marker);
    }

    open() {
        this.activeSprite = this.getActiveSprite();
        if (!this.activeSprite) {
            console.warn('Cannot open center editor: No active sprite.');
            return;
        }

        // Store temporary center coordinates from the sprite
        this.tempCenterX = this.activeSprite.centerX || 0.5;
        this.tempCenterY = this.activeSprite.centerY || 0.5;
        
        // Set image source and style
        this.previewImage.src = this.activeSprite.imageUrl;
        const MAX_SIZE = Math.min(window.innerWidth * 0.7, window.innerHeight * 0.7, 500); // Max preview size 500px
        this.previewImage.style.maxHeight = `${MAX_SIZE}px`;
        this.previewImage.style.maxWidth = `${MAX_SIZE}px`;
        
        // The image needs to load before we can get its dimensions for the marker
        this.previewImage.onload = () => {
            this.updateMarkerPosition();
            this.modal.classList.add('visible');
        };
        // If image is cached, onload might not fire, so handle that case
        if (this.previewImage.complete) {
             this.previewImage.onload();
        }
    }

    close() {
        this.modal.classList.remove('visible');
        this.activeSprite = null;
        if(this.previewImage) this.previewImage.src = ''; // Clear image to free memory
    }

    save() {
        if (this.activeSprite) {
            // Call the callback function provided by index.js to update the actual sprite data
            this.updateSpriteCenter(this.activeSprite.id, this.tempCenterX, this.tempCenterY);
        }
        this.close();
    }

    handlePreviewClick(event) {
        if (!this.previewImage || !this.previewImage.complete || this.previewImage.naturalWidth === 0) return;
        
        const rect = this.previewImage.getBoundingClientRect();
        
        // Calculate click position relative to the image
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Update temporary coordinates (normalized between 0 and 1)
        this.tempCenterX = x / rect.width;
        this.tempCenterY = y / rect.height;

        this.updateMarkerPosition();
    }

    updateMarkerPosition() {
        if (!this.previewImage || !this.previewImage.complete || this.previewImage.naturalWidth === 0) return;
        const rect = this.previewImage.getBoundingClientRect();
        const containerRect = this.previewContainer.getBoundingClientRect();

        // Position the marker relative to the preview container
        const markerX = (rect.left - containerRect.left) + (this.tempCenterX * rect.width);
        const markerY = (rect.top - containerRect.top) + (this.tempCenterY * rect.height);
        
        this.marker.style.left = `${markerX}px`;
        this.marker.style.top = `${markerY}px`;
    }
}
