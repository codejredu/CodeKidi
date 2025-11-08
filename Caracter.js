/**
 * @fileoverview Character Creator module for the KidiCode application.
 * Encapsulates all logic for creating, editing, and rendering custom characters.
 */

// Helper function to safely encode a string to Base64, handling Unicode characters.
const safeBtoa = (str) => btoa(unescape(encodeURIComponent(str)));

// All character part assets are embedded as data URIs to make the module self-contained.
const ASSET_CATEGORIES = {
    shirt: {
        label: 'Shirts',
        icon: 'https://codejredu.github.io/test/assets/blocklyicon/t-shirt.svg',
        parts: [
            'https://codejredu.github.io/test/assets/parts/shirt1.svg',
            'https://codejredu.github.io/test/assets/parts/shirt2.svg',
            'https://codejredu.github.io/test/assets/parts/shirt3.svg',
            'https://codejredu.github.io/test/assets/parts/shirt4.svg',
            'https://codejredu.github.io/test/assets/parts/shirt5.svg',
        ]
    },
     pants: {
        label: 'Pants',
        icon: 'https://codejredu.github.io/test/assets/blocklyicon/pants.svg',
        parts: [
            'https://codejredu.github.io/test/assets/parts/pants1.svg',
            'https://codejredu.github.io/test/assets/parts/pants2.svg',
            'https://codejredu.github.io/test/assets/parts/pants3.svg',
            'https://codejredu.github.io/test/assets/parts/pants4.svg',
            'https://codejredu.github.io/test/assets/parts/pants5.svg',
            'https://codejredu.github.io/test/assets/parts/pants6.svg',
            'https://codejredu.github.io/test/assets/parts/pants7.svg',
            'https://codejredu.github.io/test/assets/parts/pants8.svg',
        ]
    },
    dresses: {
        label: 'Dresses',
        icon: 'https://codejredu.github.io/test/assets/blocklyicon/formal-dresses.svg',
        parts: [
            'https://codejredu.github.io/test/assets/parts/drees1.svg',
            'https://codejredu.github.io/test/assets/parts/drees2.svg',
            'https://codejredu.github.io/test/assets/parts/drees3.svg',
            'https://codejredu.github.io/test/assets/parts/drees4.svg',
            'https://codejredu.github.io/test/assets/parts/drees5.svg',
        ]
    },
    shoes: {
        label: 'Shoes',
        icon: 'https://codejredu.github.io/test/assets/blocklyicon/shoes.svg',
        parts: [
            'https://codejredu.github.io/test/assets/parts/shoes1.svg',
            'https://codejredu.github.io/test/assets/parts/shoes2.svg',
            'https://codejredu.github.io/test/assets/parts/shoes3.svg',
            'https://codejredu.github.io/test/assets/parts/shoes4.svg',
            'https://codejredu.github.io/test/assets/parts/shoes5.svg',
        ]
    },
    head: {
        label: 'Head',
        icon: 'https://codejredu.github.io/test/assets/blocklyicon/head1.svg',
        parts: [
            'https://codejredu.github.io/test/assets/parts/face1.svg',
            'https://codejredu.github.io/test/assets/parts/face2.svg',
            'https://codejredu.github.io/test/assets/parts/face3.svg',
            'https://codejredu.github.io/test/assets/parts/face4.svg',
            'https://codejredu.github.io/test/assets/parts/face5.svg',
            'https://codejredu.github.io/test/assets/parts/face6.svg',
            'https://codejredu.github.io/test/assets/parts/face7.svg',
            'https://codejredu.github.io/test/assets/parts/face8.svg',
            'https://codejredu.github.io/test/assets/parts/face9.svg',
            'https://codejredu.github.io/test/assets/parts/face10.svg',
            'https://codejredu.github.io/test/assets/parts/face11.svg',
            'https://codejredu.github.io/test/assets/parts/face12.svg',
            'https://codejredu.github.io/test/assets/parts/face13.svg',
            'https://codejredu.github.io/test/assets/parts/face14.svg',
            'https://codejredu.github.io/test/assets/parts/face15.svg',
            'https://codejredu.github.io/test/assets/parts/face16.svg',
            'https://codejredu.github.io/test/assets/parts/face17.svg',
            'https://codejredu.github.io/test/assets/parts/face18.svg',
            'https://codejredu.github.io/test/assets/parts/face19.svg',
            'https://codejredu.github.io/test/assets/parts/face20.svg',
        ]
    },
    eyes: { 
        label: 'Eyes', 
        icon: 'https://codejredu.github.io/test/assets/blocklyicon/eye1.svg',
        parts: [
            'https://codejredu.github.io/test/assets/parts/eye1.svg',
            'https://codejredu.github.io/test/assets/parts/eye2.svg',
            'https://codejredu.github.io/test/assets/parts/eye3.svg',
            'https://codejredu.github.io/test/assets/parts/eye4.svg',
            'https://codejredu.github.io/test/assets/parts/eye5.svg',
            'https://codejredu.github.io/test/assets/parts/eye6.svg',
            'https://codejredu.github.io/test/assets/parts/eye7.svg',
            'https://codejredu.github.io/test/assets/parts/eye8.svg',
        ] 
    },
    nose: {
        label: 'Noses',
        icon: 'https://codejredu.github.io/test/assets/blocklyicon/nose1.svg',
        parts: [
            'https://codejredu.github.io/test/assets/parts/Nose1.svg',
            'https://codejredu.github.io/test/assets/parts/Nose2.svg',
            'https://codejredu.github.io/test/assets/parts/Nose3.svg',
            'https://codejredu.github.io/test/assets/parts/Nose4.svg',
            'https://codejredu.github.io/test/assets/parts/Nose5.svg',
            'https://codejredu.github.io/test/assets/parts/Nose6.svg',
            'https://codejredu.github.io/test/assets/parts/Nose7.svg',
        ]
    },
    mouth: {
        label: 'Mouth',
        icon: 'https://codejredu.github.io/test/assets/blocklyicon/mouth.svg',
        parts: [
            'https://codejredu.github.io/test/assets/parts/mouth1.svg',
            'https://codejredu.github.io/test/assets/parts/mouth2.svg',
            'https://codejredu.github.io/test/assets/parts/mouth3.svg',
            'https://codejredu.github.io/test/assets/parts/mouth4.svg',
            'https://codejredu.github.io/test/assets/parts/mouth5.svg',
            'https://codejredu.github.io/test/assets/parts/mouth6.svg',
            'https://codejredu.github.io/test/assets/parts/mouth7.svg',
        ]
    },
    hand: {
        label: 'Hands',
        icon: 'https://codejredu.github.io/test/assets/blocklyicon/arm-pit.svg',
        parts: [
            'https://codejredu.github.io/test/assets/parts/hand1.svg',
            'https://codejredu.github.io/test/assets/parts/hand2.svg',
            'https://codejredu.github.io/test/assets/parts/hand3.svg',
            'https://codejredu.github.io/test/assets/parts/hand4.svg',
            'https://codejredu.github.io/test/assets/parts/hand5.svg',
        ]
    }
};

const PART_PROPORTIONS = {
    head:    { scale: { w: 0.28, h: 0.28 }, offset: { x: 0.5, y: 0.22 } },
    shirt:   { scale: { w: 0.35, h: 0.3 }, offset: { x: 0.5, y: 0.45 } },
    pants:   { scale: { w: 0.32, h: 0.4 }, offset: { x: 0.5, y: 0.75 } },
    dresses: { scale: { w: 0.38, h: 0.55 }, offset: { x: 0.5, y: 0.65 } },
    shoes:   { scale: { w: 0.35, h: 0.1 }, offset: { x: 0.5, y: 0.96 } },
    eyes:    { scale: { w: 0.15, h: 0.08 }, offset: { x: 0.5, y: 0.20 } },
    nose:    { scale: { w: 0.08, h: 0.08 }, offset: { x: 0.5, y: 0.24 } },
    mouth:   { scale: { w: 0.1, h: 0.05 }, offset: { x: 0.5, y: 0.28 } },
    hand:    { scale: { w: 0.15, h: 0.18 }, offset: { x: 0.35, y: 0.55 } }
};
const COLOR_PALETTE = ['#000000', '#FFFFFF', '#FF5733', '#FFC300', '#4CAF50', '#3498DB', '#9B59B6', '#E91E63', '#9E9E9E', '#795548', '#607D8B', '#ffdfba', '#ffadad', '#ffd6a5', '#caffbf', '#a0c4ff'];
const SKIN_TONE_PALETTE = ['#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#ffdbac', '#ead2c2'];
const DRAW_ORDER = ['pants', 'shoes', 'shirt', 'dresses', 'hand', 'head', 'nose', 'mouth', 'eyes'];


class CharacterCreator {
    constructor({ onSave, getSprite }) {
        this.onSave = onSave;
        this.getSprite = getSprite;

        // DOM Elements
        this.modal = document.getElementById('character-creator-modal');
        this.closeButton = document.getElementById('creator-close-button');
        this.saveButton = document.getElementById('creator-save-button');
        this.categoriesContainer = document.getElementById('creator-categories');
        this.partsGrid = document.getElementById('creator-parts-grid');
        this.canvas = document.getElementById('character-canvas');
        this.controlsPanel = document.getElementById('creator-controls-panel');
        this.selectedPartLabel = document.getElementById('selected-part-label');
        this.colorPalette = document.getElementById('creator-color-palette');
        this.flipHButton = document.getElementById('creator-flip-h-button');
        this.actionsGroup = document.getElementById('creator-actions-group');
        this.ctx = this.canvas.getContext('2d');

        // Size Control Elements
        this.widthGroup = document.getElementById('creator-width-group');
        this.heightGroup = document.getElementById('creator-height-group');
        this.widthValue = document.getElementById('creator-width-value');
        this.heightValue = document.getElementById('creator-height-value');
        this.increaseWidthBtn = document.getElementById('creator-increase-width');
        this.decreaseWidthBtn = document.getElementById('creator-decrease-width');
        this.increaseHeightBtn = document.getElementById('creator-increase-height');
        this.decreaseHeightBtn = document.getElementById('creator-decrease-height');

        // Position Control Elements
        this.positionGroup = document.getElementById('creator-position-group');
        this.dPadUp = document.getElementById('d-pad-up');
        this.dPadDown = document.getElementById('d-pad-down');
        this.dPadLeft = document.getElementById('d-pad-left');
        this.dPadRight = document.getElementById('d-pad-right');

        // State
        this.activeCategory = 'shirt';
        this.currentCharacter = {};
        this.imageCache = {};
        this.assetCache = {};
        this.selectedPartOnCanvas = null;
        this.editingSpriteId = null;
        this.action = { type: 'none', partSelection: null, handle: null, startX: 0, startY: 0, initialState: {} };
        this.movementInterval = null;
    }

    init() {
        this.closeButton.addEventListener('click', () => this.close());
        this.saveButton.addEventListener('click', () => this.save());
        this.flipHButton.addEventListener('click', () => this.flipSelectedPart());

        // Listeners for size controls
        this.increaseWidthBtn.addEventListener('click', () => this.adjustPartSize('width', 2));
        this.decreaseWidthBtn.addEventListener('click', () => this.adjustPartSize('width', -2));
        this.increaseHeightBtn.addEventListener('click', () => this.adjustPartSize('height', 2));
        this.decreaseHeightBtn.addEventListener('click', () => this.adjustPartSize('height', -2));

        // Listeners for position controls
        const setupDpadButton = (button, axis, delta) => {
            const startMoving = (e) => {
                e.preventDefault();
                this.adjustPartPosition(axis, delta);
                if (this.movementInterval) clearInterval(this.movementInterval);
                this.movementInterval = setInterval(() => this.adjustPartPosition(axis, delta), 100);
            };
            button.addEventListener('mousedown', startMoving);
            button.addEventListener('touchstart', startMoving, { passive: false });
        };

        const stopMoving = () => {
            if (this.movementInterval) clearInterval(this.movementInterval);
            this.movementInterval = null;
        };

        document.addEventListener('mouseup', stopMoving);
        document.addEventListener('touchend', stopMoving);

        setupDpadButton(this.dPadUp, 'y', -2);
        setupDpadButton(this.dPadDown, 'y', 2);
        setupDpadButton(this.dPadLeft, 'x', -2);
        setupDpadButton(this.dPadRight, 'x', 2);

        this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
        document.addEventListener('mouseup', () => this.handleCanvasMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleCanvasMouseLeave());
    }
    
    open(characterData = null, spriteIdToEdit = null) {
        this.editingSpriteId = spriteIdToEdit;
        this.currentCharacter = {}; // Reset

        if (characterData) {
             this.currentCharacter = JSON.parse(JSON.stringify(characterData));
        } else {
            const setupPart = (category, src) => {
                const props = PART_PROPORTIONS[category];
                const w = this.canvas.width * props.scale.w;
                const h = this.canvas.height * props.scale.h;
                this.currentCharacter[category] = { category, src, x: props.offset.x * this.canvas.width, y: props.offset.y * this.canvas.height, width: w, height: h, rotation: 0, color: null, isFlippedH: false };
            };
            setupPart('head', ASSET_CATEGORIES.head.parts[0]);
            setupPart('shirt', ASSET_CATEGORIES.shirt.parts[0]);
            setupPart('pants', ASSET_CATEGORIES.pants.parts[0]);
            this.currentCharacter.hand = [];
        }

        this.populateCategories();
        this.populateParts();
        this.draw();
        this.modal.classList.add('visible');
    }
    
    openForEdit(spriteId) {
        const sprite = this.getSprite(spriteId);
        if (sprite && sprite.isCustom) {
            this.open(sprite.characterData, spriteId);
        }
    }

    close() {
        this.modal.classList.remove('visible');
        this.selectedPartOnCanvas = null;
        this.controlsPanel.classList.add('hidden');
        this.editingSpriteId = null;
    }

    async save() {
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = this.canvas.width;
        finalCanvas.height = this.canvas.height;
        const finalCtx = finalCanvas.getContext('2d');
        
        const lastSelected = this.selectedPartOnCanvas;
        this.selectedPartOnCanvas = null;
        await this.draw(); 
        finalCtx.drawImage(this.canvas, 0, 0);
        this.selectedPartOnCanvas = lastSelected;
        await this.draw();

        const dataUrl = finalCanvas.toDataURL('image/png');
        
        this.onSave({
            name: null,
            dataUrl,
            characterData: this.currentCharacter,
            editingSpriteId: this.editingSpriteId
        });

        this.close();
    }
    
    populateCategories() {
        this.categoriesContainer.innerHTML = '';
        Object.keys(ASSET_CATEGORIES).forEach(key => {
            const categoryData = ASSET_CATEGORIES[key];
            const button = document.createElement('button');
            button.className = 'category-button';
            button.dataset.category = key;
            button.title = categoryData.label;

            const icon = document.createElement('img');
            icon.src = categoryData.icon;
            icon.className = 'category-icon';
            icon.alt = categoryData.label;

            const label = document.createElement('span');
            label.className = 'category-label';
            label.textContent = categoryData.label;
            
            button.appendChild(icon);
            button.appendChild(label);

            if (key === this.activeCategory) button.classList.add('active');
            
            button.addEventListener('click', () => {
                this.activeCategory = key;
                this.populateCategories();
                this.populateParts();
            });
            this.categoriesContainer.appendChild(button);
        });
    }

    populateParts() {
        this.partsGrid.innerHTML = '';
        const parts = ASSET_CATEGORIES[this.activeCategory].parts;
        
        parts.forEach(partSrc => {
            const thumb = document.createElement('div');
            thumb.className = 'part-thumbnail';
            thumb.innerHTML = `<img src="${partSrc}">`;
            
            const isSelected = Object.values(this.currentCharacter).some(part => part && part.src === partSrc) || (this.currentCharacter.hand && this.currentCharacter.hand.some(h => h.src === partSrc));
            if (isSelected) thumb.classList.add('selected');
            
            thumb.addEventListener('click', () => this.selectPart(this.activeCategory, partSrc, thumb));
            this.partsGrid.appendChild(thumb);
        });
    }

    selectPart(category, partSrc, thumbElement) {
        if (category === 'hand') {
            const getSelectedPartObject = () => (!this.selectedPartOnCanvas || this.selectedPartOnCanvas.category !== 'hand') ? null : this.currentCharacter.hand[this.selectedPartOnCanvas.index];
            const selectedHand = getSelectedPartObject();

            if (selectedHand) {
                selectedHand.src = partSrc;
            } else if (this.currentCharacter.hand.length < 2) {
                const props = PART_PROPORTIONS.hand;
                const w = this.canvas.width * props.scale.w;
                const h = this.canvas.height * props.scale.h;
                const xOffset = this.currentCharacter.hand.length === 0 ? props.offset.x : 1 - props.offset.x;
                this.currentCharacter.hand.push({ 
                    category: 'hand', src: partSrc, 
                    x: xOffset * this.canvas.width, y: props.offset.y * this.canvas.height,
                    width: w, height: h, rotation: 0, color: null, isFlippedH: this.currentCharacter.hand.length === 1
                });
            }
        } else {
            if (this.currentCharacter[category]) {
                this.currentCharacter[category].src = partSrc;
            } else {
                 const props = PART_PROPORTIONS[category];
                 const w = this.canvas.width * props.scale.w;
                 const h = this.canvas.height * props.scale.h;
                 this.currentCharacter[category] = { category, src: partSrc, x: props.offset.x * this.canvas.width, y: props.offset.y * this.canvas.height, width: w, height: h, rotation: 0, color: null, isFlippedH: false };
            }

            if (category === 'dresses') {
                if(this.currentCharacter.shirt) this.currentCharacter.shirt.src = '';
                if(this.currentCharacter.pants) this.currentCharacter.pants.src = '';
            } else if (category === 'shirt' || category === 'pants') {
                if(this.currentCharacter.dresses) this.currentCharacter.dresses.src = '';
            }
        }

        document.querySelectorAll(`#creator-parts-grid .part-thumbnail`).forEach(el => el.classList.remove('selected'));
        if (thumbElement) thumbElement.classList.add('selected');

        this.draw();
    }
    
    flipSelectedPart() {
         const part = this.getSelectedPartObject();
         if (part) {
            part.isFlippedH = !part.isFlippedH;
            this.draw();
         }
    }

    adjustPartSize(property, delta) {
        const part = this.getSelectedPartObject();
        if (part) {
            // Adjust property but ensure it doesn't go below a minimum size
            part[property] = Math.max(10, part[property] + delta);
            this.draw();
            this.updateControlsPanel(); // Update the displayed value
        }
    }

    adjustPartPosition(axis, delta) {
        const part = this.getSelectedPartObject();
        if (part) {
            part[axis] += delta;
            this.draw();
        }
    }

    async draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const partsToDraw = [];
        DRAW_ORDER.forEach(category => {
            if (category === 'hand' && this.currentCharacter.hand) {
                this.currentCharacter.hand.forEach(handPart => partsToDraw.push(handPart));
            } else if (this.currentCharacter[category] && this.currentCharacter[category].src) {
                partsToDraw.push(this.currentCharacter[category]);
            }
        });

        const drawingPromises = partsToDraw.map(part => (async () => {
            try {
                const svgText = await this.getAssetAsText(part.src);
                const finalSvgText = part.color ? this.colorizeSvg(svgText, part.color) : svgText;
                const dataUrl = `data:image/svg+xml;base64,${safeBtoa(finalSvgText)}`;
                const img = await this.loadImage(dataUrl);
                return { part, img };
            } catch (e) {
                console.error(`Error processing a part:`, e);
                return null;
            }
        })());

        const loadedParts = await Promise.all(drawingPromises);

        loadedParts.forEach(loaded => {
            if (loaded) {
                const { part, img } = loaded;
                this.ctx.save();
                this.ctx.translate(part.x, part.y);
                this.ctx.rotate(part.rotation);
                if (part.isFlippedH) this.ctx.scale(-1, 1);
                this.ctx.drawImage(img, -part.width / 2, -part.height / 2, part.width, part.height);
                this.ctx.restore();
            }
        });
        
        const selectedPartObject = this.getSelectedPartObject();
        if (selectedPartObject) this.drawTransformHandles(selectedPartObject);
    }

    drawTransformHandles(part) {
        const HANDLE_SIZE = 8;
        const { ctx } = this;

        ctx.save();
        ctx.translate(part.x, part.y);
        ctx.rotate(part.rotation);

        ctx.strokeStyle = '#4C97FF';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 2]);
        ctx.strokeRect(-part.width / 2, -part.height / 2, part.width, part.height);
        ctx.setLineDash([]);

        const handles = this.getPartHandles(part);
        ctx.fillStyle = 'white';
        ctx.strokeStyle = '#4C97FF';
        ctx.lineWidth = 2;
        
        Object.values(handles).forEach(handle => {
            if (handle.type === 'resize') {
               ctx.strokeRect(handle.x - HANDLE_SIZE / 2, handle.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
               ctx.fillRect(handle.x - HANDLE_SIZE / 2, handle.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
            } else if (handle.type === 'rotate') {
                ctx.beginPath();
                ctx.moveTo(0, -part.height / 2);
                ctx.lineTo(handle.x, handle.y + HANDLE_SIZE / 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(handle.x, handle.y, HANDLE_SIZE / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        });
        
        ctx.restore();
    }

    handleCanvasMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const handleInfo = this.selectedPartOnCanvas ? this.getHandleAt(x, y) : null;
        if (handleInfo) {
            const part = this.getSelectedPartObject();
            this.action = {
                type: handleInfo.handle.type,
                partSelection: this.selectedPartOnCanvas,
                handle: handleInfo.name,
                startX: e.clientX,
                startY: e.clientY,
                initialState: JSON.parse(JSON.stringify(part))
            };
        } else {
            const partSelection = this.getPartAt(x, y);
            if (partSelection) {
                this.selectedPartOnCanvas = partSelection;
                 this.action = {
                    type: 'move',
                    partSelection: partSelection,
                    startX: e.clientX,
                    startY: e.clientY,
                    initialState: JSON.parse(JSON.stringify(this.getSelectedPartObject()))
                };
            } else {
                this.selectedPartOnCanvas = null;
                this.action.type = 'none';
            }
        }
        this.updateControlsPanel();
        this.draw();
    }

    async getAssetAsText(src) {
        if (this.assetCache[src]) return this.assetCache[src];
        try {
            const response = await fetch(src);
            const text = await response.text();
            this.assetCache[src] = text;
            return text;
        } catch (error) {
            console.error('Failed to fetch asset:', src, error);
            return '<svg></svg>'; // Return empty svg on error
        }
    }

    colorizeSvg(svgText, color) {
        return svgText.replace(/fill="((?!none).)*?"/g, `fill="${color}"`);
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            if (this.imageCache[src] && this.imageCache[src].complete) {
                resolve(this.imageCache[src]);
                return;
            }
            const img = new Image();
            img.onload = () => {
                this.imageCache[src] = img;
                resolve(img);
            };
            img.onerror = reject;
            img.src = src;
        });
    }

    getSelectedPartObject() {
        if (!this.selectedPartOnCanvas) return null;
        const { category, index } = this.selectedPartOnCanvas;
        if (category === 'hand') {
            return this.currentCharacter.hand[index];
        }
        return this.currentCharacter[category];
    }
    
    getPartHandles(part) {
        const halfW = part.width / 2;
        const halfH = part.height / 2;
        const ROTATE_HANDLE_OFFSET = 20;

        return {
            topLeft: { x: -halfW, y: -halfH, type: 'resize', cursor: 'nwse-resize' },
            topRight: { x: halfW, y: -halfH, type: 'resize', cursor: 'nesw-resize' },
            bottomLeft: { x: -halfW, y: halfH, type: 'resize', cursor: 'nesw-resize' },
            bottomRight: { x: halfW, y: halfH, type: 'resize', cursor: 'nwse-resize' },
            rotate: { x: 0, y: -halfH - ROTATE_HANDLE_OFFSET, type: 'rotate', cursor: 'grab' },
        };
    }

    getPartAt(x, y) {
        const partsToTest = [];
        const reversedDrawOrder = [...DRAW_ORDER].reverse();
        reversedDrawOrder.forEach(category => {
            if (category === 'hand' && this.currentCharacter.hand) {
                this.currentCharacter.hand.forEach((_, index) => partsToTest.push({ category: 'hand', index }));
            } else if (this.currentCharacter[category] && this.currentCharacter[category].src) {
                partsToTest.push({ category });
            }
        });

        for (const partSelection of partsToTest) {
            let part;
            if (partSelection.category === 'hand') {
                part = this.currentCharacter.hand[partSelection.index];
            } else {
                part = this.currentCharacter[partSelection.category];
            }
            if (!part) continue;

            const dx = x - part.x;
            const dy = y - part.y;
            const cos = Math.cos(-part.rotation);
            const sin = Math.sin(-part.rotation);
            const localX = dx * cos - dy * sin;
            const localY = dx * sin + dy * cos;

            if (Math.abs(localX) < part.width / 2 && Math.abs(localY) < part.height / 2) {
                return partSelection;
            }
        }
        return null;
    }

    getHandleAt(x, y) {
        const part = this.getSelectedPartObject();
        if (!part) return null;

        const handles = this.getPartHandles(part);
        const HANDLE_SIZE = 10;
        
        for (const name in handles) {
            const handle = handles[name];
            
            const cos = Math.cos(part.rotation);
            const sin = Math.sin(part.rotation);
            const worldX = part.x + handle.x * cos - handle.y * sin;
            const worldY = part.y + handle.x * sin + handle.y * cos;
            
            if (Math.abs(x - worldX) < HANDLE_SIZE && Math.abs(y - worldY) < HANDLE_SIZE) {
                return { name, handle };
            }
        }
        return null;
    }
    
    updateControlsPanel() {
        const part = this.getSelectedPartObject();
        const colorGroup = document.getElementById('creator-color-group');

        if (!part) {
            this.controlsPanel.classList.add('hidden');
            return;
        }
        
        // Show the panel and basic info for any selected part
        this.controlsPanel.classList.remove('hidden');
        this.selectedPartLabel.textContent = ASSET_CATEGORIES[part.category].label;

        // Hide color palette as per user's previous request to remove non-functional color changing
        colorGroup.classList.add('hidden');
        
        // Show new size controls for all parts
        this.widthGroup.classList.remove('hidden');
        this.heightGroup.classList.remove('hidden');
        this.widthValue.textContent = Math.round(part.width);
        this.heightValue.textContent = Math.round(part.height);

        // Show position controls for all parts
        this.positionGroup.classList.remove('hidden');

        // Show actions group (flip) only for hands
        if (part.category === 'hand') {
            this.actionsGroup.classList.remove('hidden');
        } else {
            this.actionsGroup.classList.add('hidden');
        }
    }

    handleCanvasMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (this.action.type === 'none') {
            const handleInfo = this.selectedPartOnCanvas ? this.getHandleAt(mouseX, mouseY) : null;
            if (handleInfo) {
                this.canvas.style.cursor = handleInfo.handle.cursor;
            } else if (this.getPartAt(mouseX, mouseY)) {
                this.canvas.style.cursor = 'grab';
            } else {
                this.canvas.style.cursor = 'default';
            }
            return;
        }
        
        this.canvas.style.cursor = 'grabbing';
        const part = this.getSelectedPartObject();
        if (!part) return;

        const dx = e.clientX - this.action.startX;
        const dy = e.clientY - this.action.startY;

        switch (this.action.type) {
            case 'move':
                part.x = this.action.initialState.x + dx;
                part.y = this.action.initialState.y + dy;
                break;
            
            case 'rotate': {
                const center = { x: this.action.initialState.x, y: this.action.initialState.y };
                const initialAngle = Math.atan2(this.action.startY - rect.top - center.y, this.action.startX - rect.left - center.x);
                const currentAngle = Math.atan2(mouseY - center.y, mouseX - center.x);
                part.rotation = this.action.initialState.rotation + (currentAngle - initialAngle);
                break;
            }
                
            case 'resize': {
                const handleName = this.action.handle;
                const cos = Math.cos(part.rotation);
                const sin = Math.sin(part.rotation);
                
                const oppositeCos = Math.cos(-part.rotation);
                const oppositeSin = Math.sin(-part.rotation);

                const localDx = dx * oppositeCos - dy * oppositeSin;
                const localDy = dx * oppositeSin + dy * oppositeCos;
                
                let w = this.action.initialState.width;
                let h = this.action.initialState.height;
                let shiftX = 0;
                let shiftY = 0;

                if (handleName.includes('Left')) { 
                    w -= localDx; 
                    shiftX = localDx / 2;
                }
                if (handleName.includes('Right')) {
                    w += localDx;
                    shiftX = localDx / 2;
                }
                if (handleName.includes('Top')) {
                    h -= localDy;
                    shiftY = localDy / 2;
                }
                if (handleName.includes('Bottom')) {
                    h += localDy;
                    shiftY = localDy / 2;
                }
                
                part.width = Math.max(20, w);
                part.height = Math.max(20, h);

                part.x = this.action.initialState.x + (shiftX * cos - shiftY * sin);
                part.y = this.action.initialState.y + (shiftX * sin + shiftY * cos);
                break;
            }
        }
        this.draw();
    }
    
    handleCanvasMouseUp() {
        if (this.action.type !== 'none') {
            const rect = this.canvas.getBoundingClientRect();
            const { clientX, clientY } = (event.touches ? event.touches[0] : event);
            const mouseX = clientX - rect.left;
            const mouseY = clientY - rect.top;
            
            const handleInfo = this.selectedPartOnCanvas ? this.getHandleAt(mouseX, mouseY) : null;
            if (handleInfo) {
                 this.canvas.style.cursor = handleInfo.handle.cursor;
            } else if (this.getPartAt(mouseX, mouseY)) {
                this.canvas.style.cursor = 'grab';
            }
        }
        this.action.type = 'none';
    }

    handleCanvasMouseLeave() {
        this.canvas.style.cursor = 'default';
    }
}

export function initCharacterCreator(options) {
    const creator = new CharacterCreator(options);
    creator.init();
    return creator;
}