class ARVideoApp {
    constructor() {
        this.isTargetDetected = false;
        this.isARReady = false;
        this.loadingContainer = document.getElementById('loading-container');
        this.loadingText = document.getElementById('loading-text');
        this.instructionContainer = document.getElementById('instruction-container');
        this.permissionError = document.getElementById('permission-error');
        this.arContainer = document.getElementById('ar-container');
        
        this.init();
    }

    async init() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                this.showError('Your browser does not support camera access');
                return;
            }

            this.updateLoadingText('Requesting camera access...');
            
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    } 
                });
                stream.getTracks().forEach(track => track.stop());
            } catch (error) {
                console.error('Camera permission denied:', error);
                this.showPermissionError();
                return;
            }

            this.updateLoadingText('Compiling target image...');
            
            const targetImage = new Image();
            // Don't set crossOrigin for file:// protocol (local files)
            if (!window.location.protocol.startsWith('file')) {
                targetImage.crossOrigin = 'anonymous';
            }
            targetImage.src = 'assets/target.jpg';
            
            await new Promise((resolve, reject) => {
                targetImage.onload = resolve;
                targetImage.onerror = () => reject(new Error('Failed to load target image. Make sure target.jpg exists in assets folder.'));
                // Timeout if image takes too long
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
});
