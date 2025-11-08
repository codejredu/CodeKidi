

import { initCharacterCreator } from './Caracter.js';

document.addEventListener('DOMContentLoaded', () => {
    // START OF CUSTOM TOOLBOX RRENDERER
    
    /**
     * Safely encode a string to Base64, handling Unicode characters.
     * @param {string} str The string to encode.
     * @returns {string} The Base64 encoded string.
     */
    function safeBtoa(str) {
        // First, URI-encode the string, then convert to a format btoa can handle.
        return btoa(unescape(encodeURIComponent(str)));
    }
    
    /**
     * Safely decode a Base64 string, handling Unicode characters.
     * @param {string} base64 The Base64 string to decode.
     * @returns {string} The decoded string.
     */
    function safeAtob(base64) {
         // First, atob the string, then decode the URI-encoded characters.
        return decodeURIComponent(escape(atob(base64)));
    }

    /**
     * Helper function to convert a hex color to an rgba string.
     * @param {string} hex The hex color string (e.g., "#FF6B1A").
     * @param {number} alpha The alpha transparency (0.0 to 1.0).
     * @returns {string} The rgba color string.
     */
    function hexToRgba(hex, alpha) {
        let r = 0, g = 0, b = 0;
        if (hex.length == 4) { // 3-digit hex
            r = parseInt(hex[1] + hex[1], 16);
            g = parseInt(hex[2] + hex[2], 16);
            b = parseInt(hex[3] + hex[3], 16);
        } else if (hex.length == 7) { // 6-digit hex
            r = parseInt(hex.substring(1, 3), 16);
            g = parseInt(hex.substring(3, 5), 16);
            b = parseInt(hex.substring(5, 7), 16);
        }
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    class KidiToolboxCategory extends Blockly.ToolboxCategory {
        createDom_() {
            super.createDom_(); // Let the parent class create the basic structure

            const iconUri = this.toolboxItemDef_['icon-uri'];
            if (iconUri) {
                const label = this.rowDiv_.querySelector('.blocklyTreeLabel');
                if (label) {
                    const icon = document.createElement('img');
                    icon.src = iconUri;
                    icon.className = 'kidi-category-icon';
                    label.insertBefore(icon, label.firstChild);
                }
            }
            
            // Store colors in CSS variables on the element itself for the new CSS rule to use
            this.rowDiv_.style.setProperty('--category-color', this.colour_);
            this.rowDiv_.style.setProperty('--category-bg-color', hexToRgba(this.colour_, 0.08));
            
            return this.rowDiv_;
        }
        
        setSelected(isSelected) {
            super.setSelected(isSelected);
            // Just toggle a class. The CSS will handle the styling.
            this.rowDiv_.classList.toggle('kidi-category-selected', isSelected);
        }
    }

    Blockly.registry.register(
        Blockly.registry.Type.TOOLBOX_ITEM,
        Blockly.ToolboxCategory.registrationName,
        KidiToolboxCategory, 
        true // Allow override
    );
    // END OF CUSTOM TOOLBOX RENDERER

    // START OF INLINED GIF PARSER
    // A simplified GIF parser based on jsgif.
    const parseGIF = (arrayBuffer) => {
        const data = new Uint8Array(arrayBuffer);
        let pos = 0;
        const frames = [];
        let gct = null;
        let loopCount = 0;

        const readString = (length) => {
            let str = '';
            for (let i = 0; i < length; i++) {
                str += String.fromCharCode(data[pos++]);
            }
            return str;
        };

        const readByte = () => data[pos++];
        const readUInt16 = () => (readByte() | (readByte() << 8));
        
        const readColorTable = (size) => {
            const table = [];
            for (let i = 0; i < size; i++) {
                table.push([readByte(), readByte(), readByte()]);
            }
            return table;
        };

        const readLZW = (minCodeSize, data, pixels) => {
            let pos = 0; 
            const readCode = (size) => {
                let code = 0;
                for (let i = 0; i < size; i++) {
                    if (data[pos >> 3] & (1 << (pos & 7))) {
                        code |= 1 << i;
                    }
                    pos++;
                }
                return code;
            };
            
            const output = (index) => {
                pixels.push(index);
            };

            const clearCode = 1 << minCodeSize;
            const eoiCode = clearCode + 1;
            let codeSize = minCodeSize + 1;
            let dict = [];

            const clear = () => {
                dict = [];
                codeSize = minCodeSize + 1;
                for (let i = 0; i < clearCode; i++) {
                    dict[i] = [i];
                }
                dict[clearCode] = [];
                dict[eoiCode] = null;
            };

            let code, last;
            while (true) {
                last = code;
                code = readCode(codeSize);
                if (code === clearCode) {
                    clear();
                    continue;
                }
                if (code === eoiCode) break;
                if (code < dict.length) {
                    if (last !== clearCode) {
                        dict.push(dict[last].concat(dict[code][0]));
                    }
                } else {
                    if (code !== dict.length) throw new Error('Invalid LZW code.');
                    dict.push(dict[last].concat(dict[last][0]));
                }
                dict[code].forEach(output);
                if (dict.length === (1 << codeSize) && codeSize < 12) {
                    codeSize++;
                }
            }
        };

        // Header
        if (readString(6) !== 'GIF89a') throw new Error('Not a GIF file.');

        // Logical Screen Descriptor
        const width = readUInt16();
        const height = readUInt16();
        const packed = readByte();
        const gctFlag = (packed & 0x80) !== 0;
        const gctSize = 2 << (packed & 0x07);
        pos++; // Skip background color index
        pos++; // Skip pixel aspect ratio

        if (gctFlag) {
            gct = readColorTable(gctSize);
        }

        let gce = null;
        while(pos < data.length) {
            const blockType = readByte();
            if (blockType === 0x2C) { // Image Descriptor
                const left = readUInt16();
                const top = readUInt16();
                const w = readUInt16();
                const h = readUInt16();
                const imagePacked = readByte();
                const lctFlag = (imagePacked & 0x80) !== 0;
                const interlace = (imagePacked & 0x40) !== 0;
                const lctSize = 2 << (imagePacked & 0x07);
                const ct = lctFlag ? readColorTable(lctSize) : gct;

                const minCodeSize = readByte();
                const lzwData = [];
                let lzwBlockSize;
                while ((lzwBlockSize = readByte()) !== 0) {
                    for(let i=0; i < lzwBlockSize; ++i) lzwData.push(data[pos++]);
                }
                
                const pixelIndices = [];
                readLZW(minCodeSize, new Uint8Array(lzwData), pixelIndices);

                const image = {
                    left, top, w, h, pixelIndices,
                    colorTable: ct,
                    delay: gce ? gce.delay : 0,
                    disposalMethod: gce ? gce.disposalMethod : 0,
                    transparentColorIndex: gce ? gce.transparentColorIndex : null,
                };
                frames.push(image);
                gce = null;

            } else if (blockType === 0x21) { // Extension
                const extType = readByte();
                if (extType === 0xF9) { // Graphic Control Extension
                    readByte(); // block size
                    const gcePacked = readByte();
                    const transparentFlag = (gcePacked & 1) !== 0;
                    gce = {
                        disposalMethod: (gcePacked >> 2) & 7,
                        delay: readUInt16(),
                        transparentColorIndex: transparentFlag ? readByte() : null,
                    };
                    pos++; // skip block terminator
                } else if (extType === 0xFF) { // Application Extension
                   readByte(); // block size
                   if (readString(11) === 'NETSCAPE2.0') {
                       readByte(); // sub-block size
                       pos++; // always 1
                       loopCount = readUInt16();
                       readByte(); // block terminator
                   } else {
                       let appExtSize;
                       while((appExtSize = readByte()) !== 0) {
                           pos += appExtSize;
                       }
                   }
                } else {
                     let unknownExtSize;
                     while((unknownExtSize = readByte()) !== 0) {
                        pos += unknownExtSize;
                    }
                }
            } else if (blockType === 0x3B) { // Trailer
                break;
            } else {
                // Unknown block, ignore.
            }
        }
        return { width, height, frames, loopCount };
    };
    // END OF INLINED GIF PARSER


    // Monkey-patch FieldImage to vertically align icons better.
    const originalInitView = Blockly.FieldImage.prototype.initView;
    Blockly.FieldImage.prototype.initView = function() {
        originalInitView.call(this);
        const yOffset = 3; // Pixels to shift down for better alignment
        this.imageElement_.setAttribute('transform', `translate(0, ${yOffset})`);
    };

    // --- Main Application Elements ---
    const stageArea = document.getElementById('stage-area');
    const leftPanel = document.querySelector('.left-panel');
    const containerWrapper = document.getElementById('container-wrapper');
    const spritesList = document.getElementById('sprites-list');
    const backdropsList = document.getElementById('backdrops-list');
    const fullscreenButton = document.getElementById('fullscreen-button');
    const enterFullscreenIcon = document.getElementById('enter-fullscreen-icon');
    const exitFullscreenIcon = document.getElementById('exit-fullscreen-icon');
    const saveButton = document.getElementById('save-button');
    const loadButton = document.getElementById('load-button');
    const loadInput = document.getElementById('load-input');
    const fullscreenRunButton = document.getElementById('fullscreen-run-button');
    const fullscreenResetButton = document.getElementById('fullscreen-reset-button');
    const toggleGridButton = document.getElementById('toggle-grid-button');
    const gridCanvas = document.getElementById('grid-canvas');

    // --- Sprite Properties Panel Elements ---
    const propertiesPanel = document.getElementById('sprite-properties-panel');
    const propName = document.getElementById('prop-name');
    const propX = document.getElementById('prop-x');
    const propY = document.getElementById('prop-y');
    const propShow = document.getElementById('prop-show');
    const propHide = document.getElementById('prop-hide');
    const propSize = document.getElementById('prop-size');
    const propDirection = document.getElementById('prop-direction');
    const propRotationAllAround = document.getElementById('rotation-all-around');
    const propRotationLeftRight = document.getElementById('rotation-left-right');
    const propRotationDontRotate = document.getElementById('rotation-dont-rotate');
    const scrollUpBtn = document.getElementById('scroll-up-btn');
    const scrollDownBtn = document.getElementById('scroll-down-btn');
    
    // --- Angle Picker elements ---
    const anglePickerWidget = document.getElementById('angle-picker-widget');
    const anglePickerDial = document.getElementById('angle-picker-dial');
    const anglePickerHandle = document.getElementById('angle-picker-handle');
    
    // --- GIF Animation Panel elements ---
    const gifAnimationPanel = document.getElementById('gif-animation-panel');
    const gifPlayPauseBtn = document.getElementById('gif-play-pause-btn');
    const gifPlayIcon = document.getElementById('gif-play-icon');
    const gifPauseIcon = document.getElementById('gif-pause-icon');
    const gifSpeedSlider = document.getElementById('gif-speed-slider');
    const gifSpeedValue = document.getElementById('gif-speed-value');
    
    // --- Gallery Elements ---
    const spriteGallery = document.getElementById('sprite-gallery');
    const backgroundGallery = document.getElementById('background-gallery');
    const soundGallery = document.getElementById('sound-gallery');
    const allGalleries = [spriteGallery, backgroundGallery, soundGallery];

    // --- Sound System Elements ---
    const soundsList = document.getElementById('sounds-list');
    const addSoundButton = document.getElementById('add-sound-button');
    const uploadSoundHeaderButton = document.getElementById('upload-sound-header-button');
    const recordSoundHeaderButton = document.getElementById('record-sound-header-button');
    const closeSoundGalleryButton = document.getElementById('close-sound-gallery-button');
    const soundGalleryGrid = document.getElementById('sound-gallery-grid');
    const addSelectedSoundsButton = document.getElementById('add-selected-sounds-button');
    const soundUploadInput = document.getElementById('sound-upload-input');
    const soundRecorderModal = document.getElementById('sound-recorder-modal');
    const recorderCloseBtn = document.getElementById('recorder-close-btn');
    const recorderVisualizer = document.getElementById('recorder-visualizer');
    const recorderTimer = document.getElementById('recorder-timer');
    const recorderRecordBtn = document.getElementById('recorder-record-btn');
    const recorderStopBtn = document.getElementById('recorder-stop-btn');
    const recorderRerecordBtn = document.getElementById('recorder-rerecord-btn');
    const recorderSaveBtn = document.getElementById('recorder-save-btn');
    const recorderMessage = document.getElementById('recorder-message');
    const recorderUIContent = document.getElementById('recorder-ui-content');
    const recorderAudioPreview = document.getElementById('recorder-audio-preview');
    const recorderPreviewContainer = document.getElementById('recorder-preview-container');
    const recorderSoundName = document.getElementById('recorder-sound-name');
    
    // --- Application State ---
    const STAGE_WIDTH = 480;
    const STAGE_HEIGHT = 360;
    let workspace;
    let sprites = {};
    let activeSpriteId = null;
    let executionCancelled = false;
    let isLoadingProject = false;
    let collisionState = new Set();
    let scriptRunner = null;
    let lastTimestamp = 0;
    let nextZIndex = 10;
    // Make frameDeltaTime accessible globally so the generated code can see it.
    window.frameDeltaTime = 1000 / 60; // Time in ms for one frame at 60fps.
    
    // --- Sound System State ---
    let currentPreviewAudio = null;
    let selectedSoundsForAdd = new Set();
    let mediaRecorder = null;
    let audioChunks = [];
    let mediaStream = null;
    let recorderTimerInterval = null;
    let recordedBlob = null;
    
    // --- Script Copy Drag/Drop State ---
    let isDraggingForCopy = false;
    let draggedBlockXml = null;
    let sourceSpriteIdForCopy = null;
    let hoveredSpriteIdForDrop = null;

    const log = (message) => {
        console.log(message);
    };

    const openGallery = (galleryToOpen) => {
        allGalleries.forEach(gallery => {
            if (gallery !== galleryToOpen) {
                gallery.classList.remove('visible');
            }
        });
        galleryToOpen.classList.add('visible');
    };

    const getActiveSprite = () => sprites[activeSpriteId] || null;
    
    const updatePropertiesPanel = () => {
        const sprite = getActiveSprite();
        if (sprite) {
            propertiesPanel.classList.remove('hidden');
            
            propName.value = sprite.name;
            propX.value = Math.round(sprite.x);
            propY.value = Math.round(sprite.y);
            propSize.value = sprite.size;
            // Always display the normalized direction (0-359)
            propDirection.value = Math.round(((sprite.direction % 360) + 360) % 360);

            if (sprite.opacity === 1) {
                propShow.classList.add('active');
                propHide.classList.remove('active');
            } else {
                propShow.classList.remove('active');
                propHide.classList.add('active');
            }
            
            // Update rotation style buttons
            propRotationAllAround.classList.toggle('active', sprite.rotationStyle === 'all-around');
            propRotationLeftRight.classList.toggle('active', sprite.rotationStyle === 'left-right');
            propRotationDontRotate.classList.toggle('active', sprite.rotationStyle === 'dont-rotate');

            if (sprite.isGif && sprite.animation) {
                gifAnimationPanel.classList.remove('hidden');
                gifSpeedSlider.value = sprite.gifSpeed;
                gifSpeedValue.textContent = `${Number(sprite.gifSpeed).toFixed(1)}x`;
                const isPlaying = sprite.animation.previewIsPlaying;
                gifPlayIcon.classList.toggle('hidden', isPlaying);
                gifPauseIcon.classList.toggle('hidden', !isPlaying);
            } else {
                gifAnimationPanel.classList.add('hidden');
            }

        } else {
            propertiesPanel.classList.add('hidden');
        }
    };

    window.switchBackdrop = (url) => {
        if (!url || url === 'NONE') return;
        try {
            stageArea.style.backgroundImage = `url("${url}")`;
            document.querySelectorAll('.backdrop-card').forEach(card => card.classList.remove('selected'));
            const cardToSelect = Array.from(document.querySelectorAll('.backdrop-card')).find(card => card.dataset.url === url);
            if (cardToSelect) cardToSelect.classList.add('selected');
            log(`Backdrop switched to: ${url}`);
        } catch (e) {
            console.error("Failed to switch backdrop:", e);
        }
    };
    
    window.switchToNextBackdrop = () => {
        const backdropCards = Array.from(document.querySelectorAll('#backdrops-list .backdrop-card'));
        if (backdropCards.length < 2) {
            log('Not enough backdrops to switch to next.');
            return;
        }

        const currentCard = document.querySelector('#backdrops-list .backdrop-card.selected');
        let currentIndex = -1;
        if (currentCard) {
            currentIndex = backdropCards.indexOf(currentCard);
        }

        // If no card is selected, try to find it by URL (less efficient fallback)
        if (currentIndex === -1) {
            const currentUrl = stageArea.style.backgroundImage.slice(5, -2); // Extract URL
            currentIndex = backdropCards.findIndex(card => card.dataset.url === currentUrl);
        }
        
        const nextIndex = (currentIndex + 1) % backdropCards.length;
        const nextBackdropUrl = backdropCards[nextIndex].dataset.url;
        
        if (nextBackdropUrl) {
            window.switchBackdrop(nextBackdropUrl);
        }
    };

    window.switchToRandomBackdrop = () => {
        const backdropCards = Array.from(document.querySelectorAll('#backdrops-list .backdrop-card'));
        if (backdropCards.length === 0) {
            log('No backdrops for random selection.');
            return;
        }
        const randomIndex = Math.floor(Math.random() * backdropCards.length);
        const randomBackdropUrl = backdropCards[randomIndex].dataset.url;
        if (randomBackdropUrl) {
            window.switchBackdrop(randomBackdropUrl);
        }
    };
    
    // --- Frame-Based Script Execution Engine (like Scratch) ---
    class ScriptRunner {
        constructor(onScriptsComplete) {
            this.threads = [];
            this.isRunning = false;
            this.onScriptsComplete = onScriptsComplete; // Callback for when all scripts are done.
            log('New script runner created.');
        }

        add(generator) {
            this.threads.push(generator);
            if (!this.isRunning) {
                this.start();
            }
        }

        start() {
            if (this.isRunning) return;
            this.isRunning = true;
            executionCancelled = false;
            log('Script runner started.');
        }

        stop() {
            this.threads = [];
            executionCancelled = true;
            log('Script runner stopped.');
        }

        tick() {
            if (!this.isRunning) return;

            for (let i = this.threads.length - 1; i >= 0; i--) {
                const generator = this.threads[i];
                const result = generator.next();
                if (result.done) {
                    this.threads.splice(i, 1);
                }
            }
            
            if (this.threads.length === 0) {
                this.isRunning = false; // Set running to false before calling callback
                // All scripts finished naturally. Call the completion callback.
                if (this.onScriptsComplete) {
                    this.onScriptsComplete();
                }
            }
        }
    }

    // Custom field for messages
    const messageOptions = [
        [{
            src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="red"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
            width: 24, height: 24, alt: 'Red Heart'
        }, 'red_heart'],
        [{
            src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="blue"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>',
            width: 24, height: 24, alt: 'Blue Star'
        }, 'blue_star'],
        [{
            src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="green"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
            width: 24, height: 24, alt: 'Green Triangle'
        }, 'green_triangle'],
        [{
            src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="yellow" stroke="black" stroke-width="0.5"><circle cx="12" cy="12" r="10"/></svg>',
            width: 24, height: 24, alt: 'Yellow Circle'
        }, 'yellow_circle'],
        [{
            src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="purple"><path d="M3 3h18v18H3z"/></svg>',
            width: 24, height: 24, alt: 'Purple Square'
        }, 'purple_square'],
        [{
            src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="orange"><path d="M12 2.5l7.5 5.5-3 9H7.5l-3-9L12 2.5z"/></svg>',
            width: 24, height: 24, alt: 'Orange Pentagon'
        }, 'orange_pentagon']
    ];

    class FieldMessage extends Blockly.FieldDropdown {
        constructor() {
            super(FieldMessage.getOptions);
        }

        static getOptions() {
            return messageOptions;
        }
        
        initView() {
            super.initView();
            this.imageElement_ = Blockly.utils.dom.createSvgElement('image',
                { 'height': '24px', 'width': '24px' },
                this.fieldGroup_
            );
            this.updateImageView_();
        }

        doValueUpdate_(newValue) {
            super.doValueUpdate_(newValue);
            this.updateImageView_();
        }
        
        updateImageView_() {
            if (this.value_ && this.imageElement_) {
                const options = this.getOptions(false);
                const selectedOption = options.find(opt => opt[1] === this.value_);
                if (selectedOption) {
                    this.imageElement_.setAttributeNS(
                        'http://www.w3.org/1999/xlink',
                        'xlink:href',
                        selectedOption[0].src
                    );
                    if(this.textElement_) {
                    this.textElement_.style.display = 'none';
                    }
                }
            }
        }
    }
    Blockly.fieldRegistry.register('field_message', FieldMessage);
    
    const updateSpriteAppearance = (spriteId) => {
        const spriteData = sprites[spriteId];
        if (!spriteData) return;

        const container = document.getElementById(`container-${spriteData.id}`);
        const wrapper = container.querySelector('.sprite-wrapper');
        
        if (container && wrapper) {
            const rect = stageArea.getBoundingClientRect();
            const stageToSpriteX = STAGE_WIDTH / rect.width;
            const stageToSpriteY = STAGE_HEIGHT / rect.height;

            const stageX = spriteData.x / stageToSpriteX;
            const stageY = -spriteData.y / stageToSpriteY;
            
            const baseSize = 160;
            const newSize = baseSize * (spriteData.size / 100);

            // --- Rotation Logic ---
            let rotationTransform = '';
            switch(spriteData.rotationStyle) {
                case 'left-right':
                    // Normalize direction to [0, 360)
                    const normalizedDir = ((spriteData.direction % 360) + 360) % 360;
                    // Face right for 0-179, face left for 180-359
                    const isFlipped = normalizedDir >= 180;
                    rotationTransform = isFlipped ? 'scaleX(-1)' : 'scaleX(1)';
                    break;
                case 'dont-rotate':
                    rotationTransform = ''; // No rotation at all
                    break;
                case 'all-around':
                default:
                    rotationTransform = `rotate(${spriteData.direction - 90}deg)`;
                    break;
            }
            // --- End Rotation Logic ---

            // Apply styles to the single wrapper
            wrapper.style.width = `${newSize}px`;
            wrapper.style.height = `${newSize}px`;
            wrapper.style.opacity = spriteData.opacity;
            wrapper.style.transform = `translate(-50%, -50%) ${rotationTransform}`;
            
            // Position the main container which holds the wrapper
            container.style.transform = `translate(${stageX}px, ${stageY}px)`;
            container.style.zIndex = spriteData.zIndex;
            
            // After any visual update, check for collisions
            checkCollisions();
        }
    };
    
    const updateMotionBlocksInToolbox = (x, y) => {
        const toolbox = workspace?.getToolbox();
        if (!toolbox) return;

        const selectedCategory = toolbox.getSelectedItem();
        if (!selectedCategory || selectedCategory.name_ !== 'Motion') {
            return;
        }

        const flyout = toolbox.getFlyout();
        if (!flyout || !flyout.isVisible()) {
            return;
        }

        const flyoutWorkspace = flyout.getWorkspace();
        const blocks = flyoutWorkspace.getTopBlocks(false);

        for (const block of blocks) {
            if (block.type === 'motion_go_to_xy' || block.type === 'motion_glide_to_xy') {
                try {
                    const shadowX = block.getInput('X')?.connection?.targetBlock();
                    if (shadowX && shadowX.isShadow()) {
                        shadowX.setFieldValue(Math.round(x), 'NUM');
                    }
                    const shadowY = block.getInput('Y')?.connection?.targetBlock();
                    if (shadowY && shadowY.isShadow()) {
                        shadowY.setFieldValue(Math.round(y), 'NUM');
                    }
                } catch (e) {
                    console.warn('Could not update toolbox motion block.', e);
                }
            }
        }
    };

    /**
     * Centralized function to update a sprite's appearance on stage
     * and its properties in the panel if it's the active sprite.
     * @param {object} sprite The sprite object to refresh.
     */
    window.refreshSprite = (sprite) => {
        if (!sprite) return;
        updateSpriteAppearance(sprite.id);
        if (sprite.id === activeSpriteId) {
            updatePropertiesPanel();
            updateMotionBlocksInToolbox(sprite.x, sprite.y);
        }
    };

    /**
     * Refreshes any 'event_when_bump' blocks in the currently visible workspace
     * to reflect changes in the available sprites.
     */
    function refreshVisibleBumpBlocks() {
        if (!workspace) return;
        const allBlocks = workspace.getAllBlocks(false);
        allBlocks.forEach(block => {
            if (block.type === 'event_when_bump') {
                const field = block.getField('TARGET_SPRITE');
                if (field) {
                    const currentValue = field.getValue();
                    const activeSprite = getActiveSprite();
                    const otherSpritesCount = activeSprite 
                        ? Object.keys(sprites).filter(id => id !== activeSprite.id).length 
                        : Object.keys(sprites).length -1;
                    
                    if (otherSpritesCount <= 0 && currentValue !== 'NONE') {
                        field.setValue('NONE');
                    } else if (otherSpritesCount > 0 && currentValue === 'NONE') {
                        field.setValue('ANY');
                    } else {
                        const options = field.getOptions(false);
                        const currentSelectionExists = options.some(opt => opt[1] === currentValue);
                        if (!currentSelectionExists && currentValue !== 'ANY') {
                            field.setValue('ANY');
                        }
                    }
                }
            }
        });
    }

    function createAndAttachSpriteCard(spriteData) {
        const { id, name, imageUrl, isCustom } = spriteData;

        const spriteCard = document.createElement('div');
        spriteCard.classList.add('sprite-card');
        spriteCard.dataset.spriteId = id;
        spriteCard.innerHTML = `
            <img src="${imageUrl}" alt="${name}">
            <div class="delete-button">X</div>
            <div class="duplicate-button" title="Duplicate">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            </div>
            ${isCustom ? `
                <div class="edit-button" title="Edit Character">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                        <path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" />
                    </svg>
                </div>` : ''}
        `;
        spritesList.appendChild(spriteCard);

        // Attach listeners
        spriteCard.addEventListener('click', () => setActiveSprite(id));
        spriteCard.querySelector('.delete-button').addEventListener('click', (e) => { e.stopPropagation(); deleteSprite(id); });
        spriteCard.querySelector('.duplicate-button').addEventListener('click', (e) => { e.stopPropagation(); duplicateSprite(id); });
        
        if (isCustom && window.characterCreator) {
            spriteCard.querySelector('.edit-button').addEventListener('click', (e) => {
                e.stopPropagation();
                window.characterCreator.openForEdit(id);
            });
        }

        return spriteCard;
    }

    const createNewSprite = (name, imageUrl, initialX = 0, initialY = 0, isCustom = false, characterData = null, gifSpeed = 1.0) => {
        const id = `sprite-${Date.now()}`;
        const isGif = imageUrl.toLowerCase().endsWith('.gif') || imageUrl.startsWith('data:image/gif');

        const spriteData = {
            id,
            name,
            imageUrl,
            x: initialX,
            y: initialY,
            direction: 90,
            opacity: 1,
            size: 100,
            rotationStyle: 'all-around',
            workspaceXml: null,
            isCustom: isCustom,
            characterData: characterData,
            isGif: isGif,
            animation: null,
            gifSpeed: gifSpeed,
            speed: 'instant',
            sounds: [],
            isJumping: false,
            zIndex: nextZIndex++,
        };
        
        sprites[id] = spriteData;

        createAndAttachSpriteCard(spriteData);

        const spriteContainer = document.createElement('div');
        spriteContainer.id = `container-${id}`;
        spriteContainer.classList.add('sprite-container');

        const mainSprite = document.createElement('div');
        mainSprite.classList.add('sprite-wrapper');
        mainSprite.id = id;
        mainSprite.innerHTML = `
            <img src="${imageUrl}" alt="${name}">
            <canvas class="hidden absolute top-0 left-0 w-full h-full"></canvas>
            <div class="speech-bubble"></div>
        `;
        
        spriteContainer.appendChild(mainSprite);
        stageArea.appendChild(spriteContainer);

        if (isGif) {
            loadGifData(spriteData);
        }
        
        const wrapper = spriteContainer.querySelector('.sprite-wrapper');
        wrapper.addEventListener('mousedown', (e) => handleSpriteMouseDown(e, id));
        wrapper.addEventListener('touchstart', (e) => handleSpriteMouseDown(e, id), { passive: false });


        setActiveSprite(id);
        updateSpriteAppearance(id);
        refreshVisibleBumpBlocks(); // Refresh blocks on other sprites
        return spriteData;
    };

    const deleteSprite = (id) => {
        document.getElementById(`container-${id}`)?.remove();
        document.querySelector(`.sprite-card[data-sprite-id="${id}"]`)?.remove();
        
        delete sprites[id];

        if (activeSpriteId === id) {
            activeSpriteId = null;
            workspace.clear();
            const firstSpriteId = Object.keys(sprites)[0];
            if (firstSpriteId) {
                setActiveSprite(firstSpriteId);
            } else {
                updatePropertiesPanel();
                renderSpriteSounds(null);
                refreshVisibleBumpBlocks();
            }
        } else {
             refreshVisibleBumpBlocks();
        }
        log(`Sprite ${id} deleted.`);
    };
    
    const duplicateSprite = (sourceId) => {
        const sourceSprite = sprites[sourceId];
        if (!sourceSprite) return;

        // 1. Find a unique name
        let newName = sourceSprite.name;
        const baseName = newName.replace(/\d+$/, ''); // Remove trailing numbers
        let counter = 2;
        const allNames = Object.values(sprites).map(s => s.name);
        
        do {
            newName = `${baseName}${counter}`;
            counter++;
        } while (allNames.includes(newName));

        // 2. Deep copy and modify data
        const newId = `sprite-${Date.now()}`;
        
        // Exclude non-serializable animation property before cloning
        const { animation, ...serializableSource } = sourceSprite;
        const newData = JSON.parse(JSON.stringify(serializableSource));

        newData.id = newId;
        newData.name = newName;
        newData.x += 20;
        newData.y -= 20; // Offset up and to the right
        newData.zIndex = nextZIndex++;
        newData.animation = null; // Ensure animation is null for recreation

        // 3. Create the new sprite using the copied data
        loadSpriteFromData(newData);

        // 4. Set the new sprite as active
        setActiveSprite(newId);
        
        log(`Sprite '${sourceSprite.name}' duplicated to '${newName}'.`);
        
        // 5. Reset the run/stop buttons to the initial state.
        stopAllScripts();
    };

    const setActiveSprite = (spriteId) => {
        // Allow switching anyway, as per user request
        
        if (activeSpriteId === spriteId) return;

        // 1. Save current workspace
        if (activeSpriteId && sprites[activeSpriteId]) {
            const oldDom = Blockly.Xml.workspaceToDom(workspace);
            sprites[activeSpriteId].workspaceXml = Blockly.Xml.domToText(oldDom);
        }

        // 2. Deselect old card
        if (activeSpriteId) {
            const prevCard = document.querySelector(`.sprite-card[data-sprite-id="${activeSpriteId}"]`);
            if (prevCard) {
                prevCard.classList.remove('selected');
            }
        }

        // 3. Set new active sprite
        activeSpriteId = spriteId;

        // 4. Clear and load new workspace
        const newSprite = sprites[spriteId];
        workspace.clear();
        if (newSprite && newSprite.workspaceXml) {
            try {
                const newDom = Blockly.Xml.textToDom(newSprite.workspaceXml);
                Blockly.Xml.domToWorkspace(newDom, workspace);
            } catch (e) {
                console.error("Error loading workspace XML:", e);
                workspace.clear(); // Clear on error to avoid broken state
            }
        }

        // 5. Select new card
        const newCard = document.querySelector(`.sprite-card[data-sprite-id="${spriteId}"]`);
        if (newCard) {
            newCard.classList.add('selected');
        }
        
        // 6. Update properties panel and sounds list
        updatePropertiesPanel();
        renderSpriteSounds(newSprite);
        refreshVisibleBumpBlocks();
        
        // 7. Refresh toolbox to update dynamic fields (like sounds)
        workspace.refreshToolboxSelection();

        log(`Active sprite is now: ${newSprite.name}`);
    };

    const getPointerPosition = (e) => {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    };

    function handleSpriteMouseDown(startEvent, spriteId) {
        startEvent.preventDefault();
        const spriteData = sprites[spriteId];
        if (!spriteData) return;

        // State for this specific interaction, captured in a closure.
        let wasDragged = false;
        const { x: startMouseX, y: startMouseY } = getPointerPosition(startEvent);
        const initialSpriteX = spriteData.x;
        const initialSpriteY = spriteData.y;

        setActiveSprite(spriteId);
        document.querySelector(`#container-${spriteId}`).style.transition = 'none';

        function onMouseMove(moveEvent) {
            const { x: currentX, y: currentY } = getPointerPosition(moveEvent);

            // Check if it qualifies as a drag
            const deltaX = currentX - startMouseX;
            const deltaY = currentY - startMouseY;
            if (!wasDragged && (deltaX * deltaX + deltaY * deltaY) > 25) { // 5px threshold
                wasDragged = true;
            }

            // Update sprite position based on drag
            const rect = stageArea.getBoundingClientRect();
            const scaleX = STAGE_WIDTH / rect.width;
            const scaleY = STAGE_HEIGHT / rect.height;

            spriteData.x = initialSpriteX + deltaX * scaleX;
            spriteData.y = initialSpriteY - deltaY * scaleY;
            
            window.refreshSprite(spriteData);
        }

        function onMouseUp(endEvent) {
            // Cleanup listeners immediately
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('touchmove', onMouseMove);
            document.removeEventListener('touchend', onMouseUp);

            // If it was a click (not a drag), check for scripts to run
            if (!wasDragged) {
                handleSpriteClick(spriteId);
            } else {
                log(`Sprite dragged to new position (x: ${spriteData.x.toFixed(0)}, y: ${spriteData.y.toFixed(0)})`);
            }
        }

        // Attach listeners for this drag operation
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('touchmove', onMouseMove);
        document.addEventListener('touchend', onMouseUp);
    }

    window.addEventListener('resize', () => {
        Object.keys(sprites).forEach(updateSpriteAppearance);
        Blockly.svgResize(workspace);
    });
    
    function positionNumberPad(field) {
        const numberPad = document.getElementById('number-pad-container');
        if (!field || numberPad.style.display !== 'block') {
            return;
        }

        // Make pad temporarily visible but transparent to measure its dimensions
        numberPad.style.visibility = 'hidden';
        const padRect = numberPad.getBoundingClientRect();
        
        const blockSvg = field.getSourceBlock().getSvgRoot();
        const blockBounds = blockSvg.getBoundingClientRect();

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = 5; // Margin from screen edges

        // --- Vertical Positioning ---
        let finalTop;
        // Try positioning below first
        if (blockBounds.bottom + padRect.height + margin < viewportHeight) {
            finalTop = blockBounds.bottom + margin;
        } 
        // If not enough space below, try positioning above
        else if (blockBounds.top - padRect.height - margin > 0) {
            finalTop = blockBounds.top - padRect.height - margin;
        } 
        // If no space above either, position it as best as possible (e.g., at the top)
        else {
            finalTop = margin;
        }

        // --- Horizontal Positioning ---
        let finalLeft;
        // Start by aligning with the block's left edge
        finalLeft = blockBounds.left;
        
        // If it overflows right, align to the right edge of the screen
        if (finalLeft + padRect.width + margin > viewportWidth) {
             finalLeft = viewportWidth - padRect.width - margin;
        }
        
        // Ensure it doesn't go off the left edge
        if (finalLeft < margin) {
            finalLeft = margin;
        }

        numberPad.style.top = `${finalTop}px`;
        numberPad.style.left = `${finalLeft}px`;
        
        numberPad.style.visibility = 'visible';
    }
    
    // Custom Field for Number Pad
    class FieldCustomNumber extends Blockly.FieldNumber {
        constructor(value, min, max, precision, validator) {
            super(value, min, max, precision, validator);
        }

        showEditor_() {
            const numberPad = document.getElementById('number-pad-container');
            const numberPadDisplay = document.getElementById('number-pad-display');
            
            numberPad.currentField = this;
            numberPadDisplay.textContent = '';

            // Show pad to start calculations
            numberPad.style.display = 'block';
            
            positionNumberPad(this);
        }
    }
    Blockly.fieldRegistry.register('field_custom_number', FieldCustomNumber);
    
    // Redefine standard math_number block to use our custom field
    Blockly.Blocks['math_number'] = {
        init: function() {
            this.appendDummyInput()
                .appendField(new FieldCustomNumber(0), 'NUM');
            this.setOutput(true, 'Number');
            this.setColour("#40BF4A");
            this.setTooltip("A number.");
            this.setHelpUrl("%{BKY_MATH_NUMBER_HELPURL}");
        }
    };

    Blockly.Blocks['event_when_flag_clicked'] = {
        init: function() {
            this.appendDummyInput()
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/flag.svg", 35, 35, { alt: "green flag", flipRtl: false }))
                .appendField('\u00A0'.repeat(12));
            this.setNextStatement(true, null);
            this.setColour("#FFC107");
            this.setTooltip("Start the script when the green flag is clicked.");
            this.setHelpUrl("");
        }
    };
    Blockly.JavaScript['event_when_flag_clicked'] = function(block) { return ''; };

    Blockly.Blocks['event_when_sprite_clicked'] = {
        init: function() {
            this.appendDummyInput()
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/whenprees.svg", 35, 35, "*"))
                .appendField('\u00A0'.repeat(12));
            this.setNextStatement(true, null);
            this.setColour("#FFC107");
            this.setTooltip("Start the script when the sprite is clicked.");
            this.setHelpUrl("");
        }
    };
    Blockly.JavaScript['event_when_sprite_clicked'] = function(block) { return ''; };

    Blockly.Blocks['event_when_key_pressed'] = {
        init: function() {
            const keyOptions = [
                [
                    {
                        src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="24" viewBox="0 0 48 24"><rect x="1" y="1" width="46" height="22" rx="4" fill="%23fff" stroke="%23555" stroke-width="2"/><text x="24" y="16" font-family="Arial" font-size="12" text-anchor="middle" fill="%23000">space</text></svg>',
                        width: 48,
                        height: 24,
                        alt: 'space'
                    },
                    'SPACE'
                ],
                [
                     {
                        src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4" fill="%23fff" stroke="%23555" stroke-width="2"/><path d="M12 8l-4 4h8z" fill="%23555"/></svg>',
                        width: 24,
                        height: 24,
                        alt: 'up arrow'
                    },
                    'UP'
                ],
                [
                    {
                        src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4" fill="%23fff" stroke="%23555" stroke-width="2"/><path d="M12 16l4-4H8z" fill="%23555"/></svg>',
                        width: 24,
                        height: 24,
                        alt: 'down arrow'
                    },
                    'DOWN'
                ],
                [
                    {
                        src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4" fill="%23fff" stroke="%23555" stroke-width="2"/><path d="M14 12l-4 4V8z" fill="%23555"/></svg>',
                        width: 24,
                        height: 24,
                        alt: 'right arrow'
                    },
                    'RIGHT'
                ],
                [
                    {
                        src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4" fill="%23fff" stroke="%23555" stroke-width="2"/><path d="M10 12l4-4v8z" fill="%23555"/></svg>',
                        width: 24,
                        height: 24,
                        alt: 'left arrow'
                    },
                    'LEFT'
                ]
            ];
            this.appendDummyInput()
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/keyboard.svg", 35, 35, { alt: "keyboard icon", flipRtl: false }))
                .appendField(new Blockly.FieldDropdown(keyOptions), "KEY")
                .appendField('\u00A0\u00A0\u00A0\u00A0\u00A0');
            this.setNextStatement(true, null);
            this.setColour("#FFC107");
            this.setTooltip("Start the script when the selected key is pressed.");
            this.setHelpUrl("");
        }
    };
    Blockly.JavaScript['event_when_key_pressed'] = function(block) { return ''; };
    
    // Custom field for sprite selection
    class FieldSprite extends Blockly.FieldDropdown {
        constructor() {
            super(FieldSprite.generateOptions);
        }

        static generateOptions() {
            const spriteIds = Object.keys(sprites);
            const activeSprite = getActiveSprite();
            
            const otherSprites = activeSprite 
                ? spriteIds.filter(id => id !== activeSprite.id).map(id => sprites[id])
                : [];

            if (otherSprites.length === 0) {
                return [[{
                    src: '', // Intentionally blank to show an empty field
                    width: 48,
                    height: 48,
                    alt: 'No other sprites',
                }, 'NONE']];
            }

            const options = otherSprites.map(sprite => {
                return [
                    {
                        src: sprite.imageUrl,
                        width: 48,
                        height: 48,
                        alt: sprite.name,
                    },
                    sprite.id
                ];
            });
            
            options.unshift([
                 {
                    src: 'https://codejredu.github.io/test/assets/blocklyicon/allman.svg',
                    width: 48,
                    height: 48,
                    alt: 'Any Sprite',
                 },
                'ANY'
            ]);

            return options;
        }

        initView() {
            super.initView();
            this.imageElement_ = Blockly.utils.dom.createSvgElement('image', {
                'height': '36px',
                'width': '36px',
                'y': -10,
                'x': 5
            }, this.fieldGroup_);
            this.updateImageView_();
        }

        showEditor_() {
            const options = this.getOptions(false);
            if (options.length === 1 && options[0][1] === 'NONE') {
                return; // Prevent dropdown from showing if there are no options
            }
            super.showEditor_(...arguments);
        }

        doValueUpdate_(newValue) {
            super.doValueUpdate_(newValue);
            this.updateImageView_();
        }

        updateImageView_() {
            if (!this.value_ || !this.imageElement_) {
                return;
            }

            const options = this.getOptions(false);
            const selectedOption = options.find(opt => opt[1] === this.value_);

            if (selectedOption && typeof selectedOption[0] === 'object' && selectedOption[0].src) {
                this.imageElement_.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', selectedOption[0].src);
                if (this.textElement_) {
                    this.textElement_.style.display = 'none';
                }
            } else {
                // If src is empty or not present, clear the image and hide the text.
                this.imageElement_.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '');
                if (this.textElement_) {
                    this.textElement_.style.display = 'none';
                }
            }
        }
    }
    Blockly.fieldRegistry.register('field_sprite', FieldSprite);

    Blockly.Blocks['event_when_bump'] = {
        init: function() {
            this.appendDummyInput()
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/collision.svg", 35, 35, "*"))
                .appendField(new FieldSprite(), 'TARGET_SPRITE')
                .appendField('\u00A0\u00A0\u00A0\u00A0\u00A0');
            this.setNextStatement(true, null);
            this.setColour("#FFC107");
            this.setTooltip("Start the script when this sprite touches the selected sprite.");
        }
    };
    Blockly.JavaScript['event_when_bump'] = function(block) { return ''; };


    Blockly.Blocks['event_broadcast'] = {
        init: function() {
            this.appendDummyInput()
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/send.svg", 35, 35, "*"))
                .appendField(new FieldMessage(), 'MESSAGE')
                .appendField('\u00A0\u00A0\u00A0\u00A0\u00A0');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour("#FFC107");
            this.setTooltip("Sends a message to all sprites.");
        }
    };

    Blockly.JavaScript['event_broadcast'] = function(block) {
        const message = block.getFieldValue('MESSAGE');
        // Sanitize the block ID and add a random suffix to ensure the variable is unique
        // across different script executions, preventing global scope conflicts.
        const uniqueSuffix = Math.random().toString(36).substring(2, 9);
        const eventVar = `event_${block.id.replace(/[^a-zA-Z0-9]/g, '_')}_${uniqueSuffix}`;
        return `
            log('Broadcasting message: ${message}');
            const ${eventVar} = new CustomEvent('kidi-broadcast', { detail: { message: '${message}' } });
            window.dispatchEvent(${eventVar});
        `;
    };

    Blockly.Blocks['event_when_broadcast_received'] = {
        init: function() {
            this.appendDummyInput()
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/receive.svg", 35, 35, "*"))
                .appendField(new FieldMessage(), 'MESSAGE')
                .appendField('\u00A0\u00A0\u00A0\u00A0\u00A0');
            this.setNextStatement(true, null);
            this.setColour("#FFC107");
            this.setTooltip("Starts a script when a specific message is received.");
        }
    };
    Blockly.JavaScript['event_when_broadcast_received'] = function(block) { return ''; };

    Blockly.Blocks['motion_move_steps'] = {
        init: function() {
            this.appendValueInput("STEPS").setCheck("Number")
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/walk.svg", 34, 34, "*"))
                .appendField('\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour("#4C97FF");
            this.setTooltip("Move the sprite in the direction it is facing.");
        }
    };
    Blockly.JavaScript['motion_move_steps'] = function(block) {
        const steps = Blockly.JavaScript.valueToCode(block, 'STEPS', Blockly.JavaScript.ORDER_ATOMIC) || '10';
        return `
            if (sprite) {
                const halfWidth = ${STAGE_WIDTH / 2};
                const halfHeight = ${STAGE_HEIGHT / 2};
                const spriteLogicalWidth = 160 * (sprite.size / 100);
                const spriteLogicalHeight = 160 * (sprite.size / 100);
                const spriteHalfWidth = spriteLogicalWidth / 2;
                const spriteHalfHeight = spriteLogicalHeight / 2;
    
                const wrapPosition = () => {
                    if (sprite.x - spriteHalfWidth > halfWidth) sprite.x = -halfWidth - spriteHalfWidth;
                    if (sprite.x + spriteHalfWidth < -halfWidth) sprite.x = halfWidth + spriteHalfWidth;
                    if (sprite.y - spriteHalfHeight > halfHeight) sprite.y = -halfHeight - spriteHalfHeight;
                    if (sprite.y + spriteHalfHeight < -halfHeight) sprite.y = halfHeight + spriteHalfHeight;
                };
    
                const moveSpeed = sprite.speed || 'instant';
                if (moveSpeed === 'instant') {
                    const distance = Number(${steps});
                    const radians = sprite.direction * Math.PI / 180;
                    sprite.x += distance * Math.sin(radians);
                    sprite.y += distance * Math.cos(radians);
                    wrapPosition();
                    window.refreshSprite(sprite);
                    yield;
                } else {
                    const distance = Number(${steps});
                    if (distance !== 0) {
                        const speedMap = { slow: 60, normal: 180, fast: 360 }; // pixels per second
                        const pixelsPerSecond = speedMap[moveSpeed] || 180;
                        
                        const distanceToMove = Math.abs(distance);
                        let distanceMoved = 0;
                        const radians = sprite.direction * Math.PI / 180;
                        const sign = distance > 0 ? 1 : -1;
    
                        while (distanceMoved < distanceToMove) {
                            if (getExecutionCancelled()) break;
                            
                            const frameMoveAmount = (pixelsPerSecond * window.frameDeltaTime / 1000);
                            const remainingDistance = distanceToMove - distanceMoved;
                            const finalMoveAmount = Math.min(frameMoveAmount, remainingDistance) * sign;
    
                            sprite.x += finalMoveAmount * Math.sin(radians);
                            sprite.y += finalMoveAmount * Math.cos(radians);
                            
                            wrapPosition();
                            
                            distanceMoved += Math.abs(finalMoveAmount);
                            
                            window.refreshSprite(sprite);
                            yield;
                        }
                    } else {
                        yield;
                    }
                }
            }
        `;
    };
    Blockly.Blocks['motion_turn_right_degrees'] = {
        init: function() {
            this.appendValueInput("DEGREES").setCheck("Number")
                .appendField(new Blockly.FieldImage("https://github.com/codejredu/test/raw/main/assets/blocklyicon/right.png", 34, 34, { alt: "turn right icon", flipRtl: false }))
                .appendField('\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour("#4C97FF");
            this.setTooltip("Turn the sprite to the right.");
        }
    };
    Blockly.JavaScript['motion_turn_right_degrees'] = function(block) {
        const degrees = Blockly.JavaScript.valueToCode(block, 'DEGREES', Blockly.JavaScript.ORDER_ATOMIC) || '15';
        return `
            if (sprite) {
                const rotationAmount = Number(${degrees});
                sprite.direction += rotationAmount;
                window.refreshSprite(sprite);
            }
            yield;
        `;
    };
    Blockly.Blocks['motion_turn_left_degrees'] = {
        init: function() {
            this.appendValueInput("DEGREES").setCheck("Number")
                .appendField(new Blockly.FieldImage("https://github.com/codejredu/test/raw/main/assets/blocklyicon/left.png", 34, 34, { alt: "turn left icon", flipRtl: false }))
                .appendField('\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour("#4C97FF");
            this.setTooltip("Turn the sprite to the left.");
        }
    };
    Blockly.JavaScript['motion_turn_left_degrees'] = function(block) {
        const degrees = Blockly.JavaScript.valueToCode(block, 'DEGREES', Blockly.JavaScript.ORDER_ATOMIC) || '15';
        return `
            if (sprite) {
                const rotationAmount = Number(${degrees});
                sprite.direction -= rotationAmount;
                window.refreshSprite(sprite);
            }
            yield;
        `;
    };
    
    Blockly.Blocks['motion_set_speed'] = {
        init: function() {
            this.appendDummyInput()
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/speedsvg.svg", 34, 34, "*"))
                .appendField(new Blockly.FieldDropdown([
                    [{ src: 'https://codejredu.github.io/test/assets/blocklyicon/slow.svg', width: 24, height: 24, alt: 'slow' }, 'slow'],
                    [{ src: 'https://codejredu.github.io/test/assets/blocklyicon/walksvg.svg', width: 24, height: 24, alt: 'normal' }, 'normal'],
                    [{ src: 'https://codejredu.github.io/test/assets/blocklyicon/fastspeed.svg', width: 24, height: 24, alt: 'fast' }, 'fast']
                ]), "SPEED")
                .appendField('\u00A0\u00A0\u00A0\u00A0\u00A0');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour("#4C97FF");
            this.setTooltip("Sets how fast the sprite moves with the 'move' block.");
            this.getField('SPEED').setValue('normal');
        }
    };

    Blockly.JavaScript['motion_set_speed'] = function(block) {
        const speed = block.getFieldValue('SPEED');
        return `
            if (sprite) {
                sprite.speed = '${speed}';
                log(sprite.name + ' speed set to ${speed}.');
            }
            yield;
        `;
    };
    
    Blockly.Blocks['motion_set_direction'] = {
        init: function() {
            const angleValidator = (newValue) => {
                 if (getActiveSprite()) {
                    let sprite = getActiveSprite();
                    sprite.direction = Number(newValue);
                    window.refreshSprite(sprite);
                }
                return newValue;
            };

            this.appendDummyInput()
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/compass.svg", 34, 34, { alt: "compass icon", flipRtl: false }))
                .appendField(new Blockly.FieldAngle('90', angleValidator), 'DEGREES')
                .appendField('\u00A0\u00A0\u00A0\u00A0\u00A0');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour("#4C97FF");
            this.setTooltip("Set the direction of the sprite.");
        }
    };
    Blockly.JavaScript['motion_set_direction'] = function(block) {
        const degrees = block.getFieldValue('DEGREES');
        return `
            if (sprite) {
                sprite.direction = Number(${degrees});
                window.refreshSprite(sprite);
                log(sprite.name + ' set direction to ' + sprite.direction + ' degrees.');
            }
            yield;
        `;
    };
    
    Blockly.Blocks['looks_say_for_secs'] = {
        init: function() {
            this.appendValueInput("MESSAGE")
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/say.png", 34, 34, { alt: "say icon", flipRtl: false }));
            this.appendValueInput("SECS").setCheck("Number");
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour("#9966FF");
            this.setTooltip("Make the sprite say a message for a number of seconds.");
        }
    };
    Blockly.JavaScript['looks_say_for_secs'] = function(block) {
        const message = Blockly.JavaScript.valueToCode(block, 'MESSAGE', Blockly.JavaScript.ORDER_ATOMIC) || "''";
        const secs = Blockly.JavaScript.valueToCode(block, 'SECS', Blockly.JavaScript.ORDER_ATOMIC) || '2';
        // Sanitize the block ID and add a random suffix to ensure the variable is unique.
        const uniqueSuffix = Math.random().toString(36).substring(2, 9);
        const varName = `endTime_${block.id.replace(/[^a-zA-Z0-9]/g, '_')}_${uniqueSuffix}`;
        return `
            if (sprite) {
                const spriteEl = document.getElementById(sprite.id);
                if (spriteEl) {
                    const bubble = spriteEl.querySelector('.speech-bubble');
                    const rawMessage = ${message};
                    const finalMessage = typeof rawMessage === 'number' ? Math.round(rawMessage) : rawMessage;
                    bubble.textContent = finalMessage;
                    bubble.classList.add('visible');
                    log(sprite.name + ' says: ' + finalMessage);
                    
                    const ${varName} = Date.now() + (${secs}) * 1000;
                    while (Date.now() < ${varName}) {
                        if (getExecutionCancelled()) break;
                        yield;
                    }

                    if (!getExecutionCancelled()) {
                         bubble.classList.remove('visible');
                    }
                }
            }
        `;
    };
    Blockly.Blocks['looks_say'] = {
        init: function() {
            this.appendValueInput("MESSAGE")
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/say.png", 34, 34, { alt: "say icon", flipRtl: false }));
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour("#9966FF");
            this.setTooltip("Make the sprite say a message.");
        }
    };
    Blockly.JavaScript['looks_say'] = function(block) {
        const message = Blockly.JavaScript.valueToCode(block, 'MESSAGE', Blockly.JavaScript.ORDER_ATOMIC) || "''";
        return `
            if (sprite) {
                const spriteEl = document.getElementById(sprite.id);
                if (spriteEl) {
                   const bubble = spriteEl.querySelector('.speech-bubble');
                   const rawMessage = ${message};
                   const finalMessage = typeof rawMessage === 'number' ? Math.round(rawMessage) : rawMessage;
                   bubble.textContent = finalMessage;
                   bubble.classList.add('visible');
                   log(sprite.name + ' says: ' + finalMessage);
                }
            }
        `;
    };
    Blockly.Blocks['looks_show'] = {
        init: function() {
            this.appendDummyInput().appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/show.png", 34, 34, { alt: "show icon", flipRtl: false })).appendField('\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour("#9966FF");
            this.setTooltip("Show the sprite.");
        }
    };
    Blockly.JavaScript['looks_show'] = function(block) {
        return `
            if (sprite) {
                sprite.opacity = 1;
                window.refreshSprite(sprite);
                log(sprite.name + ' shown.');
            }
            yield;
        `;
    };
    Blockly.Blocks['looks_hide'] = {
        init: function() {
            this.appendDummyInput().appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/hide.png", 34, 34, { alt: "hide icon", flipRtl: false })).appendField('\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour("#9966FF");
            this.setTooltip("Hide the sprite.");
        }
    };
    Blockly.JavaScript['looks_hide'] = function(block) {
        return `
            if (sprite) {
                sprite.opacity = 0;
                window.refreshSprite(sprite);
                log(sprite.name + ' hidden.');
            }
            yield;
        `;
    };

    Blockly.Blocks['looks_grow'] = {
        init: function() {
            this.appendValueInput("SIZE")
                .setCheck("Number")
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/increase.svg", 34, 34, "*"));
            this.appendDummyInput().appendField('\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour("#9966FF");
            this.setTooltip("Increase the sprite's size.");
        }
    };
    Blockly.JavaScript['looks_grow'] = function(block) {
        const size = Blockly.JavaScript.valueToCode(block, 'SIZE', Blockly.JavaScript.ORDER_ATOMIC) || '10';
        return `
            if (sprite) {
                const sizeChange = Number(${size});
                sprite.size += sizeChange;
                window.refreshSprite(sprite);
                log(sprite.name + ' grew to size ' + sprite.size);
            }
            yield;
        `;
    };
    
    Blockly.Blocks['looks_shrink'] = {
        init: function() {
            this.appendValueInput("SIZE")
                .setCheck("Number")
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/decrease.svg", 34, 34, "*"));
            this.appendDummyInput().appendField('\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour("#9966FF");
            this.setTooltip("Decrease the sprite's size.");
        }
    };
    Blockly.JavaScript['looks_shrink'] = function(block) {
        const size = Blockly.JavaScript.valueToCode(block, 'SIZE', Blockly.JavaScript.ORDER_ATOMIC) || '10';
        return `
            if (sprite) {
                const sizeChange = Number(${size});
                sprite.size = Math.max(5, sprite.size - sizeChange); // Don't let size go below 5
                window.refreshSprite(sprite);
                log(sprite.name + ' shrunk to size ' + sprite.size);
            }
            yield;
        `;
    };

    Blockly.Blocks['looks_set_size'] = {
        init: function() {
            this.appendValueInput("SIZE")
                .setCheck("Number")
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/equal.svg", 34, 34, "*"));
            this.appendDummyInput().appendField('\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour("#9966FF");
            this.setTooltip("Sets the sprite's size as a percentage.");
        }
    };
    Blockly.JavaScript['looks_set_size'] = function(block) {
        const size = Blockly.JavaScript.valueToCode(block, 'SIZE', Blockly.JavaScript.ORDER_ATOMIC) || '100';
        return `
            if (sprite) {
                sprite.size = Math.max(5, Number(${size})); // Don't let size go below 5
                window.refreshSprite(sprite);
                log(sprite.name + ' set size to ' + sprite.size);
            }
            yield;
        `;
    };

    // Custom field for backdrop selection
    class FieldBackdrop extends Blockly.FieldDropdown {
        constructor() {
            super(FieldBackdrop.generateOptions);
        }

        static generateOptions() {
            const backdropElements = document.querySelectorAll('#backdrops-list .backdrop-card');
            const iconOptions = [];
            
            // Only show "Next" and "Random" if there are multiple backdrops to choose from.
            if (backdropElements.length > 1) {
                const nextIcon = 'https://codejredu.github.io/test/assets/blocklyicon/nextislide.svg';
                const randomIcon = 'https://codejredu.github.io/test/assets/blocklyicon/cube.svg';

                iconOptions.push(
                    [{ src: nextIcon, width: 48, height: 36, alt: 'Next Backdrop' }, '__NEXT__'],
                    [{ src: randomIcon, width: 48, height: 36, alt: 'Random Backdrop' }, '__RANDOM__']
                );
            }

            const backdropOptions = Array.from(backdropElements).map((card) => {
                const url = card.dataset.url;
                const name = url.substring(url.lastIndexOf('/') + 1).replace(/\.(svg|png|jpg|jpeg|gif)$/i, '');
                return [
                    {
                        src: url,
                        width: 48,
                        height: 36,
                        alt: name,
                    },
                    url
                ];
            });
            
            const finalOptions = [...iconOptions, ...backdropOptions];

            if (finalOptions.length === 0) {
                 return [['(no backdrops)', 'NONE']];
            }
            
            return finalOptions;
        }


        initView() {
            super.initView();
            this.imageElement_ = Blockly.utils.dom.createSvgElement('image', {
                'height': '36px',
                'width': '48px',
                'y': -10,
                'x': 5
            }, this.fieldGroup_);
            this.updateImageView_();
        }

        doValueUpdate_(newValue) {
            super.doValueUpdate_(newValue);
            this.updateImageView_();
        }

        updateImageView_() {
            if (this.value_ && this.imageElement_ && this.value_ !== 'NONE') {
                 const options = this.getOptions(false);
                 const selectedOption = options.find(opt => opt[1] === this.value_);
                 if (selectedOption && typeof selectedOption[0] === 'object' && selectedOption[0].src) {
                    this.imageElement_.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', selectedOption[0].src);
                    if (this.textElement_) {
                       this.textElement_.style.display = 'none';
                    }
                }
            } else if (this.imageElement_) {
                this.imageElement_.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '');
                 if (this.textElement_) {
                   this.textElement_.style.display = 'block';
                }
            }
        }
    }
    Blockly.fieldRegistry.register('field_backdrop', FieldBackdrop);

    Blockly.Blocks['looks_switch_backdrop'] = {
        init: function() {
            this.appendDummyInput()
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/bg/bgimage.svg", 34, 34, "*"))
                .appendField(new FieldBackdrop(), 'BACKDROP')
                .appendField('\u00A0\u00A0\u00A0\u00A0\u00A0');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour("#9966FF");
            this.setTooltip("Changes the stage's backdrop.");
        }
    };
     Blockly.JavaScript['looks_switch_backdrop'] = function(block) {
        const backdropUrl = block.getFieldValue('BACKDROP');
        if (backdropUrl === '__NEXT__') {
            return `window.switchToNextBackdrop(); yield;`;
        }
        if (backdropUrl === '__RANDOM__') {
            return `window.switchToRandomBackdrop(); yield;`;
        }
        if (backdropUrl && backdropUrl !== 'NONE') {
            const safeUrl = backdropUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
            return `window.switchBackdrop('${safeUrl}'); yield;`;
        }
        return '';
    };

    Blockly.Blocks['looks_change_layer'] = {
        init: function() {
            this.appendDummyInput()
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/layers.svg", 34, 34, { alt: "layers icon", flipRtl: false }))
                .appendField(new Blockly.FieldDropdown([
                    [{ src: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='M12 19V5'/><path d='m5 12 7-7 7 7'/></svg>`, width: 24, height: 24, alt: 'One Forward' }, 'FORWARD'],
                    [{ src: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='M12 5v14'/><path d='m19 12-7 7-7-7'/></svg>`, width: 24, height: 24, alt: 'One Backward' }, 'BACKWARD'],
                    [{ src: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='m17 11-5-5-5 5'/><path d='m17 18-5-5-5 5'/></svg>`, width: 24, height: 24, alt: 'To Front' }, 'FRONT'],
                    [{ src: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='m7 13 5 5 5-5'/><path d='m7 6 5 5 5-5'/></svg>`, width: 24, height: 24, alt: 'To Back' }, 'BACK']
                ]), "ACTION")
                .appendField('\u00A0'.repeat(10));
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour("#9966FF");
            this.setTooltip("Change the layer order of the sprite.");
        }
    };

    Blockly.JavaScript['looks_change_layer'] = function(block) {
        const action = block.getFieldValue('ACTION');
        return `window.changeSpriteLayer(sprite, '${action}'); yield;`;
    };
    
    Blockly.Blocks['control_wait_secs'] = {
        init: function() {
            this.appendValueInput("SECS").setCheck("Number").appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/wait.svg", 34, 34, "*"));
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour("#FF6B1A");
            this.setTooltip("Wait for a number of seconds.");
        }
    };
    Blockly.JavaScript['control_wait_secs'] = function(block) {
        const secs = Blockly.JavaScript.valueToCode(block, 'SECS', Blockly.JavaScript.ORDER_ATOMIC) || '1';
        // Sanitize the block ID and add a random suffix to ensure the variable is unique.
        const uniqueSuffix = Math.random().toString(36).substring(2, 9);
        const varName = `endTime_${block.id.replace(/[^a-zA-Z0-9]/g, '_')}_${uniqueSuffix}`;
        return `
            log('Waiting for ' + (${secs}) + ' seconds...');
            const ${varName} = Date.now() + (${secs}) * 1000;
            while (Date.now() < ${varName}) {
                if (getExecutionCancelled()) break;
                yield;
            }
        `;
    };

    Blockly.Blocks['control_repeat_times'] = {
        init: function() {
            this.appendValueInput("TIMES")
                .setCheck("Number")
                .appendField('\u00A0\u00A0\u00A0\u00A0')
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/repeat.svg", 24, 24, "*"));
            this.appendDummyInput().appendField('\u00A0\u00A0\u00A0\u00A0\u00A0');
            this.setInputsInline(true);
            this.appendStatementInput("DO").setCheck(null);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour("#FF6B1A");
            this.setTooltip("Repeat the blocks inside a number of times.");
        }
    };
    Blockly.JavaScript['control_repeat_times'] = function(block) {
        const times = Blockly.JavaScript.valueToCode(block, 'TIMES', Blockly.JavaScript.ORDER_ATOMIC) || '10';
        const branch = Blockly.JavaScript.statementToCode(block, 'DO');
        return `
            for (let i = 0; i < (${times}); i++) {
                if (getExecutionCancelled()) break;
                log('Repetition number: ' + (i + 1));
                ${branch}
                if (getExecutionCancelled()) break;
            }
        `;
    };

    Blockly.Blocks['control_forever'] = {
        init: function() {
            this.appendDummyInput()
                .appendField('\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0')
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/forever.svg", 36, 36, "*"));
            this.appendStatementInput("DO").setCheck(null);
            this.setPreviousStatement(true, null);
            this.setColour("#FF6B1A");
            this.setTooltip("Repeat the blocks inside forever.");
        }
    };
    Blockly.JavaScript['control_forever'] = function(block) {
        const branch = Blockly.JavaScript.statementToCode(block, 'DO');
        return `
            while(!getExecutionCancelled()) {
                ${branch}
                yield;
            }
        `;
    };

    Blockly.Blocks['motion_go_to_xy'] = {
        init: function() {
            this.appendValueInput("X").setCheck("Number")
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/iconsx.svg", 24, 24, "X"));
            this.appendValueInput("Y").setCheck("Number")
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/iconsy.svg", 24, 24, "Y"));
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour("#4C97FF");
            this.setTooltip("Move the sprite to a specific location on the stage.");
        }
    };
    Blockly.JavaScript['motion_go_to_xy'] = function(block) {
        const x = Blockly.JavaScript.valueToCode(block, 'X', Blockly.JavaScript.ORDER_ATOMIC) || '0';
        const y = Blockly.JavaScript.valueToCode(block, 'Y', Blockly.JavaScript.ORDER_ATOMIC) || '0';
        return `
            if (sprite) {
                sprite.x = (${x});
                sprite.y = (${y});
                window.refreshSprite(sprite);
                log(sprite.name + ' moved to: ' + sprite.x.toFixed(0) + ', ' + sprite.y.toFixed(0));
            }
            yield;
        `;
    };
    Blockly.Blocks['motion_glide_to_xy'] = {
        init: function() {
            this.appendDummyInput()
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/surffingEmoji.svg", 34, 34, "Glide"));
            this.appendValueInput("SECS")
                .setCheck("Number")
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/wait.svg", 24, 24, "secs"));
            this.appendValueInput("X")
                .setCheck("Number")
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/iconsx.svg", 24, 24, "X"));
            this.appendValueInput("Y")
                .setCheck("Number")
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/iconsy.svg", 24, 24, "Y"));
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour("#4C97FF");
            this.setTooltip("Glide the sprite smoothly to a specific location.");
        }
    };
    Blockly.JavaScript['motion_glide_to_xy'] = function(block) {
        const secs = Blockly.JavaScript.valueToCode(block, 'SECS', Blockly.JavaScript.ORDER_ATOMIC) || '1';
        const x = Blockly.JavaScript.valueToCode(block, 'X', Blockly.JavaScript.ORDER_ATOMIC) || '0';
        const y = Blockly.JavaScript.valueToCode(block, 'Y', Blockly.JavaScript.ORDER_ATOMIC) || '0';
        return `
            if (sprite) {
                const startX = sprite.x;
                const startY = sprite.y;
                const endX = (${x});
                const endY = (${y});
                const durationMs = Math.max(0, (${secs}) * 1000);
                const startTime = Date.now();
                let elapsedTime = 0;

                while (elapsedTime < durationMs) {
                    if (getExecutionCancelled()) break;
                    
                    elapsedTime = Date.now() - startTime;
                    const progress = Math.min(1, elapsedTime / durationMs);
                    
                    sprite.x = startX + (endX - startX) * progress;
                    sprite.y = startY + (endY - startY) * progress;
                    
                    window.refreshSprite(sprite);
                    yield;
                }
                
                if (!getExecutionCancelled()) {
                    sprite.x = endX;
                    sprite.y = endY;
                    window.refreshSprite(sprite);
                    log(sprite.name + ' finished gliding.');
                }
            }
        `;
    };

    Blockly.Blocks['motion_jump'] = {
        init: function() {
            this.appendValueInput("HEIGHT")
                .setCheck("Number")
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/jump.svg", 34, 34, { alt: "jump icon", flipRtl: false }))
                .appendField('\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0');
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour("#4C97FF");
            this.setTooltip("Makes the sprite jump to a certain height.");
        }
    };

    Blockly.JavaScript['motion_jump'] = function(block) {
        const height = Blockly.JavaScript.valueToCode(block, 'HEIGHT', Blockly.JavaScript.ORDER_ATOMIC) || '100';
        return `
            if (sprite && !sprite.isJumping) {
                sprite.isJumping = true;
                const startY = sprite.y; // Store original Y position BEFORE the try block
                
                try {
                    const JUMP_HEIGHT = (${height});
                    const DURATION_MS = 500;
                    const startTime = Date.now();
                    let elapsedTime = 0;
                    log(sprite.name + ' starts jumping...');
    
                    while (elapsedTime < DURATION_MS) {
                        if (getExecutionCancelled()) {
                            break; 
                        }
                        
                        elapsedTime = Date.now() - startTime;
                        const progress = Math.min(1, elapsedTime / DURATION_MS);
                        
                        const parabolicProgress = -4 * JUMP_HEIGHT * progress * (progress - 1);
                        sprite.y = startY + parabolicProgress;
                        
                        window.refreshSprite(sprite);
                        yield;
                    }
                    
                    if (!getExecutionCancelled()) {
                        log(sprite.name + ' finished jumping.');
                    }
                } finally {
                    // This ALWAYS runs, ensuring the sprite lands correctly and the state is reset.
                    sprite.y = startY;
                    sprite.isJumping = false;
                    window.refreshSprite(sprite);
                    log(sprite.name + ' jump state reset and landed.');
                }
            } else if (sprite) {
                // If already jumping, just wait for the next tick.
                yield;
            }
        `;
    };

    Blockly.Blocks['motion_xcor'] = {
        init: function() {
            this.appendDummyInput()
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/xcor.svg", 35, 35, { alt: "x position", flipRtl: false }))
                .appendField("x");
            this.setOutput(true, "Number");
            this.setColour("#4C97FF");
            this.setTooltip("Returns the sprite's X position.");
            this.setHelpUrl("");
        }
    };
    Blockly.JavaScript['motion_xcor'] = function(block) {
        const code = 'sprite ? Math.max(-240, Math.min(240, sprite.x)) : 0';
        return [code, Blockly.JavaScript.ORDER_ATOMIC];
    };
    
    Blockly.Blocks['motion_ycor'] = {
        init: function() {
            this.appendDummyInput()
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/ycor.svg", 35, 35, { alt: "y position", flipRtl: false }))
                .appendField("y");
            this.setOutput(true, "Number");
            this.setColour("#4C97FF");
            this.setTooltip("Returns the sprite's Y position.");
            this.setHelpUrl("");
        }
    };
    Blockly.JavaScript['motion_ycor'] = function(block) {
        const code = 'sprite ? Math.max(-180, Math.min(180, sprite.y)) : 0';
        return [code, Blockly.JavaScript.ORDER_ATOMIC];
    };

    Blockly.Blocks['operator_add'] = {
        init: function() {
            this.setOutput(true, "Number");
            this.setColour("#40BF4A");
            this.setTooltip("Returns the sum of two numbers.");
            this.appendValueInput("A").setCheck("Number");
            this.appendDummyInput().appendField('+');
            this.appendValueInput("B").setCheck("Number");
            this.setInputsInline(true);
        }
    };
    Blockly.JavaScript['operator_add'] = function(block) {
        const a = Blockly.JavaScript.valueToCode(block, 'A', Blockly.JavaScript.ORDER_ADDITION) || '0';
        const b = Blockly.JavaScript.valueToCode(block, 'B', Blockly.JavaScript.ORDER_ADDITION) || '0';
        const code = `(Number(${a}) + Number(${b}))`;
        return [code, Blockly.JavaScript.ORDER_ADDITION];
    };

    Blockly.Blocks['operator_subtract'] = {
        init: function() {
            this.setOutput(true, "Number");
            this.setColour("#40BF4A");
            this.setTooltip("Returns the difference of two numbers.");
            this.appendValueInput("A").setCheck("Number");
            this.appendDummyInput().appendField('-');
            this.appendValueInput("B").setCheck("Number");
            this.setInputsInline(true);
        }
    };
    Blockly.JavaScript['operator_subtract'] = function(block) {
        const a = Blockly.JavaScript.valueToCode(block, 'A', Blockly.JavaScript.ORDER_SUBTRACTION) || '0';
        const b = Blockly.JavaScript.valueToCode(block, 'B', Blockly.JavaScript.ORDER_SUBTRACTION) || '0';
        const code = `(Number(${a}) - Number(${b}))`;
        return [code, Blockly.JavaScript.ORDER_SUBTRACTION];
    };

    Blockly.Blocks['operator_multiply'] = {
        init: function() {
            this.setOutput(true, "Number");
            this.setColour("#40BF4A");
            this.setTooltip("Returns the product of two numbers.");
            this.appendValueInput("A").setCheck("Number");
            this.appendDummyInput().appendField('*');
            this.appendValueInput("B").setCheck("Number");
            this.setInputsInline(true);
        }
    };
    Blockly.JavaScript['operator_multiply'] = function(block) {
        const a = Blockly.JavaScript.valueToCode(block, 'A', Blockly.JavaScript.ORDER_MULTIPLICATION) || '0';
        const b = Blockly.JavaScript.valueToCode(block, 'B', Blockly.JavaScript.ORDER_MULTIPLICATION) || '0';
        const code = `(Number(${a}) * Number(${b}))`;
        return [code, Blockly.JavaScript.ORDER_MULTIPLICATION];
    };

    Blockly.Blocks['operator_divide'] = {
        init: function() {
            this.setOutput(true, "Number");
            this.setColour("#40BF4A");
            this.setTooltip("Returns the quotient of two numbers.");
            this.appendValueInput("A").setCheck("Number");
            this.appendDummyInput().appendField('/');
            this.appendValueInput("B").setCheck("Number");
            this.setInputsInline(true);
        }
    };
    Blockly.JavaScript['operator_divide'] = function(block) {
        const a = Blockly.JavaScript.valueToCode(block, 'A', Blockly.JavaScript.ORDER_DIVISION) || '0';
        const b = Blockly.JavaScript.valueToCode(block, 'B', Blockly.JavaScript.ORDER_DIVISION) || '1';
        const code = `(Number(${a}) / Number(${b}))`;
        return [code, Blockly.JavaScript.ORDER_DIVISION];
    };

    Blockly.Blocks['operator_random_number'] = {
        init: function() {
            this.appendDummyInput()
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/random.svg", 34, 34, "*"))
                .appendField(new FieldCustomNumber(1), "FROM")
                .appendField(new FieldCustomNumber(10), "TO");
            this.setInputsInline(true);
            this.setOutput(true, "Number");
            this.setColour("#40BF4A");
            this.setTooltip("Returns a random integer between two numbers.");
        }
    };
    Blockly.JavaScript['operator_random_number'] = function(block) {
        const from = block.getFieldValue('FROM');
        const to = block.getFieldValue('TO');
        const code = `Math.floor(Math.random() * (Number(${to}) - Number(${from}) + 1)) + Number(${from})`;
        return [code, Blockly.JavaScript.ORDER_FUNCTION_CALL];
    };

    // Custom field for sound selection
    class FieldSound extends Blockly.FieldDropdown {
        constructor() {
            super(FieldSound.generateOptions);
        }

        static generateOptions() {
            const sprite = getActiveSprite();
            if (!sprite || !sprite.sounds || sprite.sounds.length === 0) {
                return [['(no sounds)', 'NONE']];
            }
            return sprite.sounds.map(sound => [sound.name, sound.url]);
        }
    }
    Blockly.fieldRegistry.register('field_sound', FieldSound);
    
    Blockly.Blocks['sound_play_until_done'] = {
        init: function() {
            this.appendDummyInput()
                .appendField(new Blockly.FieldImage("https://codejredu.github.io/test/assets/blocklyicon/audio.svg", 34, 34, "*"))
                .appendField(new FieldSound(), "SOUND")
                .appendField('\u00A0\u00A0\u00A0\u00A0\u00A0');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour("#CF63CF");
            this.setTooltip("Plays a sound and waits for it to finish.");
        }
    };

    Blockly.JavaScript['sound_play_until_done'] = function(block) {
        const soundUrl = block.getFieldValue('SOUND');
        if (!soundUrl || soundUrl === 'NONE') return '';
        
        const safeUrl = soundUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `
            log('Playing sound: ${safeUrl}');
            const audio = new Audio('${safeUrl}');
            let soundEnded = false;
            const endListener = () => { soundEnded = true; };
            audio.addEventListener('ended', endListener);
            audio.addEventListener('error', endListener);
            audio.play().catch(e => { console.error('Audio play failed:', e); soundEnded = true; });
            
            while (!soundEnded) {
                if (getExecutionCancelled()) {
                    audio.pause();
                    audio.removeEventListener('ended', endListener);
                    audio.removeEventListener('error', endListener);
                    break;
                }
                yield;
            }
            log('Sound finished.');
        `;
    };

    
    // Configure Blockly's angle picker to match Scratch
    // 0 is up, clockwise
    Blockly.FieldAngle.OFFSET = 90;
    Blockly.FieldAngle.CLOCKWISE = true;
    
    workspace = Blockly.inject('blockly-area', {
        toolbox: document.getElementById('toolbox'),
        rtl: false,
        zoom: {
            controls: true,
            wheel: true,
            startScale: 1.0,
            maxScale: 3,
            minScale: 0.3,
            scaleSpeed: 1.2
        },
        renderer: 'zelos',
        theme: Blockly.Themes.Scratch
    });
    
    try {
        const mainBackground = document.querySelector('#blockly-area .blocklyMainBackground');
        if (mainBackground) {
            mainBackground.setAttribute('fill', 'url(#blockly-bg-pattern)');
        }
    } catch (e) {
        console.error("Could not apply Blockly background pattern:", e);
    }
    
    const toolbox = workspace.getToolbox();
    if (toolbox) {
        // Prevent the flyout (block menu) from closing when a block is dragged out.
        // This provides a more Scratch-like experience.
        const flyout = toolbox.getFlyout();
        if (flyout) {
            flyout.autoClose = false;
        }

        // Prevent the toolbox from clearing the category selection when the workspace is clicked.
        // This keeps the currently selected category visually highlighted.
        toolbox.clearSelection = () => {
            // Do nothing, overriding the default behavior.
        };
    }

    /**
     * Handles highlighting sprite cards when a block is dragged over them.
     * This is the 'mousemove' event handler.
     * @param {MouseEvent} e The mouse move event.
     */
    function handleDragHover(e) {
        if (!isDraggingForCopy) return;

        let currentlyHoveredId = null;

        document.querySelectorAll('.sprite-card').forEach(card => {
            const cardId = card.dataset.spriteId;
            // Don't allow dropping on the source sprite.
            if (cardId === sourceSpriteIdForCopy) {
                card.classList.remove('drop-target-hover');
                return;
            }

            const rect = card.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom) {
                card.classList.add('drop-target-hover');
                currentlyHoveredId = cardId;
            } else {
                card.classList.remove('drop-target-hover');
            }
        });

        hoveredSpriteIdForDrop = currentlyHoveredId;
    }


    /**
     * Handles the drop action when the mouse is released after dragging a block.
     * This is the 'mouseup' event handler.
     */
    function handleDragEnd() {
        if (!isDraggingForCopy) return;

        if (hoveredSpriteIdForDrop) {
            const targetSprite = sprites[hoveredSpriteIdForDrop];
            if (targetSprite) {
                // This is a valid drop. Perform the copy.
                const tempWorkspace = new Blockly.Workspace();
                try {
                    // Load target's existing XML
                    if (targetSprite.workspaceXml) {
                        const dom = Blockly.Xml.textToDom(targetSprite.workspaceXml);
                        Blockly.Xml.domToWorkspace(dom, tempWorkspace);
                    }

                    // Position the new block in the center of the main workspace view
                    const metrics = workspace.getMetrics();
                    const targetX = metrics.viewLeft + metrics.viewWidth / 2;
                    const targetY = metrics.viewTop + metrics.viewHeight / 2;
                    draggedBlockXml.setAttribute('x', targetX);
                    draggedBlockXml.setAttribute('y', targetY);

                    // Add the new block
                    Blockly.Xml.domToBlock(draggedBlockXml, tempWorkspace);

                    // Save the combined XML back to the target sprite
                    const newXmlDom = Blockly.Xml.workspaceToDom(tempWorkspace);
                    targetSprite.workspaceXml = Blockly.Xml.domToText(newXmlDom);
                    log(`Script copied to ${targetSprite.name}.`);

                } catch (error) {
                    console.error("Error copying script:", error);
                } finally {
                    tempWorkspace.dispose();
                }
            }
        }

        // --- CRITICAL: Always cleanup ---
        const rightPanel = document.querySelector('.right-panel');
        rightPanel.style.position = ''; // Reset position
        rightPanel.style.zIndex = ''; // Reset z-index

        isDraggingForCopy = false;
        sourceSpriteIdForCopy = null;
        hoveredSpriteIdForDrop = null;
        draggedBlockXml = null;

        document.removeEventListener('mousemove', handleDragHover);
        document.removeEventListener('mouseup', handleDragEnd);

        // Remove any lingering hover effects
        document.querySelectorAll('.sprite-card.drop-target-hover').forEach(card => {
            card.classList.remove('drop-target-hover');
        });
    }

    workspace.addChangeListener((event) => {
        // UI events are for things like opening the toolbox, dragging blocks, etc.
        if (event.isUiEvent) {
             if (event.type === Blockly.Events.BLOCK_MOVE) {
                const numberPad = document.getElementById('number-pad-container');
                if (numberPad.style.display === 'block' && numberPad.currentField) {
                    const fieldBlockId = numberPad.currentField.getSourceBlock().id;
                    if (event.blockId === fieldBlockId) {
                        positionNumberPad(numberPad.currentField);
                    }
                }
            }

            if (event.type === Blockly.Events.BLOCK_DRAG) {
                // A drag has started
                if (event.isStart) {
                    const block = workspace.getBlockById(event.blockId);
                    // We only care about dragging top-level blocks (entire stacks)
                    if (block && !block.getParent()) {
                        const rightPanel = document.querySelector('.right-panel');
                        rightPanel.style.position = 'relative'; // Ensure z-index works
                        rightPanel.style.zIndex = '60'; // Bring to front
                        isDraggingForCopy = true;
                        sourceSpriteIdForCopy = activeSpriteId;
                        draggedBlockXml = Blockly.Xml.blockToDom(block);
                        
                        // Attach global listeners to track mouse outside the workspace
                        document.addEventListener('mousemove', handleDragHover);
                        document.addEventListener('mouseup', handleDragEnd);
                    }
                }
                // The handleDragEnd function will be called on mouseup for cleanup.
                // This is simpler and more reliable than trying to use the drag 'end' event.
            }
            return; // Don't save workspace on UI events
        }
        // Any other event (create, delete, change) is a real model change
        saveActiveSpriteWorkspace();
    });

    const getExecutionCancelled = () => executionCancelled;

    function showBlockValue(block) {
        // Generate code for the single block
        const codeArray = Blockly.JavaScript.blockToCode(block);
        if (!codeArray || typeof codeArray[0] !== 'string') return;

        const expression = codeArray[0];
        let value;
        try {
            // Safely evaluate the expression
            value = new Function('sprite', 'return ' + expression)(getActiveSprite());
            // Round if it's a number with many decimals
            if (typeof value === 'number') {
                value = Math.round(value * 1000) / 1000;
            }
        } catch (e) {
            console.log("Could not evaluate block value:", e);
            value = '?'; // Show a question mark on error
        }

        // Create and position the bubble
        const bubble = document.createElement('div');
        bubble.className = 'value-bubble';
        bubble.textContent = value;
        document.body.appendChild(bubble);

        const rect = block.getSvgRoot().getBoundingClientRect();
        
        // Position bubble centered above the block
        bubble.style.left = `${rect.left + rect.width / 2}px`;
        bubble.style.top = `${rect.top}px`;
        
        // Trigger the fade in
        setTimeout(() => {
            bubble.style.opacity = '1';
        }, 10);


        // Fade out and remove the bubble
        setTimeout(() => {
            bubble.style.opacity = '0';
            setTimeout(() => {
                if (bubble.parentElement) {
                    bubble.remove();
                }
            }, 400); // Wait for fade-out animation
        }, 1200); // Display for 1.2 seconds
    }

    function createGeneratorForStack(startBlock, sprite) {
        let code = '';
        let currentBlock = startBlock.getNextBlock();
        while (currentBlock) {
            code += Blockly.JavaScript.blockToCode(currentBlock);
            if (getExecutionCancelled()) break;
            currentBlock = currentBlock.getNextBlock();
        }

        if (!code) return null;

        // The generated code will access window.frameDeltaTime, which is updated every tick.
        const GeneratorFunction = Object.getPrototypeOf(function*(){}).constructor;
        const func = new GeneratorFunction('sprite', 'log', 'getExecutionCancelled', 'window', code);
        
        return func(sprite, log, getExecutionCancelled, window);
    }

    function runScriptStack(startBlock) {
        saveActiveSpriteWorkspace();
        const sprite = getActiveSprite();
        if (!sprite) {
            log("No active sprite to run script.");
            return;
        }
        
        const generator = createGeneratorForStack(startBlock, sprite);
        if (generator) {
            if (!scriptRunner || !scriptRunner.isRunning) {
                 scriptRunner = new ScriptRunner(stopAllScripts);
                 document.getElementById('run-button').classList.add('hidden');
                 document.getElementById('reset-button').classList.remove('hidden');
                 fullscreenRunButton.classList.add('hidden');
                 fullscreenResetButton.classList.remove('hidden');
            }
            scriptRunner.add(generator);
        }
    }

    function createGeneratorFromBlock(startBlock, sprite) {
        let code = '';
        let currentBlock = startBlock; // Start WITH the clicked block
        while (currentBlock) {
            code += Blockly.JavaScript.blockToCode(currentBlock);
            if (getExecutionCancelled()) break;
            currentBlock = currentBlock.getNextBlock();
        }

        if (!code) return null;

        const GeneratorFunction = Object.getPrototypeOf(function*(){}).constructor;
        const func = new GeneratorFunction('sprite', 'log', 'getExecutionCancelled', 'window', code);
        
        return func(sprite, log, getExecutionCancelled, window);
    }
    
    function runScriptFromBlock(startBlock) {
        saveActiveSpriteWorkspace();
        const sprite = getActiveSprite();
        if (!sprite) {
            log("No active sprite to run script.");
            return;
        }
        
        const generator = createGeneratorFromBlock(startBlock, sprite);
        if (generator) {
            if (!scriptRunner || !scriptRunner.isRunning) {
                 scriptRunner = new ScriptRunner(stopAllScripts);
                 document.getElementById('run-button').classList.add('hidden');
                 document.getElementById('reset-button').classList.remove('hidden');
                 fullscreenRunButton.classList.add('hidden');
                 fullscreenResetButton.classList.remove('hidden');
            }
            scriptRunner.add(generator);
        }
    }
    
    const blocklyDiv = document.getElementById('blockly-area');
    blocklyDiv.addEventListener('click', (event) => {
        const blocklyBlockSvg = event.target.closest('.blocklyDraggable');
        if (!blocklyBlockSvg) return;
        const blockId = blocklyBlockSvg.getAttribute('data-id');
        if (!blockId) return;
        const block = workspace.getBlockById(blockId);
        if (!block) return;

        // If it's a reporter block (has an output), show its value.
        if (block.outputConnection) {
            showBlockValue(block);
            return;
        }

        // If it's a "hat" block (starts a script), run the stack below it.
        // A hat block has a next connection but no previous connection.
        if (!block.previousConnection && block.nextConnection) {
            runScriptStack(block);
        } 
        // For any other command block (regular, terminator, or standalone),
        // run the script starting from this block itself.
        else {
            runScriptFromBlock(block);
        }
    });

    document.getElementById('run-button').addEventListener('click', runCode);
    document.getElementById('reset-button').addEventListener('click', stopAllScripts);
    fullscreenRunButton.addEventListener('click', runCode);
    fullscreenResetButton.addEventListener('click', stopAllScripts);
    
    fullscreenButton.addEventListener('click', () => {
        containerWrapper.classList.toggle('stage-expanded');
        const isExpanded = containerWrapper.classList.contains('stage-expanded');
        
        enterFullscreenIcon.classList.toggle('hidden', isExpanded);
        exitFullscreenIcon.classList.toggle('hidden', !isExpanded);
        
        if (isExpanded) {
            fullscreenButton.title = 'Exit Fullscreen';
        } else {
            fullscreenButton.title = 'Fullscreen';
        }
        
        setTimeout(() => {
            window.dispatchEvent(new Event('resize')); 
        }, 300);
    });

    let gridIsDrawn = false;
    function drawGrid() {
        if (gridIsDrawn) return;

        const ctx = gridCanvas.getContext('2d');
        const width = STAGE_WIDTH;
        const height = STAGE_HEIGHT;
        gridCanvas.width = width;
        gridCanvas.height = height;

        const centerX = width / 2;
        const centerY = height / 2;
        const step = 40;

        ctx.clearRect(0, 0, width, height);

        // Grid lines
        ctx.strokeStyle = '#dddddd';
        ctx.lineWidth = 0.5;
        for (let x = centerX + step; x < width; x += step) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
        for (let x = centerX - step; x > 0; x -= step) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
        for (let y = centerY + step; y < height; y += step) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }
        for (let y = centerY - step; y > 0; y -= step) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }

        // Axes
        ctx.strokeStyle = '#aaaaaa';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(centerX, 0); ctx.lineTo(centerX, height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, centerY); ctx.lineTo(width, centerY); ctx.stroke();

        // Labels
        ctx.fillStyle = '#555555';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.fillText('0', centerX + 15, centerY + 15);
        ctx.textAlign = 'right';
        ctx.fillText(String(STAGE_WIDTH / 2), width - 5, centerY + 15);
        ctx.textAlign = 'left';
        ctx.fillText(String(-STAGE_WIDTH / 2), 5, centerY + 15);
        ctx.textAlign = 'center';
        ctx.fillText(String(STAGE_HEIGHT / 2), centerX + 20, 15);
        ctx.fillText(String(-STAGE_HEIGHT / 2), centerX + 25, height - 15);
        
        gridIsDrawn = true;
    }

    toggleGridButton.addEventListener('click', () => {
        const isVisible = !gridCanvas.classList.contains('hidden');
        if (isVisible) {
            gridCanvas.classList.add('hidden');
            toggleGridButton.classList.remove('active');
            toggleGridButton.title = 'Show Grid';
        } else {
            drawGrid(); // Will only draw once
            gridCanvas.classList.remove('hidden');
            toggleGridButton.classList.add('active');
            toggleGridButton.title = 'Hide Grid';
        }
    });


    function saveActiveSpriteWorkspace() {
         if (activeSpriteId && sprites[activeSpriteId]) {
            const dom = Blockly.Xml.workspaceToDom(workspace);
            sprites[activeSpriteId].workspaceXml = Blockly.Xml.domToText(dom);
        }
    }
    
    function runCode() {
        if (scriptRunner && scriptRunner.isRunning) {
            log('Script already running. Press stop before running again.');
            return;
        }

        saveActiveSpriteWorkspace();

        const scriptsToRun = [];
        Object.values(sprites).forEach(sprite => {
            if (sprite.workspaceXml) {
                const tempWorkspace = new Blockly.Workspace();
                try {
                    Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(sprite.workspaceXml), tempWorkspace);
                    const topBlocks = tempWorkspace.getTopBlocks(true);
                    const flagClickScripts = topBlocks.filter(block => block.type === 'event_when_flag_clicked');
                    
                    flagClickScripts.forEach(startBlock => {
                       const generator = createGeneratorForStack(startBlock, sprite);
                       if (generator) {
                           scriptsToRun.push(generator);
                       }
                    });
                } finally {
                    tempWorkspace.dispose();
                }
            }
        });

        if (scriptsToRun.length > 0) {
            log('Script started.');
            document.getElementById('run-button').classList.add('hidden');
            document.getElementById('reset-button').classList.remove('hidden');
            fullscreenRunButton.classList.add('hidden');
            fullscreenResetButton.classList.remove('hidden');
            
            scriptRunner = new ScriptRunner(stopAllScripts);
            
            Object.values(sprites).forEach(sprite => {
                if (sprite.isGif && sprite.animation) {
                    sprite.animation.isPlaying = true;
                    sprite.animation.previewIsPlaying = false;
                    sprite.animation.currentFrame = 0;
                    updatePropertiesPanel();
                }
            });
            
            scriptsToRun.forEach(generator => scriptRunner.add(generator));
        } else {
            log('No scripts starting with green flag were found.');
        }
    }
    
    window.addEventListener('kidi-broadcast', (e) => {
        const message = e.detail.message;
        log(`Received message: ${message}`);
        runBroadcastScripts(message);
    });

    function runBroadcastScripts(message) {
        saveActiveSpriteWorkspace();
        
        const scriptsToRun = [];
        Object.values(sprites).forEach(sprite => {
            if (!sprite.workspaceXml) return;
            
            const tempWorkspace = new Blockly.Workspace();
            try {
                Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(sprite.workspaceXml), tempWorkspace);
                const topBlocks = tempWorkspace.getTopBlocks(true);
                
                const matchingHatBlocks = topBlocks.filter(block => 
                    block.type === 'event_when_broadcast_received' && 
                    block.getFieldValue('MESSAGE') === message &&
                    block.getNextBlock() // Ensure it has attached blocks
                );
                
                matchingHatBlocks.forEach(startBlock => {
                    const generator = createGeneratorForStack(startBlock, sprite);
                    if(generator) scriptsToRun.push(generator);
                });
            } catch (err) {
                console.error("Error processing workspace for broadcast:", err);
            } finally {
                tempWorkspace.dispose();
            }
        });

        if (scriptsToRun.length > 0) {
            if (!scriptRunner || !scriptRunner.isRunning) {
                scriptRunner = new ScriptRunner(stopAllScripts);
                document.getElementById('run-button').classList.add('hidden');
                document.getElementById('reset-button').classList.remove('hidden');
                fullscreenRunButton.classList.add('hidden');
                fullscreenResetButton.classList.remove('hidden');
            }
            scriptsToRun.forEach(gen => scriptRunner.add(gen));
        }
    }

    function handleSpriteClick(spriteId) {
        saveActiveSpriteWorkspace();
        const sprite = sprites[spriteId];
        if (!sprite || !sprite.workspaceXml) return;
    
        const scriptsToRun = [];
        const tempWorkspace = new Blockly.Workspace();
        try {
            Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(sprite.workspaceXml), tempWorkspace);
            const topBlocks = tempWorkspace.getTopBlocks(true);
            const clickScripts = topBlocks.filter(block => 
                block.type === 'event_when_sprite_clicked' && block.getNextBlock()
            );
    
            clickScripts.forEach(startBlock => {
                const generator = createGeneratorForStack(startBlock, sprite);
                if (generator) {
                    scriptsToRun.push(generator);
                }
            });
        } catch (e) {
            console.error("Error checking for sprite click scripts:", e);
        } finally {
            tempWorkspace.dispose();
        }

        if (scriptsToRun.length > 0) {
            if (!scriptRunner || !scriptRunner.isRunning) {
                scriptRunner = new ScriptRunner(stopAllScripts);
                document.getElementById('run-button').classList.add('hidden');
                document.getElementById('reset-button').classList.remove('hidden');
                fullscreenRunButton.classList.add('hidden');
                fullscreenResetButton.classList.remove('hidden');
            }
            scriptsToRun.forEach(gen => scriptRunner.add(gen));
        }
    }
    
     // --- Collision Detection and Handling ---
    function checkCollisions() {
        if (isLoadingProject) return;

        const spriteIds = Object.keys(sprites);
        if (spriteIds.length < 2) return;

        for (let i = 0; i < spriteIds.length; i++) {
            for (let j = i + 1; j < spriteIds.length; j++) {
                const id1 = spriteIds[i];
                const id2 = spriteIds[j];
                
                const el1 = document.getElementById(id1);
                const el2 = document.getElementById(id2);
                
                if (!el1 || !el2 || sprites[id1].opacity === 0 || sprites[id2].opacity === 0) continue;
                
                const rect1 = el1.getBoundingClientRect();
                const rect2 = el2.getBoundingClientRect();

                const isColliding = !(rect1.right < rect2.left || 
                                      rect1.left > rect2.right || 
                                      rect1.bottom < rect2.top || 
                                      rect1.top > rect2.bottom);
                
                const collisionKey = [id1, id2].sort().join('-');

                if (isColliding) {
                    if (!collisionState.has(collisionKey)) {
                        collisionState.add(collisionKey);
                        log(`Collision between ${sprites[id1].name} and ${sprites[id2].name}`);
                        triggerBumpScripts(id1, id2);
                    }
                } else {
                    if (collisionState.has(collisionKey)) {
                        collisionState.delete(collisionKey);
                        log(`${sprites[id1].name} and ${sprites[id2].name} separated.`);
                    }
                }
            }
        }
    }

    function triggerBumpScripts(id1, id2) {
        saveActiveSpriteWorkspace();
        
        const scriptsToRun = [];

        const findScriptsForSprite = (spriteToCheck, otherSpriteId) => {
            if (!spriteToCheck.workspaceXml) return;
            const tempWorkspace = new Blockly.Workspace();
            try {
                Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(spriteToCheck.workspaceXml), tempWorkspace);
                const bumpScripts = tempWorkspace.getTopBlocks(true).filter(block => 
                    block.type === 'event_when_bump' && block.getNextBlock()
                );
                
                bumpScripts.forEach(scriptBlock => {
                    const targetSpriteId = scriptBlock.getFieldValue('TARGET_SPRITE');
                    if (targetSpriteId === 'ANY' || targetSpriteId === otherSpriteId) {
                        const generator = createGeneratorForStack(scriptBlock, spriteToCheck);
                        if (generator) scriptsToRun.push(generator);
                    }
                });
            } catch (e) {
                console.error("Error processing bump script workspace", e);
            } finally {
                tempWorkspace.dispose();
            }
        };

        findScriptsForSprite(sprites[id1], id2);
        findScriptsForSprite(sprites[id2], id2);

        if (scriptsToRun.length > 0) {
            if (!scriptRunner || !scriptRunner.isRunning) {
                scriptRunner = new ScriptRunner(stopAllScripts);
                document.getElementById('run-button').classList.add('hidden');
                document.getElementById('reset-button').classList.remove('hidden');
                fullscreenRunButton.classList.add('hidden');
                fullscreenResetButton.classList.remove('hidden');
            }
            scriptsToRun.forEach(gen => scriptRunner.add(gen));
        }
    }

    function handleKeyPress(event) {
        saveActiveSpriteWorkspace();

        const keyMap = { 'SPACE': ' ', 'UP': 'ArrowUp', 'DOWN': 'ArrowDown', 'RIGHT': 'ArrowRight', 'LEFT': 'ArrowLeft' };
        const pressedKey = event.key;
        
        const scriptsToRun = [];
        Object.values(sprites).forEach(sprite => {
            if (sprite.workspaceXml) {
                const tempWorkspace = new Blockly.Workspace();
                try {
                    Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(sprite.workspaceXml), tempWorkspace);
                    const topBlocks = tempWorkspace.getTopBlocks(true);
                    
                    const matchingScripts = topBlocks.filter(block => 
                        block.type === 'event_when_key_pressed' && 
                        keyMap[block.getFieldValue('KEY')] === pressedKey &&
                        block.getNextBlock()
                    );

                    matchingScripts.forEach(startBlock => {
                        const generator = createGeneratorForStack(startBlock, sprite);
                        if (generator) scriptsToRun.push(generator);
                    });
                } catch(e) {
                    console.error("Error in handleKeyPress workspace processing:", e);
                } finally {
                    tempWorkspace.dispose();
                }
            }
        });

        if (scriptsToRun.length > 0) {
            if (!scriptRunner || !scriptRunner.isRunning) {
                scriptRunner = new ScriptRunner(stopAllScripts);
                document.getElementById('run-button').classList.add('hidden');
                document.getElementById('reset-button').classList.remove('hidden');
                fullscreenRunButton.classList.add('hidden');
                fullscreenResetButton.classList.remove('hidden');
            }
            scriptsToRun.forEach(gen => scriptRunner.add(gen));
        }
    }
    document.addEventListener('keydown', handleKeyPress);

    function stopAllScripts() {
        if (scriptRunner) {
            log('Stopping all scripts.');
            scriptRunner.isRunning = false;
            scriptRunner.stop();
        }
        
        Object.values(sprites).forEach(sprite => {
            const bubble = document.querySelector(`#container-${sprite.id} .speech-bubble`);
            if (bubble) bubble.classList.remove('visible');

            if (sprite.isGif && sprite.animation) {
                sprite.animation.isPlaying = false;
                sprite.animation.previewIsPlaying = false;
                sprite.animation.currentFrame = 0;
                drawGifFrame(sprite);
            }
            
            sprite.isJumping = false; // Fail-safe to reset jump state for all sprites
        });

        if (currentPreviewAudio) {
            currentPreviewAudio.pause();
            currentPreviewAudio = null;
        }

        updatePropertiesPanel(); // To update play/pause button state
        
        document.getElementById('run-button').classList.remove('hidden');
        document.getElementById('reset-button').classList.add('hidden');
        fullscreenRunButton.classList.remove('hidden');
        fullscreenResetButton.classList.add('hidden');
    }

    function deleteBackdrop(cardElement) {
        const urlToDelete = cardElement.dataset.url;
        const currentBackdropUrl = stageArea.style.backgroundImage.replace(/url\((['"])?(.*?)\1\)/, '$2');

        const allBackdrops = document.querySelectorAll('#backdrops-list .backdrop-card');
        if (allBackdrops.length <= 1) {
            alert("Cannot delete the last backdrop.");
            return;
        }

        cardElement.remove();

        if (urlToDelete === currentBackdropUrl) {
            const firstRemainingBackdrop = document.querySelector('#backdrops-list .backdrop-card');
            if (firstRemainingBackdrop) {
                window.switchBackdrop(firstRemainingBackdrop.dataset.url);
            } else {
                stageArea.style.backgroundImage = 'none';
            }
        }
         Blockly.getMainWorkspace().refreshToolboxSelection();
    }
    
    function createBackdropCard(url) {
        const card = document.createElement('div');
        card.classList.add('backdrop-card');
        card.style.backgroundImage = `url("${url}")`;
        card.dataset.url = url;

        const deleteBtn = document.createElement('div');
        deleteBtn.classList.add('delete-button');
        deleteBtn.textContent = 'X';
        card.appendChild(deleteBtn);

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteBackdrop(card);
        });

        backdropsList.appendChild(card);
        return card;
    }
    
    function createDefaultBackdrop() {
        const url = "https://codejredu.github.io/test/assets/bg/farm.svg";
        const card = createBackdropCard(url);
        card.classList.add('selected');
        stageArea.style.backgroundImage = `url("${url}")`;
    }

    function createDefaultSprite() {
        const defaultSprite = createNewSprite('Cat', 'https://codejredu.github.io/claudejr/GingerCat.svg', 0, 0);
    }

    function handleBackdropSelection(e) {
        const card = e.target.closest('.backdrop-card');
        if (card && e.target !== card.querySelector('.delete-button')) {
            const url = card.dataset.url;
            if (url) {
               window.switchBackdrop(url);
            }
        }
    }

    function handleGallerySelection(e) {
        const url = e.target.src;
        if (url) {
            const newCard = createBackdropCard(url);
            window.switchBackdrop(url);
            backgroundGallery.classList.remove('visible');
        }
    }

    function handleSpriteGallerySelection(e) {
        const target = e.target;
        if (target.tagName === 'IMG' && target.classList.contains('thumbnail')) {
            const url = target.src;
            const name = target.alt || 'New Sprite';
            createNewSprite(name, url, 0, 0);
            spriteGallery.classList.remove('visible');
            stopAllScripts(); // Reset UI state after adding a sprite.
        }
    }
    
    // Number Pad Logic
    const numberPad = document.getElementById('number-pad-container');
    const numberPadDisplay = document.getElementById('number-pad-display');
    const numberPadGrid = numberPad.querySelector('.number-pad-grid');
    const numberPadDone = document.getElementById('number-pad-done');
    
    numberPadGrid.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const value = e.target.dataset.value;
            let currentDisplay = numberPadDisplay.textContent;

            if (value === 'backspace') {
                numberPadDisplay.textContent = currentDisplay.slice(0, -1);
            } else if (value === '-') {
                if (currentDisplay.startsWith('-')) {
                    numberPadDisplay.textContent = currentDisplay.substring(1);
                } else {
                    numberPadDisplay.textContent = '-' + currentDisplay;
                }
            } else {
                // Prevent multiple decimals
                if (value === '.' && currentDisplay.includes('.')) return;
                numberPadDisplay.textContent += value;
            }
        }
    });

    numberPadDone.addEventListener('click', () => {
        const field = numberPad.currentField;
        if (field) {
            let newValue = parseFloat(numberPadDisplay.textContent);
            if (isNaN(newValue)) {
                newValue = field.getValue(); // Revert to old value if input is invalid
            }
            field.setValue(newValue);
        }
        numberPad.style.display = 'none';
        numberPad.currentField = null;
    });
    
    // Hide number pad when clicking outside
    document.addEventListener('click', (e) => {
        // If the click is not on the number pad and not on a blockly field
        if (numberPad.style.display === 'block' && !numberPad.contains(e.target) && !e.target.closest('.blocklyDraggable')) {
            numberPadDone.click();
        }
    }, true);
    
    // --- Save/Load Project Logic ---
    const saveProject = () => {
        if (activeSpriteId && sprites[activeSpriteId]) {
            const dom = Blockly.Xml.workspaceToDom(workspace);
            sprites[activeSpriteId].workspaceXml = Blockly.Xml.domToText(dom);
        }
        const backdrops = Array.from(document.querySelectorAll('#backdrops-list .backdrop-card')).map(card => card.dataset.url);
        const currentBackdrop = stageArea.style.backgroundImage.replace(/url\((['"])?(.*?)\1\)/, '$2');
        
        // Create a serializable version of sprites
        const serializableSprites = {};
        for (const id in sprites) {
            const { animation, ...rest } = sprites[id]; // Exclude non-serializable animation object
            serializableSprites[id] = rest;
        }

        const projectData = {
            sprites: serializableSprites,
            backdrops: backdrops,
            currentBackdrop: currentBackdrop
        };

        const dataStr = JSON.stringify(projectData, null, 2);
        const dataBlob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(dataBlob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'kidi-project.kidi';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        log('Project saved.');
    };

    const loadSpriteFromData = (spriteData) => {
        const { id, name, imageUrl, x, y, direction, opacity, size, rotationStyle, isCustom, characterData, isGif, gifSpeed, sounds, zIndex } = spriteData;

        spriteData.size = size || 100;
        spriteData.rotationStyle = rotationStyle || 'all-around'; // Add for compatibility
        spriteData.isGif = isGif || false;
        spriteData.gifSpeed = gifSpeed || 1.0;
        spriteData.animation = null; // Will be loaded async
        spriteData.sounds = sounds || [];
        spriteData.isJumping = false; // Runtime state, always reset on load
        spriteData.zIndex = zIndex || nextZIndex++; // Use loaded zIndex or assign a new one
        spriteData.speed = spriteData.speed || 'instant';
        sprites[id] = spriteData;

        createAndAttachSpriteCard(spriteData);
        
        const spriteContainer = document.createElement('div');
        spriteContainer.id = `container-${id}`;
        spriteContainer.classList.add('sprite-container');
        const mainSprite = document.createElement('div');
        mainSprite.classList.add('sprite-wrapper');
        mainSprite.id = id;
        mainSprite.innerHTML = `
            <img src="${imageUrl}" alt="${name}">
            <canvas class="hidden absolute top-0 left-0 w-full h-full"></canvas>
            <div class="speech-bubble"></div>
        `;
        
        spriteContainer.appendChild(mainSprite);
        stageArea.appendChild(spriteContainer);

        if (spriteData.isGif) {
            loadGifData(spriteData);
        }
        
        const wrapper = spriteContainer.querySelector('.sprite-wrapper');
        wrapper.addEventListener('mousedown', (e) => handleSpriteMouseDown(e, id));
        wrapper.addEventListener('touchstart', (e) => handleSpriteMouseDown(e, id), { passive: false });

        updateSpriteAppearance(id);
    };

    const loadProject = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        isLoadingProject = true; // Set flag before loading

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const projectData = JSON.parse(event.target.result);

                // Robust check for valid project structure
                if (typeof projectData !== 'object' || projectData === null || 
                    typeof projectData.sprites !== 'object' || projectData.sprites === null || 
                    !Array.isArray(projectData.backdrops)) {
                    throw new Error("Invalid project file.");
                }
                
                stopAllScripts();
                Object.keys(sprites).forEach(id => {
                    document.getElementById(`container-${id}`)?.remove();
                    document.querySelector(`.sprite-card[data-sprite-id="${id}"]`)?.remove();
                });

                sprites = {};
                activeSpriteId = null;
                workspace.clear();
                backdropsList.innerHTML = '';
                nextZIndex = 10;
                
                projectData.backdrops.forEach(createBackdropCard);

                window.switchBackdrop(projectData.currentBackdrop);

                let maxZ = 9;
                Object.values(projectData.sprites).forEach(spriteData => {
                    loadSpriteFromData(spriteData);
                    if (spriteData.zIndex && spriteData.zIndex > maxZ) {
                        maxZ = spriteData.zIndex;
                    }
                });
                nextZIndex = maxZ + 1;
                
                const firstSpriteId = Object.keys(projectData.sprites)[0];
                if (firstSpriteId) {
                    setActiveSprite(firstSpriteId);
                }
                
                log('Project loaded successfully.');

            } catch (error) {
                console.error("Error loading project:", error);
                alert("Error loading project:\n" + error.message);
            } finally {
                e.target.value = null;
                setTimeout(() => { isLoadingProject = false; }, 100); // Unset flag after a short delay
            }
        };
         reader.onerror = () => {
            console.error("Error reading file.");
            isLoadingProject = false; // Unset flag on error
        };
        reader.readAsText(file);
    };

    saveButton.addEventListener('click', saveProject);
    loadButton.addEventListener('click', () => loadInput.click());
    loadInput.addEventListener('change', loadProject);


    // --- Properties Panel Listeners ---
    function setupPropertiesPanelListeners() {
        propName.addEventListener('change', (e) => {
            const sprite = getActiveSprite();
            if (sprite) sprite.name = e.target.value;
        });
        propX.addEventListener('change', (e) => {
            const sprite = getActiveSprite();
            if (sprite) {
                sprite.x = Number(e.target.value);
                window.refreshSprite(sprite);
            }
        });
        propY.addEventListener('change', (e) => {
            const sprite = getActiveSprite();
            if (sprite) {
                sprite.y = Number(e.target.value);
                window.refreshSprite(sprite);
            }
        });
        propSize.addEventListener('change', (e) => {
            const sprite = getActiveSprite();
            if (sprite) {
                sprite.size = Number(e.target.value);
                window.refreshSprite(sprite);
            }
        });
        
        propDirection.addEventListener('change', (e) => {
            const sprite = getActiveSprite();
            if (sprite) {
                sprite.direction = Number(e.target.value);
                window.refreshSprite(sprite);
            }
        });
        
        propDirection.addEventListener('click', (e) => {
            e.stopPropagation();
            const sprite = getActiveSprite();
            if (!sprite) return;
            
            anglePickerWidget.style.display = 'flex';
            const inputRect = propDirection.getBoundingClientRect();
            const widgetWidth = anglePickerWidget.offsetWidth;
            const widgetHeight = anglePickerWidget.offsetHeight;

            let left = inputRect.left - widgetWidth - 10;
            let top = inputRect.top + (inputRect.height / 2) - (widgetHeight / 2);

            if (left < 5) { 
                left = inputRect.left + (inputRect.width / 2) - (widgetWidth / 2);
                top = inputRect.bottom + 5;
            }
             if (top < 5) top = 5;
            if (top + widgetHeight > window.innerHeight) top = window.innerHeight - widgetHeight - 5;
            
            anglePickerWidget.style.left = `${left}px`;
            anglePickerWidget.style.top = `${top}px`;

            const currentAngleRad = (sprite.direction - 90) * Math.PI / 180;
            anglePickerHandle.style.transform = `rotate(${currentAngleRad}rad)`;
            
            const onAngleDrag = (moveEvent) => {
                moveEvent.preventDefault();
                const dialRect = anglePickerDial.getBoundingClientRect();
                const centerX = dialRect.left + dialRect.width / 2;
                const centerY = dialRect.top + dialRect.height / 2;
                const pointer = moveEvent.touches ? moveEvent.touches[0] : moveEvent;
                const angleRad = Math.atan2(pointer.clientY - centerY, pointer.clientX - centerX);
                let angleDeg = angleRad * 180 / Math.PI;

                let newDirection = Math.round(angleDeg + 90);
                if (newDirection < 0) newDirection += 360;

                sprite.direction = newDirection;
                propDirection.value = newDirection;
                anglePickerHandle.style.transform = `rotate(${angleRad}rad)`;
                window.refreshSprite(sprite);
            };

            const onAngleDragEnd = () => {
                document.removeEventListener('mousemove', onAngleDrag);
                document.removeEventListener('mouseup', onAngleDragEnd);
                document.removeEventListener('touchmove', onAngleDrag);
                document.removeEventListener('touchend', onAngleDragEnd);
            };

            anglePickerDial.addEventListener('mousedown', (downEvent) => {
                onAngleDrag(downEvent); // Set initial angle
                document.addEventListener('mousemove', onAngleDrag);
                document.addEventListener('mouseup', onAngleDragEnd, { once: true });
            });
            anglePickerDial.addEventListener('touchstart', (downEvent) => {
                onAngleDrag(downEvent); // Set initial angle
                document.addEventListener('touchmove', onAngleDrag, { passive: false });
                document.addEventListener('touchend', onAngleDragEnd, { once: true });
            }, { passive: false });
            
            // Hide on next click anywhere
            const hideOnClickOutside = (event) => {
                if (!anglePickerWidget.contains(event.target) && event.target !== propDirection) {
                    anglePickerWidget.style.display = 'none';
                    document.removeEventListener('click', hideOnClickOutside, true);
                }
            };
            setTimeout(() => document.addEventListener('click', hideOnClickOutside, true), 0);
        });

        propShow.addEventListener('click', () => {
            const sprite = getActiveSprite();
            if(sprite) {
                sprite.opacity = 1;
                window.refreshSprite(sprite);
            }
        });

        propHide.addEventListener('click', () => {
            const sprite = getActiveSprite();
            if(sprite) {
                sprite.opacity = 0;
                window.refreshSprite(sprite);
            }
        });

        const setRotationStyle = (style) => {
            const sprite = getActiveSprite();
            if (sprite) {
                sprite.rotationStyle = style;
                window.refreshSprite(sprite);
            }
        };

        propRotationAllAround.addEventListener('click', () => setRotationStyle('all-around'));
        propRotationLeftRight.addEventListener('click', () => setRotationStyle('left-right'));
        propRotationDontRotate.addEventListener('click', () => setRotationStyle('dont-rotate'));

        gifPlayPauseBtn.addEventListener('click', () => {
            const sprite = getActiveSprite();
            if (sprite && sprite.animation) {
                sprite.animation.previewIsPlaying = !sprite.animation.previewIsPlaying;
                updatePropertiesPanel();
            }
        });

        gifSpeedSlider.addEventListener('input', (e) => {
            const sprite = getActiveSprite();
            const speed = Number(e.target.value);
            if (sprite) {
                sprite.gifSpeed = speed;
                gifSpeedValue.textContent = `${speed.toFixed(1)}x`;
            }
        });

        scrollUpBtn.addEventListener('click', () => {
            leftPanel.scrollTo({ top: 0, behavior: 'smooth' });
        });

        scrollDownBtn.addEventListener('click', () => {
            leftPanel.scrollTo({ top: leftPanel.scrollHeight, behavior: 'smooth' });
        });
    }

    function setupGalleryListeners() {
        document.getElementById('add-sprite-button').addEventListener('click', () => openGallery(spriteGallery));
        document.getElementById('add-backdrop-button').addEventListener('click', () => openGallery(backgroundGallery));
        document.getElementById('add-sound-button').addEventListener('click', () => {
            selectedSoundsForAdd.clear();
            updateSoundGallerySelection();
            openGallery(soundGallery);
        });

        document.getElementById('close-sprite-gallery-button').addEventListener('click', () => spriteGallery.classList.remove('visible'));
        document.getElementById('close-gallery-button').addEventListener('click', () => backgroundGallery.classList.remove('visible'));
        closeSoundGalleryButton.addEventListener('click', () => soundGallery.classList.remove('visible'));

        document.getElementById('sprite-thumbnails-grid').addEventListener('click', handleSpriteGallerySelection);
        document.getElementById('thumbnails-grid').addEventListener('click', handleGallerySelection);
        backdropsList.addEventListener('click', handleBackdropSelection);
        
        const spriteUploadInput = document.getElementById('sprite-upload-input');
        const uploadSpriteBtn = document.getElementById('upload-sprite-header-button');
        uploadSpriteBtn.addEventListener('click', () => spriteUploadInput.click());
        spriteUploadInput.addEventListener('change', (e) => {
             const file = e.target.files[0];
             if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const name = file.name.split('.')[0];
                    createNewSprite(name, event.target.result);
                    spriteGallery.classList.remove('visible');
                    stopAllScripts(); // Reset UI state after adding a sprite.
                };
                reader.readAsDataURL(file);
             }
             e.target.value = null;
        });

        const backdropUploadInput = document.getElementById('backdrop-upload-input');
        const uploadBackdropBtn = document.getElementById('upload-backdrop-header-button');
        uploadBackdropBtn.addEventListener('click', () => backdropUploadInput.click());
        backdropUploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if(file) {
                 const reader = new FileReader();
                 reader.onload = (event) => {
                    const newCard = createBackdropCard(event.target.result);
                    window.switchBackdrop(event.target.result);
                    backgroundGallery.classList.remove('visible');
                 };
                 reader.readAsDataURL(file);
            }
            e.target.value = null;
        });
    }

    async function loadGifData(sprite) {
        try {
            const response = await fetch(sprite.imageUrl);
            const arrayBuffer = await response.arrayBuffer();
            const parsedGif = parseGIF(arrayBuffer);

            sprite.animation = {
                frames: parsedGif.frames,
                width: parsedGif.width,
                height: parsedGif.height,
                currentFrame: 0,
                isPlaying: false,
                previewIsPlaying: false,
                timeSinceLastFrame: 0,
                imageData: null, 
            };
            
            const container = document.querySelector(`#container-${sprite.id}`);
            if (container) {
                const canvas = container.querySelector('canvas');
                const img = container.querySelector('img');
                if (canvas && img) {
                    img.classList.add('hidden'); // Hide the original img
                    canvas.classList.remove('hidden');
                    canvas.width = parsedGif.width;
                    canvas.height = parsedGif.height;
                    drawGifFrame(sprite);
                }
            }
        } catch(e) {
            console.error("Failed to load or parse GIF:", sprite.imageUrl, e);
            sprite.isGif = false;
        }
    }

    function drawGifFrame(sprite) {
        if (!sprite || !sprite.animation) return;
        const { frames, width, height, currentFrame } = sprite.animation;
        const frame = frames[currentFrame];
        
        const canvas = document.querySelector(`#container-${sprite.id} canvas`);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        if (currentFrame === 0 || frame.disposalMethod === 2) {
             ctx.clearRect(0, 0, width, height);
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = frame.w;
        tempCanvas.height = frame.h;
        const tempCtx = tempCanvas.getContext('2d');
        const frameImageData = tempCtx.createImageData(frame.w, frame.h);
        const frameData = frameImageData.data;
        const colorTable = frame.colorTable;

        frame.pixelIndices.forEach((pixelIndex, i) => {
            if (pixelIndex !== frame.transparentColorIndex) {
                const color = colorTable[pixelIndex];
                frameData[i * 4] = color[0];
                frameData[i * 4 + 1] = color[1];
                frameData[i * 4 + 2] = color[2];
                frameData[i * 4 + 3] = 255;
            }
        });
        tempCtx.putImageData(frameImageData, 0, 0);
        ctx.drawImage(tempCanvas, frame.left, frame.top);
    }
    
    function createSoundCard(sound) {
        const card = document.createElement('div');
        card.className = 'sound-card';
        card.dataset.url = sound.url;
        card.innerHTML = `
            <div class="delete-button">X</div>
            <svg class="sound-card-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2a.75.75 0 01.75.75v14.5a.75.75 0 01-1.5 0V2.75A.75.75 0 0110 2zM4.5 5.25a.75.75 0 000 1.5h1.014a2.5 2.5 0 012.236 2.236v1.014a.75.75 0 001.5 0V9.014A2.5 2.5 0 0111.986 6.75h1.014a.75.75 0 000-1.5H4.5z" />
            </svg>
            <div class="sound-card-name" title="${sound.name}">${sound.name}</div>
        `;
        
        card.addEventListener('click', () => {
             if (currentPreviewAudio) {
                currentPreviewAudio.pause();
                if (currentPreviewAudio.src === sound.url) {
                    currentPreviewAudio = null;
                    return;
                }
            }
            currentPreviewAudio = new Audio(sound.url);
            currentPreviewAudio.play();
        });
        
        card.querySelector('.delete-button').addEventListener('click', (e) => {
            e.stopPropagation();
            const sprite = getActiveSprite();
            if (sprite) {
                sprite.sounds = sprite.sounds.filter(s => s.url !== sound.url);
                renderSpriteSounds(sprite);
                workspace.refreshToolboxSelection();
            }
        });
        
        return card;
    }

    function renderSpriteSounds(sprite) {
        soundsList.innerHTML = '';
        if (sprite && sprite.sounds) {
            sprite.sounds.forEach(sound => {
                soundsList.appendChild(createSoundCard(sound));
            });
        }
    }
    
    function updateSoundGallerySelection() {
        soundGalleryGrid.querySelectorAll('.sound-thumbnail').forEach(thumb => {
            const checkbox = thumb.querySelector('.sound-thumbnail-checkbox');
            const isSelected = selectedSoundsForAdd.has(thumb.dataset.url);
            checkbox.checked = isSelected;
            thumb.classList.toggle('selected-for-add', isSelected);
        });
    }

    function handleSoundUpload(files) {
        if (!files.length) return;
        const sprite = getActiveSprite();
        if (!sprite) return;

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const name = file.name.replace(/\.[^/.]+$/, "");
                const url = e.target.result;
                if (!sprite.sounds.some(s => s.name === name)) {
                    sprite.sounds.push({ name, url });
                }
                renderSpriteSounds(sprite);
                workspace.refreshToolboxSelection();
            };
            reader.readAsDataURL(file);
        });
        soundUploadInput.value = '';
    }
    
    function openSoundRecorder() {
        resetRecorderState();
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                mediaStream = stream;
                soundRecorderModal.classList.remove('hidden');
            })
            .catch(err => {
                showRecorderError("Microphone access denied. Please allow microphone access in your browser settings.");
                console.error("Microphone access error:", err);
            });
    }
    
    function closeSoundRecorder() {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        soundRecorderModal.classList.add('hidden');
    }

    function showRecorderError(message) {
        recorderMessage.textContent = message;
        recorderMessage.classList.remove('hidden');
        recorderUIContent.classList.add('hidden');
    }
    
    function resetRecorderState() {
        recorderMessage.classList.add('hidden');
        recorderUIContent.classList.remove('hidden');
        recorderRecordBtn.classList.remove('hidden');
        recorderStopBtn.classList.add('hidden');
        recorderRerecordBtn.classList.add('hidden');
        recorderSaveBtn.classList.add('hidden');
        recorderPreviewContainer.classList.add('hidden');
        recorderTimer.textContent = '0.0 / 15.0';
        recorderVisualizer.classList.remove('is-recording');
        if(recorderTimerInterval) clearInterval(recorderTimerInterval);
        audioChunks = [];
        recordedBlob = null;
    }

    function startRecording() {
        mediaRecorder = new MediaRecorder(mediaStream);
        mediaRecorder.start();
        
        recorderVisualizer.classList.add('is-recording');
        recorderRecordBtn.classList.add('hidden');
        recorderStopBtn.classList.remove('hidden');
        
        let startTime = Date.now();
        recorderTimerInterval = setInterval(() => {
            const seconds = ((Date.now() - startTime) / 1000);
            recorderTimer.textContent = `${seconds.toFixed(1)} / 15.0`;
            if (seconds >= 15) stopRecording();
        }, 100);
        
        mediaRecorder.addEventListener("dataavailable", event => {
            audioChunks.push(event.data);
        });
        
        mediaRecorder.addEventListener("stop", () => {
             recordedBlob = new Blob(audioChunks, { type: 'audio/mp3' });
             const audioUrl = URL.createObjectURL(recordedBlob);
             recorderAudioPreview.src = audioUrl;
             
             recorderStopBtn.classList.add('hidden');
             recorderRerecordBtn.classList.remove('hidden');
             recorderSaveBtn.classList.remove('hidden');
             recorderPreviewContainer.classList.remove('hidden');
             recorderSoundName.value = `My Sound ${getActiveSprite()?.sounds.length + 1 || 1}`;
        });
    }
    
    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        recorderVisualizer.classList.remove('is-recording');
        if(recorderTimerInterval) clearInterval(recorderTimerInterval);
    }
    
    function saveRecording() {
        const sprite = getActiveSprite();
        if (!sprite || !recordedBlob) return;
        
        const name = recorderSoundName.value.trim() || 'Recorded Sound';
        const reader = new FileReader();
        reader.onload = function(event) {
            const url = event.target.result;
            if (!sprite.sounds.some(s => s.name === name)) {
                sprite.sounds.push({ name, url });
                renderSpriteSounds(sprite);
                workspace.refreshToolboxSelection();
            }
            closeSoundRecorder();
        };
        reader.readAsDataURL(recordedBlob);
    }
    
    function setupSoundSystem() {
        const soundFiles = [ 'boing', 'clap', 'drip', 'drum', 'fart', 'meow', 'pop', 'snap', 'ting', 'woosh' ];
        soundFiles.forEach(name => {
            const url = `https://codejredu.github.io/test/assets/sounds/${name}.mp3`;
            const thumb = document.createElement('div');
            thumb.className = 'sound-thumbnail';
            thumb.dataset.url = url;
            thumb.dataset.name = name;
            thumb.innerHTML = `
                <input type="checkbox" class="sound-thumbnail-checkbox">
                <svg class="sound-thumbnail-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
                <div class="sound-thumbnail-name">${name}</div>
            `;
            soundGalleryGrid.appendChild(thumb);
        });

        soundGalleryGrid.addEventListener('click', (e) => {
            const thumb = e.target.closest('.sound-thumbnail');
            if (!thumb) return;
            const checkbox = thumb.querySelector('.sound-thumbnail-checkbox');
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
            }
            
            const url = thumb.dataset.url;
            if (checkbox.checked) {
                selectedSoundsForAdd.add(url);
            } else {
                selectedSoundsForAdd.delete(url);
            }
            updateSoundGallerySelection();
        });

        addSelectedSoundsButton.addEventListener('click', () => {
            const sprite = getActiveSprite();
            if (!sprite) return;
            selectedSoundsForAdd.forEach(url => {
                 if (!sprite.sounds.some(s => s.url === url)) {
                    const name = soundGalleryGrid.querySelector(`[data-url="${url}"]`).dataset.name;
                    sprite.sounds.push({ name, url });
                 }
            });
            renderSpriteSounds(sprite);
            workspace.refreshToolboxSelection();
            soundGallery.classList.remove('visible');
        });

        uploadSoundHeaderButton.addEventListener('click', () => soundUploadInput.click());
        soundUploadInput.addEventListener('change', (e) => handleSoundUpload(e.target.files));

        recordSoundHeaderButton.addEventListener('click', openSoundRecorder);
        recorderRecordBtn.addEventListener('click', startRecording);
        recorderStopBtn.addEventListener('click', stopRecording);
        recorderCloseBtn.addEventListener('click', closeSoundRecorder);
        recorderRerecordBtn.addEventListener('click', resetRecorderState);
        recorderSaveBtn.addEventListener('click', saveRecording);
    }

    function gameLoop(timestamp) {
        if (!lastTimestamp) {
            lastTimestamp = timestamp;
        }
        window.frameDeltaTime = timestamp - lastTimestamp;
        lastTimestamp = timestamp;

        if (scriptRunner) {
            scriptRunner.tick();
        }

        Object.values(sprites).forEach(sprite => {
            if (sprite.isGif && sprite.animation && (sprite.animation.isPlaying || sprite.animation.previewIsPlaying)) {
                sprite.animation.timeSinceLastFrame += window.frameDeltaTime;
                const baseDelay = sprite.animation.frames[sprite.animation.currentFrame].delay * 10;
                const effectiveSpeed = sprite.animation.isPlaying ? 1.0 : (sprite.gifSpeed || 1.0);
                const frameDelay = baseDelay / effectiveSpeed;

                if (sprite.animation.timeSinceLastFrame >= frameDelay) {
                    sprite.animation.timeSinceLastFrame = 0;
                    sprite.animation.currentFrame = (sprite.animation.currentFrame + 1) % sprite.animation.frames.length;
                    drawGifFrame(sprite);
                }
            }
        });

        requestAnimationFrame(gameLoop);
    }

    // --- Initial Setup ---
    function init() {
        setupPropertiesPanelListeners();
        setupGalleryListeners();
        setupSoundSystem();
        
        window.characterCreator = initCharacterCreator({
            onSave: ({ name, dataUrl, characterData, editingSpriteId }) => {
                if (editingSpriteId) {
                    const sprite = sprites[editingSpriteId];
                    if (sprite) {
                        sprite.imageUrl = dataUrl;
                        sprite.characterData = characterData;
                        
                        const card = document.querySelector(`.sprite-card[data-sprite-id="${editingSpriteId}"] img`);
                        if (card) card.src = dataUrl;
                        
                        const stageImg = document.querySelector(`#container-${editingSpriteId} img`);
                        if (stageImg) stageImg.src = dataUrl;
                    }
                } else {
                    createNewSprite(name || 'Character', dataUrl, 0, 0, true, characterData);
                }
                stopAllScripts(); // Reset UI state after adding/editing a sprite.
            },
            getSprite: (id) => sprites[id]
        });

        document.getElementById('create-sprite-header-button').addEventListener('click', () => {
            window.characterCreator.open();
        });

        stopAllScripts();
        createDefaultBackdrop();
        createDefaultSprite();
        gameLoop();
    }
    
    init();

});