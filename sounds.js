
/**
 * @fileoverview Sound management module for the KidiCode application.
 */

// A library of default sounds available to the user.
export const soundLibrary = [
    { name: 'Pop', url: 'https://codejredu.github.io/test/assets/sounds/pop.mp3' },
    { name: 'Meow', url: 'https://codejredu.github.io/test/assets/sounds/meow.mp3' },
    { name: 'Boing', url: 'https://codejredu.github.io/test/assets/sounds/boing.mp3' },
    { name: 'Alert', url: 'https://codejredu.github.io/test/assets/sounds/alert.mp3' },
    { name: 'Coin', url: 'https://codejredu.github.io/test/assets/sounds/coin.mp3' },
    { name: 'Laser', url: 'https://codejredu.github.io/test/assets/sounds/laser.mp3' },
    { name: 'Wobble', url: 'https://codejredu.github.io/test/assets/sounds/wobble.mp3' },
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
}

let soundManagerInstance = null;

export function getSoundManager() {
    if (!soundManagerInstance) {
        soundManagerInstance = new SoundManager();
    }
    return soundManagerInstance;
}
