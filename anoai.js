// Use global THREE from CDN
const THREE = window.THREE;

let auroraInstance = null;

export function initAurora(container = document.body) {
    if (auroraInstance) {
        // Prevent multiple instances
        return;
    }

    try {
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        // Optimization: Low-power renderer settings
        const renderer = new THREE.WebGLRenderer({ 
            antialias: false, 
            alpha: true,
            powerPreference: "high-performance",
            precision: "mediump"
        });
    
    // Optimization: Limit pixel ratio for high-res screens
    const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    const canvas = renderer.domElement;
    canvas.classList.add('anoai-canvas');
    
    // If it's the whole app, use fixed positioning
    if (container === document.body) {
        canvas.classList.add('anoai-global-bg');
    }
    
    container.appendChild(canvas);

    const material = new THREE.ShaderMaterial({
        uniforms: {
            iTime: { value: 0 },
            iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        },
        vertexShader: `
            void main() {
                gl_Position = vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float iTime;
            uniform vec2 iResolution;

            #define NUM_OCTAVES 3

            float rand(vec2 n) {
                return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
            }

            float noise(vec2 p) {
                vec2 ip = floor(p);
                vec2 u = fract(p);
                u = u*u*(3.0-2.0*u);

                float res = mix(
                    mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
                    mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y);
                return res * res;
            }

            float fbm(vec2 x) {
                float v = 0.0;
                float a = 0.3;
                vec2 shift = vec2(100);
                mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
                for (int i = 0; i < NUM_OCTAVES; ++i) {
                    v += a * noise(x);
                    x = rot * x * 2.0 + shift;
                    a *= 0.4;
                }
                return v;
            }

            void main() {
                // Optimization: Reduced math overhead
                vec2 shake = vec2(sin(iTime * 0.8) * 0.003, cos(iTime * 1.5) * 0.003);
                vec2 p = ((gl_FragCoord.xy + shake * iResolution.xy) - iResolution.xy * 0.5) / iResolution.y * mat2(6.0, -4.0, 4.0, 6.0);
                vec2 v;
                vec4 o = vec4(0.0);

                float f = 2.0 + fbm(p + vec2(iTime * 3.0, 0.0)) * 0.4;

                // Optimization: Reduced loop iterations (35 -> 20) for smoother performance
                for (float i = 0.0; i < 20.0; i++) {
                    float i2 = i * i;
                    v = p + cos(i2 + (iTime + p.x * 0.08) * 0.025 + i * vec2(13.0, 11.0)) * 3.5;
                    float tailNoise = fbm(v + vec2(iTime * 0.4, i)) * 0.3 * (1.0 - (i / 20.0));
                    
                    vec4 auroraColors = vec4(
                        0.1 + 0.3 * sin(i * 0.2 + iTime * 0.3),
                        0.2 + 0.4 * cos(i * 0.3 + iTime * 0.4),
                        0.6 + 0.3 * sin(i * 0.4 + iTime * 0.2),
                        1.0
                    );
                    
                    float dist = length(max(v, vec2(v.x * f * 0.015, v.y * 1.5)));
                    vec4 currentContribution = auroraColors * exp(sin(i2 + iTime * 0.7)) / dist;
                    float thinnessFactor = smoothstep(0.0, 1.0, i / 20.0) * 0.5;
                    o += currentContribution * (1.0 + tailNoise * 0.8) * thinnessFactor;
                }

                // Optimization: Manual tanh for GLSL ES 1.0 compatibility
                vec4 e2x = exp(pow(o / 80.0, vec4(1.5)) * 2.0);
                o = (e2x - 1.0) / (e2x + 1.0);
                gl_FragColor = o * 1.4;
            }
        `
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let frameId;
    let lastTime = 0;
    
    function animate(time) {
        const deltaTime = time - lastTime;
        lastTime = time;
        
        // Target 60fps, but cap logic at 0.016 increments
        material.uniforms.iTime.value += 0.008; 
        renderer.render(scene, camera);
        frameId = requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);

    function handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        renderer.setSize(width, height);
        material.uniforms.iResolution.value.set(width, height);
    }
    
    // Throttled resize for performance
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(handleResize, 100);
    });

    auroraInstance = {
        destroy: () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener('resize', handleResize);
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
            geometry.dispose();
            material.dispose();
            renderer.dispose();
            auroraInstance = null;
        }
    };

    return auroraInstance;
    } catch (error) {
        console.error("Failed to initialize Aurora background:", error);
        return { destroy: () => {} };
    }
}
