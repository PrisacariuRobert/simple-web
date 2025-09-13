document.addEventListener('DOMContentLoaded', function() {

    // Simple scroll reveal animation
    const revealElements = document.querySelectorAll('.reveal');

    const revealOnScroll = () => {
        const windowHeight = window.innerHeight;
        for (let i = 0; i < revealElements.length; i++) {
            const elementTop = revealElements[i].getBoundingClientRect().top;
            const elementVisible = 150; // Distance from bottom of viewport to trigger animation

            if (elementTop < windowHeight - elementVisible) {
                revealElements[i].classList.add('active');
            } else {
                revealElements[i].classList.remove('active'); // Optional: remove to re-trigger animation
            }
        }
    };

    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll(); // Initial check
    
    // Autoplay section videos when they scroll into view
    const featureVideos = document.querySelectorAll('#features .feature-image-placeholder video');
    const designVideos = document.querySelectorAll('#design .design-video');
    const allVideos = [...featureVideos, ...designVideos];

    // Ensure videos don't load and play until needed
    allVideos.forEach(v => {
        try {
            v.preload = 'metadata';
            v.pause();
            v.currentTime = 0;
        } catch (e) { /* noop */ }
    });

    const playVideo = (video) => {
        if (!video) return;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.then === 'function') {
            playPromise.catch(() => {});
        }
    };

    const pauseAndReset = (video) => {
        if (!video) return;
        video.pause();
        // Reset so it starts from the beginning next time
        video.currentTime = 0;
    };

    if ('IntersectionObserver' in window) {
        const videoObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const video = entry.target;
                if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
                    playVideo(video);
                } else {
                    pauseAndReset(video);
                }
            });
        }, {
            root: null,
            // Start a little before fully centered; negative bottom margin keeps playing until mostly out of view
            rootMargin: '0px 0px -10% 0px',
            threshold: [0, 0.2, 0.4, 0.6, 0.8, 1],
        });

        allVideos.forEach(v => videoObserver.observe(v));
    } else {
        // Fallback for older browsers without IntersectionObserver
        const checkVideosInView = () => {
            const vh = window.innerHeight || document.documentElement.clientHeight;
            allVideos.forEach(v => {
                const rect = v.getBoundingClientRect();
                const visible = rect.top < vh * 0.6 && rect.bottom > vh * 0.4;
                if (visible) {
                    playVideo(v);
                } else {
                    pauseAndReset(v);
                }
            });
        };
        window.addEventListener('scroll', checkVideosInView, { passive: true });
        window.addEventListener('resize', checkVideosInView);
        checkVideosInView();
    }

    // Pause all videos if the tab becomes hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            allVideos.forEach(pauseAndReset);
        }
    });

    // Dynamically point download links to the latest GitHub Release asset
    (function setupLatestReleaseDownloads() {
        const owner = 'BragiAI';
        const repo = 'simple_website';
        const api = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
        const links = document.querySelectorAll('a[data-download]');
        if (!links.length) return;

        try {
            fetch(api, {
                headers: { 'Accept': 'application/vnd.github+json' },
                cache: 'no-store',
            })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (!data || !Array.isArray(data.assets)) return;
                const assets = data.assets;

                // Prefer a macOS .dmg asset, then a mac-related .zip, then any .zip
                let asset = assets.find(a => /\.dmg$/i.test(a.name) && /(mac|osx|darwin|arm64|universal)/i.test(a.name));
                if (!asset) asset = assets.find(a => /\.dmg$/i.test(a.name));
                if (!asset) asset = assets.find(a => /\.zip$/i.test(a.name) && /(mac|osx|darwin|arm64|universal)/i.test(a.name));
                if (!asset) asset = assets.find(a => /\.zip$/i.test(a.name));

                const url = asset && asset.browser_download_url;
                if (!url) return;

                links.forEach(a => {
                    a.href = url;
                    a.target = '_blank';
                    a.rel = 'noopener';
                    a.setAttribute('data-source', 'github-release');
                });
            })
            .catch(() => { /* silently keep the fallback hrefs */ });
        } catch (_) {
            // ignore; fallback to the hardcoded links in HTML
        }
    })();

    // Download tracking + private admin panel
    (function() {
        const search = new URLSearchParams(location.search);
        const isAdminFlag = search.get('simple_admin') === '1';
        const providedSecret = (search.get('secret') || '').trim();
        const adminPanel = document.getElementById('admin-panel');
        const countEl = document.getElementById('download-count');
        const downloadLinks = document.querySelectorAll('a[data-download]');

        // Namespace + key for CountAPI
        const NS = 'simple_browser_site';
        const KEY = 'mac_arm64_dmg_v1';

        const createUrl = `https://api.countapi.xyz/create?namespace=${encodeURIComponent(NS)}&key=${encodeURIComponent(KEY)}&value=0`;
        const getUrl = `https://api.countapi.xyz/get/${NS}/${KEY}`;
        const hitUrl = `https://api.countapi.xyz/hit/${NS}/${KEY}`;

        // Best-effort: ensure the counter exists
        fetch(createUrl).catch(() => {});

        const updateUI = async () => {
            if (!countEl) return;
            try {
                const res = await fetch(getUrl, { cache: 'no-store' });
                const data = await res.json();
                countEl.textContent = (data && typeof data.value === 'number') ? String(data.value) : '0';
            } catch (e) {
                // Fallback to local value so the panel still shows something
                try {
                    countEl.textContent = String(parseInt(localStorage.getItem('dl_count') || '0', 10));
                } catch (_) {
                    countEl.textContent = '0';
                }
            }
        };

        // Admin secret verification
        const sha256Hex = async (text) => {
            if (!('crypto' in window) || !('subtle' in window.crypto)) {
                // Fallback: if WebCrypto is unavailable, return empty to avoid false positives
                return '';
            }
            const enc = new TextEncoder().encode(text);
            const buf = await window.crypto.subtle.digest('SHA-256', enc);
            return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        };

        const loadAdminConfig = async () => {
            try {
                const res = await fetch('admin-config.json', { cache: 'no-store' });
                if (!res.ok) return null;
                return await res.json();
            } catch (_) {
                return null;
            }
        };

        const allowAdmin = async () => {
            if (!isAdminFlag) return false;
            const cfg = await loadAdminConfig();
            if (!cfg) return false;
            // Prefer hash validation when available
            if (cfg.secretHash) {
                try {
                    const hash = await sha256Hex(providedSecret);
                    if (hash && hash === cfg.secretHash) return true;
                } catch (_) { /* noop */ }
            }
            if (cfg.secretPlain) {
                return providedSecret === cfg.secretPlain;
            }
            return false;
        };

        // Increment when a tracked link is clicked
        downloadLinks.forEach(a => {
            a.addEventListener('click', () => {
                try {
                    fetch(hitUrl, { cache: 'no-store', keepalive: true }).catch(() => {});
                } catch (e) { /* noop */ }
                // Local fallback counter so you still see growth in panel if offline
                try {
                    const v = (parseInt(localStorage.getItem('dl_count') || '0', 10) + 1);
                    localStorage.setItem('dl_count', String(v));
                } catch (_) { /* noop */ }
            }, { passive: true });
        });

        // Show admin panel only when the special query flag and valid secret are present
        if (adminPanel) {
            allowAdmin().then((ok) => {
                if (ok) {
                    adminPanel.hidden = false;
                    updateUI();
                    // Refresh periodically
                    setInterval(updateUI, 15000);
                }
            });
        }
    })();
    
});
