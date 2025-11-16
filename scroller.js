/**
 * @fileoverview Manages the scrolling backdrop effect for the stage.
 * It creates and animates a set of background tiles to create a seamless,
 * infinite scrolling illusion.
 */
export class BackdropScroller {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Backdrop scroller container #${containerId} not found.`);
            return;
        }

        this.tiles = {};
        this.velocities = { x: 0, y: 0 };
        this.currentImageUrl = null;
        this.containerWidth = 0;
        this.containerHeight = 0;
    }

    /**
     * Updates the background image used for scrolling.
     * If the image URL changes, it recreates the tiles.
     * @param {string} imageUrl The new image URL.
     */
    updateImage(imageUrl) {
        if (imageUrl === this.currentImageUrl) return;
        
        this.currentImageUrl = imageUrl;
        this.container.innerHTML = ''; // Clear old tiles
        this.tiles = {};

        if (!imageUrl) {
            this.stop();
            return;
        }

        // Create 4 tiles for seamless wrapping in all directions.
        const positions = [
            { id: 'topLeft', x: 0, y: 0 },
            { id: 'topRight', x: 1, y: 0 },
            { id: 'bottomLeft', x: 0, y: 1 },
            { id: 'bottomRight', x: 1, y: 1 }
        ];

        positions.forEach(pos => {
            const tile = document.createElement('div');
            tile.style.position = 'absolute';
            tile.style.backgroundImage = `url("${this.currentImageUrl}")`;
            tile.style.backgroundSize = 'cover';
            tile.style.backgroundPosition = 'center';
            tile.style.willChange = 'transform';
            this.container.appendChild(tile);
            this.tiles[pos.id] = {
                element: tile,
                x: 0, // position in pixels
                y: 0, // position in pixels
            };
        });

        this.resetPositions();
    }
    
    /**
     * Resets tile positions based on the container size.
     * Should be called on window resize or when the container size changes.
     */
    resetPositions() {
        if (!this.currentImageUrl) return;

        this.containerWidth = this.container.clientWidth;
        this.containerHeight = this.container.clientHeight;

        if (this.containerWidth === 0 || this.containerHeight === 0) return;

        this.tiles.topLeft.x = 0;
        this.tiles.topLeft.y = 0;
        this.tiles.topRight.x = this.containerWidth;
        this.tiles.topRight.y = 0;
        this.tiles.bottomLeft.x = 0;
        this.tiles.bottomLeft.y = this.containerHeight;
        this.tiles.bottomRight.x = this.containerWidth;
        this.tiles.bottomRight.y = this.containerHeight;

        this.updateTileElements();
    }

    /**
     * Sets the scrolling velocity for a given direction.
     * @param {string} direction - 'up', 'down', 'left', or 'right'.
     * @param {number} speed - A value from 0-100 representing speed percentage.
     */
    scroll(direction, speed) {
        const normalizedSpeed = (speed / 100) * 200; // Map 0-100 to 0-200 pixels/sec
        
        switch (direction) {
            case 'right': this.velocities.x = normalizedSpeed; break;
            case 'left':  this.velocities.x = -normalizedSpeed; break;
            case 'down':  this.velocities.y = normalizedSpeed; break;
            case 'up':    this.velocities.y = -normalizedSpeed; break;
        }
    }
    
    /**
     * Stops the scrolling by resetting velocities.
     */
    stop() {
        this.velocities = { x: 0, y: 0 };
    }

    /**
     * Update function called on each frame of the animation.
     * @param {number} deltaTime - Time elapsed since the last frame in seconds.
     */
    update(deltaTime) {
        if (this.velocities.x === 0 && this.velocities.y === 0) {
            return;
        }

        const dx = this.velocities.x * deltaTime;
        const dy = this.velocities.y * deltaTime;
        const w = this.containerWidth;
        const h = this.containerHeight;
        const twoW = w * 2;
        const twoH = h * 2;

        if (w === 0 || h === 0) return; // Don't update if container has no size

        for (const tile of Object.values(this.tiles)) {
            tile.x += dx;
            tile.y += dy;

            // Horizontal wrapping
            if (this.velocities.x > 0 && tile.x >= w) {
                tile.x -= twoW;
            } else if (this.velocities.x < 0 && tile.x <= -w) {
                tile.x += twoW;
            }

            // Vertical wrapping
            if (this.velocities.y > 0 && tile.y >= h) {
                tile.y -= twoH;
            } else if (this.velocities.y < 0 && tile.y <= -h) {
                tile.y += twoH;
            }
        }

        this.updateTileElements();
    }

    /**
     * Applies the current state (position, size) to the DOM elements.
     */
    updateTileElements() {
        if (!this.containerWidth || !this.containerHeight) return;
        Object.values(this.tiles).forEach(tile => {
            const el = tile.element;
            el.style.width = `${this.containerWidth}px`;
            el.style.height = `${this.containerHeight}px`;
            el.style.transform = `translate3d(${Math.round(tile.x)}px, ${Math.round(tile.y)}px, 0)`;
        });
    }
}