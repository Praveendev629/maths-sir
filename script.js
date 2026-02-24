class ARVideoApp {
    constructor() {
        this.isTargetDetected = false;
        this.isARReady = false;
        this.loadingContainer = document.getElementById('loading-container');
        this.loadingText = document.getElementById('loading-text');
        this.instructionContainer = document.getElementById('instruction-container');
        this.permissionError = document.getElementById('permission-error');
        this.arContainer = document.getElementById('ar-container');
        this.permissionScreen = document.getElementById('camera-permission-screen');

        this.checkExistingPermission();
    }

    async checkExistingPermission() {
        try {
            // Check if camera permission was already granted (e.g. from a previous PWA session)
            if (navigator.permissions && navigator.permissions.query) {
                const result = await navigator.permissions.query({ name: 'camera' });
                if (result.state === 'granted') {
                    // Already have permission — skip custom screen, go straight to AR
                    this.permissionScreen.classList.add('hidden');
                    this.loadingContainer.classList.remove('hidden');
                    this.init();
                    return;
                }
            }
        } catch (e) {
            // Permissions API not supported for camera in some browsers — fall through to buttons
            console.log('Permissions API check skipped:', e.message);
        }

        // Show the custom permission screen with Allow/Deny buttons
        this.setupPermissionButtons();
    }

    setupPermissionButtons() {
        const allowBtn = document.getElementById('btn-allow-camera');
        const denyBtn = document.getElementById('btn-deny-camera');

        allowBtn.addEventListener('click', async () => {
            allowBtn.disabled = true;
            allowBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin-icon"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Requesting...
            `;

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    }
                });
                stream.getTracks().forEach(track => track.stop());

                // Permission granted — hide the screen and start AR
                this.permissionScreen.classList.add('hidden');
                this.loadingContainer.classList.remove('hidden');
                this.init();
            } catch (error) {
                console.error('Camera permission denied:', error);
                allowBtn.disabled = false;
                allowBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Try Again
                `;
                const card = document.querySelector('.permission-card');
                let msg = card.querySelector('.denied-message');
                if (!msg) {
                    msg = document.createElement('div');
                    msg.className = 'denied-message';
                    card.appendChild(msg);
                }
                msg.textContent = 'Camera access was blocked. Please allow camera access in your browser settings, then tap "Try Again".';
            }
        });

        denyBtn.addEventListener('click', () => {
            const card = document.querySelector('.permission-card');
            let msg = card.querySelector('.denied-message');
            if (!msg) {
                msg = document.createElement('div');
                msg.className = 'denied-message';
                card.appendChild(msg);
            }
            msg.textContent = 'Camera access is required for the AR experience. Tap "Allow Camera" when you are ready.';
        });
    }

    async init() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                this.showError('Your browser does not support camera access');
                return;
            }

            this.updateLoadingText('Compiling target image...');

            const targetImage = new Image();
            if (!window.location.protocol.startsWith('file')) {
                targetImage.crossOrigin = 'anonymous';
            }
            targetImage.src = 'assets/target.jpg';

            await new Promise((resolve, reject) => {
                targetImage.onload = resolve;
                targetImage.onerror = () => reject(new Error('Failed to load target image. Make sure target.jpg exists in assets folder.'));
                setTimeout(() => reject(new Error('Image loading timeout')), 10000);
            });

            this.updateLoadingText('Training AR model... 50%');

            const compiler = new MINDAR.IMAGE.Compiler();
            const dataList = await compiler.compileImageTargets([targetImage], (progress) => {
                const percent = Math.round(progress * 100);
                this.updateLoadingText(`Training AR model... ${percent}%`);
            });

            const exportedBuffer = await compiler.exportData();

            this.updateLoadingText('Starting AR...');
            await this.startAR(exportedBuffer);

        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize AR: ' + error.message);
        }
    }

    async startAR(mindFileData) {
        try {
            const blob = new Blob([mindFileData]);
            const mindFileUrl = URL.createObjectURL(blob);

            this.arContainer.innerHTML = `
                <a-scene
                    id="arscene"
                    mindar-image="imageTargetSrc: ${mindFileUrl}; autoStart: true; uiLoading: no; uiScanning: no; uiError: no;"
                    color-space="sRGB"
                    renderer="colorManagement: true, physicallyCorrectLights"
                    vr-mode-ui="enabled: false"
                    device-orientation-permission-ui="enabled: false"
                    embedded>
                    
                    <a-assets>
                        <video id="video-texture" src="assets/video.mp4" loop playsinline crossorigin="anonymous"></video>
                    </a-assets>
                    
                    <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

                    <a-entity mindar-image-target="targetIndex: 0">
                        <a-video
                            id="video-plane"
                            src="#video-texture"
                            position="0 0 0"
                            rotation="0 0 0"
                            width="1"
                            height="0.75"
                            visible="true">
                        </a-video>
                    </a-entity>
                </a-scene>
            `;

            const arScene = document.getElementById('arscene');
            this.videoTexture = document.getElementById('video-texture');

            arScene.addEventListener('arReady', () => {
                console.log('AR Ready');
                this.isARReady = true;
                this.hideLoading();
                this.showInstruction();
            });

            arScene.addEventListener('arError', (event) => {
                console.error('AR Error:', event);
                this.showError('AR error occurred');
            });

            const target = document.querySelector('[mindar-image-target]');

            target.addEventListener('targetFound', () => {
                console.log('Target found - playing video');
                this.isTargetDetected = true;
                this.videoTexture.play().catch(e => console.log('Video play error:', e));
            });

            target.addEventListener('targetLost', () => {
                console.log('Target lost - pausing video');
                this.isTargetDetected = false;
                this.videoTexture.pause();
                this.videoTexture.currentTime = 0;
            });

        } catch (error) {
            console.error('AR start error:', error);
            this.showError('Failed to start AR: ' + error.message);
        }
    }

    updateLoadingText(text) {
        if (this.loadingText) {
            this.loadingText.textContent = text;
        }
    }

    hideLoading() {
        this.loadingContainer.classList.add('hidden');
    }

    showInstruction() {
        this.instructionContainer.classList.remove('hidden');
    }

    showPermissionError() {
        this.loadingContainer.classList.add('hidden');
        this.permissionError.classList.remove('hidden');
    }

    showError(message) {
        this.loadingContainer.classList.add('hidden');
        this.permissionError.classList.remove('hidden');
        document.getElementById('error-message').textContent = message;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ARVideoApp();

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered:', reg.scope))
            .catch(err => console.log('Service Worker registration failed:', err));
    }
});
