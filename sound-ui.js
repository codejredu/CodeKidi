/**
 * @fileoverview Sound UI management module for the KidiCode application.
 * Encapsulates all UI logic for the sound system, including galleries,
 * recorders, and event handling.
 */

import { soundLibrary, getSoundManager } from './sounds.js';

class SoundUIController {
    constructor() {
        // --- DOM Elements ---
        this.soundsList = document.getElementById('sounds-list');
        this.addSoundButton = document.getElementById('add-sound-button');
        this.uploadSoundHeaderButton = document.getElementById('upload-sound-header-button');
        this.recordSoundHeaderButton = document.getElementById('record-sound-header-button');
        this.soundGallery = document.getElementById('sound-gallery');
        this.closeSoundGalleryButton = document.getElementById('close-sound-gallery-button');
        this.soundGalleryGrid = document.getElementById('sound-gallery-grid');
        this.addSelectedSoundsButton = document.getElementById('add-selected-sounds-button');
        this.soundUploadInput = document.getElementById('sound-upload-input');

        // --- Sound Recorder Elements ---
        this.soundRecorderModal = document.getElementById('sound-recorder-modal');
        this.recorderCloseBtn = document.getElementById('recorder-close-btn');
        this.recorderVisualizer = document.getElementById('recorder-visualizer');
        this.recorderTimer = document.getElementById('recorder-timer');
        this.recorderRecordBtn = document.getElementById('recorder-record-btn');
        this.recorderStopBtn = document.getElementById('recorder-stop-btn');
        this.recorderRerecordBtn = document.getElementById('recorder-rerecord-btn');
        this.recorderSaveBtn = document.getElementById('recorder-save-btn');
        this.recorderMessage = document.getElementById('recorder-message');
        this.recorderUIContent = document.getElementById('recorder-ui-content');
        this.recorderAudioPreview = document.getElementById('recorder-audio-preview');
        this.recorderPreviewContainer = document.getElementById('recorder-preview-container');
        this.recorderSoundName = document.getElementById('recorder-sound-name');

        // --- State ---
        this.selectedSoundsForAdd = new Set();
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.mediaStream = null;
        this.recorderTimerInterval = null;
        this.recordedBlob = null;
        this.soundManager = getSoundManager();

        // --- Dependencies from main app ---
        this.getActiveSprite = null;
        this.workspace = null;
        this.openGallery = null;
    }

    init({ getActiveSprite, workspace, openGallery }) {
        this.getActiveSprite = getActiveSprite;
        this.workspace = workspace;
        this.openGallery = openGallery;

        // Populate the sound gallery from the library
        soundLibrary.forEach(sound => {
            const thumb = document.createElement('div');
            thumb.className = 'sound-thumbnail';
            thumb.dataset.url = sound.url;
            thumb.dataset.name = sound.name;
            thumb.innerHTML = `
                <input type="checkbox" class="sound-thumbnail-checkbox">
                <svg class="sound-thumbnail-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
                <div class="sound-thumbnail-name" title="${sound.name}">${sound.name}</div>
            `;
            this.soundGalleryGrid.appendChild(thumb);
        });

        // Setup event listeners
        this.addSoundButton.addEventListener('click', () => {
            this.selectedSoundsForAdd.clear();
            this.updateSoundGallerySelection();
            this.openGallery(this.soundGallery);
        });

        this.closeSoundGalleryButton.addEventListener('click', () => this.soundGallery.classList.remove('visible'));

        this.soundGalleryGrid.addEventListener('click', (e) => {
            const thumb = e.target.closest('.sound-thumbnail');
            if (!thumb) return;

            // Play sound on click, but not if clicking the checkbox itself
            if (e.target.type !== 'checkbox') {
                 this.soundManager.playSoundFromUrl(thumb.dataset.url);
            }

            const checkbox = thumb.querySelector('.sound-thumbnail-checkbox');
            // Toggle checkbox state if the click was not on the checkbox itself
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
            }
            
            const url = thumb.dataset.url;
            if (checkbox.checked) {
                this.selectedSoundsForAdd.add(url);
            } else {
                this.selectedSoundsForAdd.delete(url);
            }
            this.updateSoundGallerySelection();
        });

        this.addSelectedSoundsButton.addEventListener('click', async () => {
            const sprite = this.getActiveSprite();
            if (!sprite) return;
    
            const addSoundPromises = [];
            this.selectedSoundsForAdd.forEach(url => {
                 if (!sprite.sounds.some(s => s.url === url)) {
                    const name = this.soundGalleryGrid.querySelector(`[data-url="${url}"]`).dataset.name;
                    addSoundPromises.push(
                        this.soundManager.addSound({ name, url }).then(addedSound => {
                            if (addedSound) {
                                sprite.sounds.push({ name, url });
                            }
                        })
                    );
                 }
            });
    
            await Promise.all(addSoundPromises);
    
            this.renderSpriteSounds(sprite);
            this.workspace.refreshToolboxSelection();
            this.soundGallery.classList.remove('visible');
        });

        this.uploadSoundHeaderButton.addEventListener('click', () => this.soundUploadInput.click());
        this.soundUploadInput.addEventListener('change', (e) => this.handleSoundUpload(e.target.files));

        this.recordSoundHeaderButton.addEventListener('click', () => this.openSoundRecorder());
        this.recorderRecordBtn.addEventListener('click', () => this.startRecording());
        this.recorderStopBtn.addEventListener('click', () => this.stopRecording());
        this.recorderCloseBtn.addEventListener('click', () => this.closeSoundRecorder());
        this.recorderRerecordBtn.addEventListener('click', () => this.resetRecorderState());
        this.recorderSaveBtn.addEventListener('click', () => this.saveRecording());
    }

    createSoundCard(sound) {
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
            this.soundManager.playSoundFromUrl(sound.url);
        });
        
        card.querySelector('.delete-button').addEventListener('click', (e) => {
            e.stopPropagation();
            const sprite = this.getActiveSprite();
            if (sprite) {
                sprite.sounds = sprite.sounds.filter(s => s.url !== sound.url);
                this.renderSpriteSounds(sprite);
                this.workspace.refreshToolboxSelection();
            }
        });
        
        return card;
    }

    renderSpriteSounds(sprite) {
        this.soundsList.innerHTML = '';
        if (sprite && sprite.sounds) {
            sprite.sounds.forEach(sound => {
                this.soundsList.appendChild(this.createSoundCard(sound));
            });
        }
    }

    updateSoundGallerySelection() {
        this.soundGalleryGrid.querySelectorAll('.sound-thumbnail').forEach(thumb => {
            const checkbox = thumb.querySelector('.sound-thumbnail-checkbox');
            const isSelected = this.selectedSoundsForAdd.has(thumb.dataset.url);
            checkbox.checked = isSelected;
            thumb.classList.toggle('selected-for-add', isSelected);
        });
    }

    readFileAsDataURL(fileOrBlob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(e.target.error);
            reader.readAsDataURL(fileOrBlob);
        });
    }

    async handleSoundUpload(files) {
        if (!files.length) return;
        const sprite = this.getActiveSprite();
        if (!sprite) return;

        for (const file of Array.from(files)) {
            try {
                const url = await this.readFileAsDataURL(file);
                const name = file.name.replace(/\.[^/.]+$/, "");
                if (!sprite.sounds.some(s => s.name === name)) {
                    const addedSound = await this.soundManager.addSound({ name, url });
                    if (addedSound) {
                        sprite.sounds.push({ name, url });
                    }
                }
            } catch (error) {
                console.error("Error reading uploaded sound file:", error);
            }
        }
        
        this.renderSpriteSounds(sprite);
        this.workspace.refreshToolboxSelection();
        this.soundUploadInput.value = '';
    }

    openSoundRecorder() {
        this.resetRecorderState();
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                this.mediaStream = stream;
                this.soundRecorderModal.classList.remove('hidden');
            })
            .catch(err => {
                this.showRecorderError("Microphone access denied. Please allow microphone access in your browser settings.");
                console.error("Microphone access error:", err);
            });
    }

    closeSoundRecorder() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
        this.soundRecorderModal.classList.add('hidden');
    }

    showRecorderError(message) {
        this.recorderMessage.textContent = message;
        this.recorderMessage.classList.remove('hidden');
        this.recorderUIContent.classList.add('hidden');
    }

    resetRecorderState() {
        this.recorderMessage.classList.add('hidden');
        this.recorderUIContent.classList.remove('hidden');
        this.recorderRecordBtn.classList.remove('hidden');
        this.recorderStopBtn.classList.add('hidden');
        this.recorderRerecordBtn.classList.add('hidden');
        this.recorderSaveBtn.classList.add('hidden');
        this.recorderPreviewContainer.classList.add('hidden');
        this.recorderTimer.textContent = '0.0 / 15.0';
        this.recorderVisualizer.classList.remove('is-recording');
        if (this.recorderTimerInterval) clearInterval(this.recorderTimerInterval);
        this.audioChunks = [];
        this.recordedBlob = null;
    }

    startRecording() {
        this.mediaRecorder = new MediaRecorder(this.mediaStream);
        this.mediaRecorder.start();
        
        this.recorderVisualizer.classList.add('is-recording');
        this.recorderRecordBtn.classList.add('hidden');
        this.recorderStopBtn.classList.remove('hidden');
        
        let startTime = Date.now();
        this.recorderTimerInterval = setInterval(() => {
            const seconds = ((Date.now() - startTime) / 1000);
            this.recorderTimer.textContent = `${seconds.toFixed(1)} / 15.0`;
            if (seconds >= 15) this.stopRecording();
        }, 100);
        
        this.mediaRecorder.addEventListener("dataavailable", event => {
            this.audioChunks.push(event.data);
        });
        
        this.mediaRecorder.addEventListener("stop", () => {
             this.recordedBlob = new Blob(this.audioChunks, { type: 'audio/mp3' });
             const audioUrl = URL.createObjectURL(this.recordedBlob);
             this.recorderAudioPreview.src = audioUrl;
             
             this.recorderStopBtn.classList.add('hidden');
             this.recorderRerecordBtn.classList.remove('hidden');
             this.recorderSaveBtn.classList.remove('hidden');
             this.recorderPreviewContainer.classList.remove('hidden');
             this.recorderSoundName.value = `My Sound ${this.getActiveSprite()?.sounds.length + 1 || 1}`;
        });
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
        this.recorderVisualizer.classList.remove('is-recording');
        if (this.recorderTimerInterval) clearInterval(this.recorderTimerInterval);
    }

    async saveRecording() {
        const sprite = this.getActiveSprite();
        if (!sprite || !this.recordedBlob) return;
        
        const name = this.recorderSoundName.value.trim() || 'Recorded Sound';
        
        if (sprite.sounds.some(s => s.name === name)) {
            alert(`A sound with the name "${name}" already exists.`);
            return;
        }

        try {
            const url = await this.readFileAsDataURL(this.recordedBlob);
            const addedSound = await this.soundManager.addSound({ name, url });
            if (addedSound) {
                sprite.sounds.push({ name, url });
                this.renderSpriteSounds(sprite);
                this.workspace.refreshToolboxSelection();
            }
            this.closeSoundRecorder();
        } catch (error) {
            console.error("Error saving recording:", error);
            this.showRecorderError("Could not save the recording.");
        }
    }

    stopPreview() {
        this.soundManager.stopPreview();
    }
}

const soundUIController = new SoundUIController();

// Export the single instance for index.js to use.
export default soundUIController;
