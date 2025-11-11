

/**
 * @fileoverview Sound management module for the KidiCode application.
 */

// A library of default sounds available to the user.
export const soundLibrary = [
    { name: "Boat Start", url: "https://codejredu.github.io/test/assets/sound/BoatStart.mp3" },
    { name: "Car Door", url: "https://codejredu.github.io/test/assets/sound/CARDOOR.mp3" },
    { name: "Elevator Ding", url: "https://codejredu.github.io/test/assets/sound/ElevatorDing.mp3" },
    { name: "Water Emptying", url: "https://codejredu.github.io/test/assets/sound/WaterEmptying.mp3" },
    { name: "Water Vole Diving", url: "https://codejredu.github.io/test/assets/sound/WaterVole.mp3" },
    { name: "Air Land", url: "https://codejredu.github.io/test/assets/sound/airland.mp3" },
    { name: "Airplane Cessna", url: "https://codejredu.github.io/test/assets/sound/airplanecessna.mp3" },
    { name: "Airplane F15", url: "https://codejredu.github.io/test/assets/sound/airplanef15.mp3" },
    { name: "Animal Howl", url: "https://codejredu.github.io/test/assets/sound/animals.mp3" },
    { name: "Crowd", url: "https://codejredu.github.io/test/assets/sound/crowds.mp3" },
    { name: "Bird Call", url: "https://codejredu.github.io/test/assets/sound/double.mp3" },
    { name: "Partridge", url: "https://codejredu.github.io/test/assets/sound/grey.mp3" },
    { name: "Pygmy Shrew", url: "https://codejredu.github.io/test/assets/sound/pygmy.mp3" },
    { name: "School", url: "https://codejredu.github.io/test/assets/sound/schools.mp3" },
    { name: "Flycatcher", url: "https://codejredu.github.io/test/assets/sound/vermilion.mp3" },
    { name: "Ding", url: "https://codejredu.github.io/test/assets/sound/dingsoundeffect2.mp3" },
    { name: "Dog", url: "https://codejredu.github.io/test/assets/sound/dog.mp3" },
    { name: "Leopard", url: "https://codejredu.github.io/test/assets/sound/leopard7.mp3" },
    { name: "Link", url: "https://codejredu.github.io/test/assets/sound/link.mp3" },
    { name: "Lion Cub", url: "https://codejredu.github.io/test/assets/sound/lioncub.mp3" },
    { name: "Whale", url: "https://codejredu.github.io/test/assets/sound/whale3.mp3" },
];

class Sound {
    constructor(id, name, url, arrayBuffer) {
        this.id = id;
        this.name = name;
        this.url = url;
        this.arrayBuffer = arrayBuffer;
        this.audioBuffer = null;
        this.source = null;
    }
}

class SoundManager {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = new Map();
        this.nextSoundId = 0;
        this.previewSource = null; // To keep track of the preview audio source
    }

    async addSound({ name, url, arrayBuffer }) {
        const id = `sound-${this.nextSoundId++}`;
        const sound = new Sound(id, name, url, arrayBuffer);
        
        try {
            if (!arrayBuffer) {
                const response = await fetch(url);
                sound.arrayBuffer = await response.arrayBuffer();
            }
            sound.audioBuffer = await this.audioContext.decodeAudioData(sound.arrayBuffer.slice(0));
            this.sounds.set(id, sound);
            return sound;
        } catch (error) {
            console.error(`Failed to load sound: ${name}`, error);
            return null;
        }
    }

    getSound(id) {
        return this.sounds.get(id);
    }
    
    getAllSounds() {
        return Array.from(this.sounds.values());
    }

    deleteSound(id) {
        this.sounds.delete(id);
    }

    playSound(id) {
        const sound = this.getSound(id);
        if (sound && sound.audioBuffer) {
            // Stop any currently playing instance of this sound
            if (sound.source) {
                sound.source.stop();
            }
            
            sound.source = this.audioContext.createBufferSource();
            sound.source.buffer = sound.audioBuffer;
            sound.source.connect(this.audioContext.destination);
            sound.source.start(0);

            return new Promise(resolve => {
                sound.source.onended = () => {
                    sound.source = null;
                    resolve();
                };
            });
        }
        return Promise.resolve();
    }

    async playSoundFromUrl(url) {
        try {
            // Resume AudioContext if it's suspended, as required by modern browsers.
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Stop any previous preview sound that might be playing
            if (this.previewSource) {
                this.previewSource.stop();
            }
            const response = await fetch(url);
            if (!response.ok) { // Check for fetch errors (like 404)
                throw new Error(`Failed to fetch sound: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            // Use slice(0) to create a copy, as decodeAudioData can sometimes detach the buffer
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
            
            this.previewSource = this.audioContext.createBufferSource();
            this.previewSource.buffer = audioBuffer;
            this.previewSource.connect(this.audioContext.destination);
            this.previewSource.start(0);
            
            // Clean up the source reference once it finishes playing
            this.previewSource.onended = () => {
                this.previewSource = null;
            };

        } catch (error) {
            console.error(`Error playing sound from URL ${url}:`, error);
        }
    }

    stopPreview() {
        if (this.previewSource) {
            try {
                this.previewSource.stop();
            } catch (e) {
                // It might have already stopped, which can throw an error. Ignore it.
                console.warn("Could not stop preview source, it might have already finished.", e);
            }
            this.previewSource = null;
        }
    }
}

let soundManagerInstance = null;

export function getSoundManager() {
    if (!soundManagerInstance) {
        soundManagerInstance = new SoundManager();
    }
    return soundManagerInstance;
}