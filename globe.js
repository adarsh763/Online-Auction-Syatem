/* ═══════════════════════════════════════════════════════════
   Premium 3D Globe — Online Auction Hero
   Three.js · Procedural Earth · Connection Arcs · Atmosphere
   ═══════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    // ── Configuration ──
    const CONFIG = {
        globeRadius: 2.2,
        rotationSpeed: 0.001,
        arcColor: 0x00d4ff,
        cityDotColor: 0x00d4ff,
        atmosphereColor: 0x4fc3f7,
        starCount: 1800,
        arcCount: 8,
        particlesPerArc: 6,
    };

    // ── City Coordinates (lat, lon) ──
    const CITIES = [
        { name: 'New York', lat: 40.7128, lon: -74.006 },
        { name: 'London', lat: 51.5074, lon: -0.1278 },
        { name: 'Dubai', lat: 25.2048, lon: 55.2708 },
        { name: 'Mumbai', lat: 19.076, lon: 72.8777 },
        { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
        { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
        { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
        { name: 'Paris', lat: 48.8566, lon: 2.3522 },
        { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
        { name: 'São Paulo', lat: -23.5505, lon: -46.6333 },
    ];

    // ── Connection Routes ──
    const ROUTES = [
        [0, 1], // NY → London
        [1, 3], // London → Mumbai
        [3, 4], // Mumbai → Tokyo
        [4, 6], // Tokyo → Sydney
        [2, 3], // Dubai → Mumbai
        [5, 0], // LA → NY
        [1, 7], // London → Paris
        [8, 4], // Singapore → Tokyo
        [0, 9], // NY → São Paulo
        [2, 8], // Dubai → Singapore
    ];

    let scene, camera, renderer, globe, atmosphere, starField;
    let arcs = [], particles = [], cityDots = [];
    let mouseX = 0, mouseY = 0;
    let targetRotationX = 0, targetRotationY = 0;
    let animationId;

    // ═══════════════════════════════════════════════
    //  Init
    // ═══════════════════════════════════════════════
    function initGlobe() {
        const container = document.getElementById('globe-container');
        if (!container || typeof THREE === 'undefined') return;

        // Scene
        scene = new THREE.Scene();

        // Camera
        camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.z = 6.5;

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 1);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        container.appendChild(renderer.domElement);

        // Build scene
        createStarField();
        createGlobe();
        createAtmosphere();
        createCityDots();
        createConnectionArcs();
        setupLighting();

        // Events
        container.addEventListener('mousemove', onMouseMove);
        window.addEventListener('resize', onResize);

        // Start
        animate();
    }

    // ═══════════════════════════════════════════════
    //  Star Field
    // ═══════════════════════════════════════════════
    function createStarField() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(CONFIG.starCount * 3);
        const sizes = new Float32Array(CONFIG.starCount);

        for (let i = 0; i < CONFIG.starCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 40 + Math.random() * 60;

            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);
            sizes[i] = Math.random() * 2 + 0.5;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.15,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true,
        });

        starField = new THREE.Points(geometry, material);
        scene.add(starField);
    }

    // ═══════════════════════════════════════════════
    //  Procedural Earth Globe
    // ═══════════════════════════════════════════════
    function createGlobe() {
        const R = CONFIG.globeRadius;

        // Create a canvas-based Earth texture procedurally
        const texCanvas = document.createElement('canvas');
        texCanvas.width = 1024;
        texCanvas.height = 512;
        const ctx = texCanvas.getContext('2d');

        // Ocean base
        const oceanGrad = ctx.createLinearGradient(0, 0, 0, 512);
        oceanGrad.addColorStop(0, '#0a2a4a');
        oceanGrad.addColorStop(0.3, '#0d3b66');
        oceanGrad.addColorStop(0.5, '#1a5276');
        oceanGrad.addColorStop(0.7, '#0d3b66');
        oceanGrad.addColorStop(1, '#0a2a4a');
        ctx.fillStyle = oceanGrad;
        ctx.fillRect(0, 0, 1024, 512);

        // Simplified continent shapes (draw land masses)
        ctx.fillStyle = '#1a3a2a';
        drawContinent(ctx, 'northAmerica');
        drawContinent(ctx, 'southAmerica');
        drawContinent(ctx, 'europe');
        drawContinent(ctx, 'africa');
        drawContinent(ctx, 'asia');
        drawContinent(ctx, 'australia');

        // Add grid lines for techy feel
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.06)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 18; i++) {
            ctx.beginPath();
            ctx.moveTo(0, i * (512 / 18));
            ctx.lineTo(1024, i * (512 / 18));
            ctx.stroke();
        }
        for (let i = 0; i <= 36; i++) {
            ctx.beginPath();
            ctx.moveTo(i * (1024 / 36), 0);
            ctx.lineTo(i * (1024 / 36), 512);
            ctx.stroke();
        }

        const earthTexture = new THREE.CanvasTexture(texCanvas);

        // Globe mesh
        const geometry = new THREE.SphereGeometry(R, 64, 64);
        const material = new THREE.MeshPhongMaterial({
            map: earthTexture,
            bumpScale: 0.02,
            specular: new THREE.Color(0x333333),
            shininess: 15,
        });

        globe = new THREE.Mesh(geometry, material);
        scene.add(globe);

        // Wireframe overlay for tech aesthetic
        const wireGeo = new THREE.SphereGeometry(R + 0.005, 48, 48);
        const wireMat = new THREE.MeshBasicMaterial({
            color: 0x00d4ff,
            wireframe: true,
            transparent: true,
            opacity: 0.04,
        });
        const wireframe = new THREE.Mesh(wireGeo, wireMat);
        globe.add(wireframe);
    }

    // ── Draw simplified continent shapes ──
    function drawContinent(ctx, name) {
        ctx.beginPath();
        const shapes = {
            northAmerica: () => {
                ctx.moveTo(180, 80); ctx.lineTo(220, 60); ctx.lineTo(260, 70);
                ctx.lineTo(280, 100); ctx.lineTo(300, 120); ctx.lineTo(290, 160);
                ctx.lineTo(270, 190); ctx.lineTo(250, 200); ctx.lineTo(230, 210);
                ctx.lineTo(200, 230); ctx.lineTo(180, 220); ctx.lineTo(160, 200);
                ctx.lineTo(130, 160); ctx.lineTo(120, 130); ctx.lineTo(140, 100);
                ctx.closePath();
            },
            southAmerica: () => {
                ctx.moveTo(270, 260); ctx.lineTo(290, 250); ctx.lineTo(310, 270);
                ctx.lineTo(320, 310); ctx.lineTo(310, 350); ctx.lineTo(290, 390);
                ctx.lineTo(270, 410); ctx.lineTo(260, 380); ctx.lineTo(255, 340);
                ctx.lineTo(260, 300); ctx.closePath();
            },
            europe: () => {
                ctx.moveTo(480, 80); ctx.lineTo(520, 75); ctx.lineTo(550, 90);
                ctx.lineTo(560, 120); ctx.lineTo(540, 150); ctx.lineTo(520, 165);
                ctx.lineTo(500, 170); ctx.lineTo(480, 160); ctx.lineTo(470, 130);
                ctx.lineTo(475, 100); ctx.closePath();
            },
            africa: () => {
                ctx.moveTo(490, 200); ctx.lineTo(530, 190); ctx.lineTo(560, 210);
                ctx.lineTo(570, 260); ctx.lineTo(560, 320); ctx.lineTo(540, 360);
                ctx.lineTo(520, 370); ctx.lineTo(500, 350); ctx.lineTo(490, 300);
                ctx.lineTo(480, 250); ctx.closePath();
            },
            asia: () => {
                ctx.moveTo(570, 70); ctx.lineTo(620, 60); ctx.lineTo(680, 70);
                ctx.lineTo(740, 90); ctx.lineTo(790, 110); ctx.lineTo(810, 140);
                ctx.lineTo(800, 170); ctx.lineTo(770, 190); ctx.lineTo(730, 200);
                ctx.lineTo(690, 210); ctx.lineTo(650, 200); ctx.lineTo(620, 180);
                ctx.lineTo(590, 160); ctx.lineTo(570, 130); ctx.lineTo(560, 100);
                ctx.closePath();
            },
            australia: () => {
                ctx.moveTo(790, 310); ctx.lineTo(830, 300); ctx.lineTo(860, 310);
                ctx.lineTo(870, 340); ctx.lineTo(860, 370); ctx.lineTo(830, 380);
                ctx.lineTo(800, 370); ctx.lineTo(790, 340); ctx.closePath();
            },
        };

        if (shapes[name]) {
            shapes[name]();
            ctx.fill();
        }
    }

    // ═══════════════════════════════════════════════
    //  Atmosphere Glow (Fresnel Shader)
    // ═══════════════════════════════════════════════
    function createAtmosphere() {
        const R = CONFIG.globeRadius;

        // Inner glow (additive blending)
        const atmosphereMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                void main() {
                    float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.0);
                    vec3 color = vec3(0.3, 0.7, 1.0);
                    gl_FragColor = vec4(color, intensity * 0.8);
                }
            `,
            blending: THREE.AdditiveBlending,
            side: THREE.FrontSide,
            transparent: true,
            depthWrite: false,
        });

        const atmosphereGeo = new THREE.SphereGeometry(R + 0.15, 64, 64);
        atmosphere = new THREE.Mesh(atmosphereGeo, atmosphereMaterial);
        scene.add(atmosphere);

        // Outer halo
        const haloMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                void main() {
                    float intensity = pow(0.5 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
                    vec3 color = vec3(0.2, 0.55, 1.0);
                    gl_FragColor = vec4(color, intensity * 0.35);
                }
            `,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false,
        });

        const haloGeo = new THREE.SphereGeometry(R + 0.6, 64, 64);
        const halo = new THREE.Mesh(haloGeo, haloMaterial);
        scene.add(halo);
    }

    // ═══════════════════════════════════════════════
    //  City Dots
    // ═══════════════════════════════════════════════
    function createCityDots() {
        const R = CONFIG.globeRadius + 0.02;

        CITIES.forEach(city => {
            const pos = latLonToVector3(city.lat, city.lon, R);

            // Glowing dot
            const dotGeo = new THREE.SphereGeometry(0.035, 16, 16);
            const dotMat = new THREE.MeshBasicMaterial({
                color: CONFIG.cityDotColor,
                transparent: true,
                opacity: 0.9,
            });
            const dot = new THREE.Mesh(dotGeo, dotMat);
            dot.position.copy(pos);
            globe.add(dot);

            // Pulse ring
            const ringGeo = new THREE.RingGeometry(0.04, 0.065, 32);
            const ringMat = new THREE.MeshBasicMaterial({
                color: CONFIG.cityDotColor,
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide,
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.copy(pos);
            ring.lookAt(new THREE.Vector3(0, 0, 0));
            ring.userData = { baseScale: 1, phase: Math.random() * Math.PI * 2 };
            globe.add(ring);

            cityDots.push({ dot, ring });
        });
    }

    // ═══════════════════════════════════════════════
    //  Connection Arcs + Traveling Particles
    // ═══════════════════════════════════════════════
    function createConnectionArcs() {
        const R = CONFIG.globeRadius + 0.02;

        ROUTES.forEach((route, idx) => {
            const cityA = CITIES[route[0]];
            const cityB = CITIES[route[1]];

            const start = latLonToVector3(cityA.lat, cityA.lon, R);
            const end = latLonToVector3(cityB.lat, cityB.lon, R);

            // Calculate mid-point elevated above globe surface
            const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
            const dist = start.distanceTo(end);
            const elevation = R + dist * 0.35;
            mid.normalize().multiplyScalar(elevation);

            // Create quadratic bezier curve
            const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
            const points = curve.getPoints(60);
            const geometry = new THREE.BufferGeometry().setFromPoints(points);

            const material = new THREE.LineBasicMaterial({
                color: CONFIG.arcColor,
                transparent: true,
                opacity: 0.25,
                linewidth: 1,
            });

            const arc = new THREE.Line(geometry, material);
            globe.add(arc);

            // Animated arc (traveling light)
            const animArcGeo = new THREE.BufferGeometry();
            const animPoints = 20;
            const animPositions = new Float32Array(animPoints * 3);
            animArcGeo.setAttribute('position', new THREE.BufferAttribute(animPositions, 3));

            const animMat = new THREE.LineBasicMaterial({
                color: CONFIG.arcColor,
                transparent: true,
                opacity: 0.8,
                linewidth: 2,
            });

            const animArc = new THREE.Line(animArcGeo, animMat);
            globe.add(animArc);

            arcs.push({
                curve,
                animArc,
                progress: Math.random(), // Start at random position
                speed: 0.003 + Math.random() * 0.002,
                totalPoints: 60,
                segmentLength: animPoints,
            });

            // Particles traveling along arcs
            for (let p = 0; p < CONFIG.particlesPerArc; p++) {
                const particleGeo = new THREE.SphereGeometry(0.015, 8, 8);
                const particleMat = new THREE.MeshBasicMaterial({
                    color: CONFIG.arcColor,
                    transparent: true,
                    opacity: 0.9,
                });
                const particle = new THREE.Mesh(particleGeo, particleMat);
                globe.add(particle);

                particles.push({
                    mesh: particle,
                    curve,
                    progress: p / CONFIG.particlesPerArc,
                    speed: 0.004 + Math.random() * 0.003,
                });
            }
        });
    }

    // ═══════════════════════════════════════════════
    //  Lighting
    // ═══════════════════════════════════════════════
    function setupLighting() {
        // Soft ambient
        const ambient = new THREE.AmbientLight(0x223344, 1.5);
        scene.add(ambient);

        // Main directional (sun)
        const sun = new THREE.DirectionalLight(0xffffff, 1.8);
        sun.position.set(5, 3, 5);
        scene.add(sun);

        // Rim light (premium edge lighting)
        const rim = new THREE.DirectionalLight(0x4fc3f7, 0.8);
        rim.position.set(-5, 0, -3);
        scene.add(rim);

        // Fill light from below
        const fill = new THREE.PointLight(0x1a3a5c, 0.6, 20);
        fill.position.set(0, -5, 3);
        scene.add(fill);
    }

    // ═══════════════════════════════════════════════
    //  Animation Loop
    // ═══════════════════════════════════════════════
    function animate() {
        animationId = requestAnimationFrame(animate);

        const time = Date.now() * 0.001;

        // Globe auto-rotation
        if (globe) {
            globe.rotation.y += CONFIG.rotationSpeed;

            // Mouse interaction (subtle tilt)
            targetRotationX = mouseY * 0.0002;
            targetRotationY = mouseX * 0.0002;
            globe.rotation.x += (targetRotationX - globe.rotation.x * 0.1) * 0.02;
        }

        // Atmosphere follows globe subtly
        if (atmosphere) {
            atmosphere.rotation.y = globe.rotation.y * 0.5;
        }

        // Animate city pulse rings
        cityDots.forEach(({ ring }) => {
            const scale = 1 + Math.sin(time * 2 + ring.userData.phase) * 0.3;
            ring.scale.setScalar(scale);
            ring.material.opacity = 0.3 + Math.sin(time * 2 + ring.userData.phase) * 0.2;
        });

        // Animate traveling arcs
        arcs.forEach(arc => {
            arc.progress += arc.speed;
            if (arc.progress > 1) arc.progress = 0;

            const positions = arc.animArc.geometry.attributes.position.array;
            const start = Math.floor(arc.progress * arc.totalPoints);

            for (let i = 0; i < arc.segmentLength; i++) {
                const t = (start + i) / arc.totalPoints;
                const clampedT = t > 1 ? t - 1 : t;
                const point = arc.curve.getPoint(clampedT);
                positions[i * 3] = point.x;
                positions[i * 3 + 1] = point.y;
                positions[i * 3 + 2] = point.z;
            }

            arc.animArc.geometry.attributes.position.needsUpdate = true;

            // Fade based on position
            arc.animArc.material.opacity = 0.5 + Math.sin(arc.progress * Math.PI) * 0.4;
        });

        // Animate particles along routes
        particles.forEach(p => {
            p.progress += p.speed;
            if (p.progress > 1) p.progress = 0;

            const point = p.curve.getPoint(p.progress);
            p.mesh.position.copy(point);

            // Pulse glow
            const scale = 1 + Math.sin(time * 4 + p.progress * Math.PI) * 0.3;
            p.mesh.scale.setScalar(scale);
            p.mesh.material.opacity = 0.4 + Math.sin(p.progress * Math.PI) * 0.6;
        });

        // Star shimmer
        if (starField) {
            starField.rotation.y += 0.0001;
        }

        renderer.render(scene, camera);
    }

    // ═══════════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════════
    function latLonToVector3(lat, lon, radius) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);

        return new THREE.Vector3(
            -radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.cos(phi),
            radius * Math.sin(phi) * Math.sin(theta)
        );
    }

    function onMouseMove(e) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouseX = (e.clientX - rect.left - rect.width / 2);
        mouseY = (e.clientY - rect.top - rect.height / 2);
    }

    function onResize() {
        const container = document.getElementById('globe-container');
        if (!container) return;

        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }

    // ── Expose globally ──
    window.initGlobe = initGlobe;

})();
