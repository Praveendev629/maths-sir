# Run AR App Locally

## On Windows

### Option 1: Python Server (Easiest)
```bash
# Open Command Prompt in project folder
python -m http.server 8000

# Then open browser
http://localhost:8000
```

### Option 2: Direct File Open
- Simply double-click `index.html`
- It will open in your default browser
- App works on `file://` protocol now!

## On Mac

### Option 1: Python Server
```bash
python3 -m http.server 8000
# Then open: http://localhost:8000
```

### Option 2: Direct File Open
- Double-click `index.html`
- Opens in Safari/Chrome
- Works on `file://` protocol!

## On Linux

### Option 1: Python Server
```bash
python3 -m http.server 8000
# Then open: http://localhost:8000
```

### Option 2: Direct File Open
- Right-click `index.html` → Open with Browser
- Works on `file://` protocol!

## Testing on Mobile (Same Network)

1. **Find your computer's IP:**
   - Windows: `ipconfig` (look for IPv4)
   - Mac/Linux: `ifconfig` (look for inet)

2. **On mobile phone:**
   ```
   http://YOUR_COMPUTER_IP:8000
   ```

3. **Or use QR code generator:**
   - Generate QR for your local IP URL
   - Scan with phone camera

## Troubleshooting

**"Module not found" error:**
- Make sure all files are in the project folder
- Check `assets/target.jpg` exists
- Check `assets/video.mp4` exists

**"Failed to load target image":**
- Verify `assets/target.jpg` is in the right folder
- Try re-downloading the project

**Camera not working:**
- Use HTTPS or `localhost` (not IP address from Mac/Linux)
- Grant camera permission when asked
- On Safari: Settings → Safari → Camera → Allow

**Video not playing:**
- Check `assets/video.mp4` file size (should be <50MB)
- Verify video format is MP4
- Try opening video in media player first

## Project Structure

```
project-folder/
├── index.html
├── style.css
├── script.js
└── assets/
    ├── target.jpg
    └── video.mp4
```

Everything else is optional for local testing.

---

Once it works locally, deploy to Netlify for live sharing!
