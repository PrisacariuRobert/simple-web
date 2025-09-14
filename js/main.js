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
    
    // Autoplay videos when they scroll into view (include hero + tutorial)
    const featureVideos = document.querySelectorAll('#features .feature-image-placeholder video');
    const designVideos = document.querySelectorAll('#design .design-video');
    const heroVideos = document.querySelectorAll('.hero-image-placeholder video');
    const tutorialVideos = document.querySelectorAll('#tutorial .step-video');
    const allVideos = [...featureVideos, ...designVideos, ...heroVideos, ...tutorialVideos];

    // Normalize attributes for mobile autoplay reliability
    allVideos.forEach(v => {
        try {
            v.muted = true;
            v.setAttribute('muted', '');
            v.setAttribute('playsinline', '');
            v.setAttribute('webkit-playsinline', '');
            v.removeAttribute('controls');
            v.preload = 'auto'; // Change to 'auto' for more aggressive loading
            v.pause();
            v.currentTime = 0;
            
            // Add comprehensive event logging
            ['loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough', 'error', 'stalled', 'suspend'].forEach(event => {
                v.addEventListener(event, () => {
                    console.log(`Video ${event}:`, v.src, 'readyState:', v.readyState);
                });
            });
            
            // Force load on mobile to ensure video is ready
            v.load();
            
            // Add error handling
            v.addEventListener('error', () => {
                console.log('Video error:', v.src, v.error);
                // Show poster if video fails
                v.style.display = 'none';
                const container = v.parentElement;
                if (container && !container.querySelector('.video-fallback')) {
                    const fallback = document.createElement('div');
                    fallback.className = 'video-fallback';
                    fallback.style.cssText = 'width:100%;height:100%;background:#333;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;';
                    fallback.textContent = 'Video unavailable - tap to retry';
                    fallback.addEventListener('click', () => {
                        v.style.display = 'block';
                        v.load();
                        fallback.remove();
                    });
                    container.appendChild(fallback);
                }
            });
            
        } catch (e) { console.log('Video setup error:', e); }
    });

    const playVideo = (video) => {
        if (!video) return;
        console.log('Attempting to play video:', video.src, 'readyState:', video.readyState);
        if (video.readyState < 2) {
            console.log('Video not ready, loading first');
            video.load();
            video.addEventListener('canplay', () => {
                const playPromise = video.play();
                if (playPromise && typeof playPromise.then === 'function') {
                    playPromise.catch(e => console.log('Play failed after load:', e));
                }
            }, { once: true });
        } else {
            const playPromise = video.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.catch(e => console.log('Play failed:', e));
            }
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
                if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
                    playVideo(video);
                } else {
                    pauseAndReset(video);
                }
            });
        }, {
            root: null,
            // Start when a quarter of the video is visible
            rootMargin: '0px 0px -15% 0px',
            threshold: [0, 0.25, 0.5, 0.75, 1],
        });

        allVideos.forEach(v => videoObserver.observe(v));
    } else {
        // Fallback for older browsers without IntersectionObserver
        const checkVideosInView = () => {
            const vh = window.innerHeight || document.documentElement.clientHeight;
            allVideos.forEach(v => {
                const rect = v.getBoundingClientRect();
                const visible = rect.top < vh * 0.75 && rect.bottom > vh * 0.25;
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

    // As a final fallback, attempt play on first user interaction (iOS stricter modes)
    const tryPlayAll = () => {
        allVideos.forEach(v => {
            try { 
                if (v.paused && v.readyState >= 2) {
                    v.play().catch(() => {});
                }
            } catch (_) {}
        });
        window.removeEventListener('touchstart', tryPlayAll, { passive: true });
        window.removeEventListener('click', tryPlayAll, { passive: true });
    };
    window.addEventListener('touchstart', tryPlayAll, { passive: true });
    window.addEventListener('click', tryPlayAll, { passive: true });
    
    // Force reload videos after a delay to handle mobile loading issues
    setTimeout(() => {
        allVideos.forEach(v => {
            console.log('Video state check:', v.src, 'readyState:', v.readyState, 'networkState:', v.networkState);
            if (v.readyState === 0) {
                console.log('Reloading video:', v.src);
                v.load();
            }
        });
    }, 2000);
    
    // Add click handlers to poster images to manually trigger video load
    allVideos.forEach(v => {
        v.addEventListener('click', () => {
            console.log('Manual video play attempt:', v.src);
            if (v.readyState === 0) {
                v.load();
            }
            setTimeout(() => {
                v.play().catch(e => console.log('Manual play failed:', e));
            }, 100);
        });
    });

    // Dynamically point download links to the latest GitHub Release asset
    (function setupLatestReleaseDownloads() {
        const owner = 'PrisacariuRobert';
        const repo = 'simple-web';
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
