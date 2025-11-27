# darkpattern-extension

`darkpattern-extension` is a Chrome extension that provides inline security indicators against dark patterns present on websites.

Here is an example of the extension while running:
![screenshot-of-extension-demo](screenshots/extension-demo.png)

The detector is capable of recognizing 6 categories of dark patterns:
1. Confirm Shaming
2. Obscured Interface
3. Preselected Opt-in
4. Trick Question / Double Negative
5. Urgency
6. Disguised Advert

All of the six categories can be seen in the screenshot above.

## Running Instructions

1. Download and extract this source code.
2. Go to your favorite browser, navigate to `chrome://extensions` for Chromium-based browsers
3. Enable `Developer Mode`
4. Click `Load Unpacked` and choose the folder of the extension

This will load the extension in your browser for testing. Now you can navigate to any website and preview the results of the extension.

The `demo-site.html` site is provided so you can test the extension against a known target.