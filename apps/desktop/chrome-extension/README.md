# Mote visible context for Chrome

The desktop app packages this directory and a narrow native messaging host. It reads visible page evidence only in response to an enabled Mote capture. It supports regular Google Chrome windows on the primary display. Incognito windows, ambiguous profiles, browser/native identity mismatches and unavailable permissions fail closed.

1. In Mote’s capture settings, set up the Chrome extension. This registers `dev.mote.visible_context` in the current macOS user’s Chrome NativeMessagingHosts directory and opens this packaged directory.
2. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this directory. The committed public manifest key fixes the extension ID to `pbbellhponddchkfhamenccknhnhhfec`.
3. Open a site, open the extension popup, and choose **Allow this site**. Also add its exact origin (scheme, hostname and port) to Mote’s allowed browser origins and enable structured capture for Google Chrome. The extension never requests all-site access automatically.
4. Keep one connected regular Chrome profile. Multiple connected profiles cause capture to stop until only one remains. A page reload may be needed after granting access.

The desktop must be running. The native host only relays bounded observation messages over a private per-process Unix socket. It cannot run commands, open arbitrary files, or access Central credentials. Its only file read is the descriptor installed by Mote, with ownership and private-mode checks. The launcher uses the packaged Electron executable in Node mode and `dist/chrome-native-host.js`; keep the installed application path stable or run setup again after moving it.

Full-display Chrome screenshots additionally require the native helper to prove exactly one visible Chrome window. A second Chrome window or an ambiguous native window count blocks the screenshot while an independently verified allowed foreground page can still provide structured evidence.

Screenshot-only requests read browser identity and viewport geometry without DOM, title or media reads. Duration-only capture does not use the extension. Structured capture reads only whole visible leaf text ranges, excludes editable controls, hidden or clipped ranges, covered ranges and masked areas, and marks its bounded result partial. Initial selectors cover Zhihu answers, Bilibili video pages, and an unambiguous generic main/article region. Playback position is separate media metadata. Layout changes can yield no structured content; this never authorizes reading hidden text.

Site permission can be revoked in the popup or Chrome’s extension settings. Disabling the extension disconnects the bridge and invalidates outstanding identity leases. Desktop browser-origin rules still apply independently of Chrome permissions. Native macOS foreground/window verification is required before and after each sample and again around a screenshot. Generated fixture tests do not establish physical macOS browser identity behavior.
