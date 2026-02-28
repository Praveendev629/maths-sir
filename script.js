class ARVideoApp {
    constructor() {
        this.isTargetDetected = false;
        this.isARReady = false;
        this.loadingContainer = document.getElementById('loading-container');
        this.loadingText = document.getElementById('loading-text');
        this.loadingSubtext = document.getElementById('loading-subtext');
        this.progressBar = document.getElementById('progress-bar');
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
                        facingMode: { exact: 'environment' },
                        width: { ideal: 4096, min: 1920, max: 7680 },
                        height: { ideal: 2160, min: 1080, max: 4320 },
                        frameRate: { ideal: 60, max: 120 },
                        // hint to use the sharpest focus and highest quality available
                        focusMode: 'continuous',
                        advanced: [
                            { torch: false },
                            { zoom: 1.0 }
                        ]
                    }
                }).catch(() => {
                    // Fallback if exact environment camera is unavailable
                    return navigator.mediaDevices.getUserMedia({
                        video: {
                            facingMode: 'environment',
                            width: { ideal: 4096 },
                            height: { ideal: 2160 }
                        }
                    });
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

            this.updateLoadingText('Compiling targets...', 0.1);

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

            const compiler = new MINDAR.IMAGE.Compiler();
            const dataList = await compiler.compileImageTargets([targetImage], (progress) => {
                // Map 0-1 progress to 0-7500 scale for text, and 0-100% for bar
                this.updateLoadingText('Training AR model...', progress);
            });

            const exportedBuffer = await compiler.exportData();

            this.updateLoadingText('Starting AR...', 0.95);
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

            // High-quality primary rear camera constraints for MindAR
            const videoSettings = JSON.stringify({
                facingMode: { exact: 'environment' },
                width: { ideal: 4096, min: 1920, max: 7680 },
                height: { ideal: 2160, min: 1080, max: 4320 },
                frameRate: { ideal: 60, min: 24, max: 120 },
                aspectRatio: { ideal: 16 / 9 },
                // request high quality focus if supported
                focusMode: 'continuous'
            });

            this.arContainer.innerHTML = `
                <a-scene
                    id="arscene"
                    mindar-image="imageTargetSrc: ${mindFileUrl}; autoStart: true; uiLoading: no; uiScanning: no; uiError: no; filterMinCF: 0.001; filterBeta: 1000; warmupTolerance: 5; missTolerance: 5;"
                    color-space="sRGB"
                    renderer="colorManagement: true, physicallyCorrectLights"
                    vr-mode-ui="enabled: false"
                    device-orientation-permission-ui="enabled: false"
                    embedded>
                    
                    <a-assets>
                        <video id="video-texture" src="assets/video.mp4" loop playsinline crossorigin="anonymous"></video>
                    </a-assets>
                    
                    <a-camera position="0 0 0" look-controls="enabled: false"
                        mindar-image-camera="videoSettings: ${videoSettings.replace(/"/g, '&quot;')}">
                    </a-camera>

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

    updateLoadingText(text, progress = 0) {
        if (this.loadingText) {
            this.loadingText.textContent = text;
        }

        let percent = Math.min(100, Math.max(0, Math.round(progress * 100)));
        if (progress >= 0.95) percent = 100;

        if (this.progressBar) {
            this.progressBar.style.width = `${percent}%`;
        }

        if (this.loadingSubtext) {
            if (percent === 0) {
                this.loadingSubtext.textContent = 'Loading...';
            } else {
                this.loadingSubtext.textContent = `${percent}% loading`;
            }
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
