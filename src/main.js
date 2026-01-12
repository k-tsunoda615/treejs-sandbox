import "./style.css";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";

const app = document.querySelector("#app");

if (!navigator.gpu) {
  app.innerHTML = "WebGPU is not supported in this browser.";
} else {
  const scene = new THREE.Scene();
  const vibe = {
    night: new THREE.Color("#0b0f1a"),
    cyan: new THREE.Color("#41d1ff"),
    purple: new THREE.Color("#bd34fe"),
    gold: new THREE.Color("#ffea83"),
    amber: new THREE.Color("#ffa800"),
  };

  scene.background = vibe.night;
  scene.fog = new THREE.Fog(vibe.night, 6, 14);

  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 1.2, 7);

  const mouse = new THREE.Vector2(0, 0);
  const raycaster = new THREE.Raycaster();
  const cursorPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const cursorPoint = new THREE.Vector3();

  window.addEventListener("pointermove", (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  });

  const ambient = new THREE.AmbientLight(0x3a4b7a, 0.95);
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
  keyLight.position.set(4, 6, 2);
  const rimLight = new THREE.PointLight(vibe.purple, 2.8, 20);
  rimLight.position.set(-5, 2, -3);
  const accentLight = new THREE.PointLight(vibe.cyan, 2.1, 18);
  accentLight.position.set(5, -2, 4);
  scene.add(ambient, keyLight, rimLight, accentLight);

  const knotGeometry = new THREE.TorusKnotGeometry(1.2, 0.35, 220, 32);
  const ringGeometry = new THREE.TorusGeometry(2.2, 0.06, 16, 120);
  const shellGeometry = new THREE.IcosahedronGeometry(2.4, 1);
  const satelliteGeometry = new THREE.SphereGeometry(0.12, 16, 16);

  const clusters = [];
  const settings = {
    clusterCount: 4,
    colorSpeed: 0.35,
    scaleMin: 0.3,
    scaleMax: 1.2,
    scaleSpeed: 0.3,
    rotationSpeed: 1,
  };

  const interaction = {
    avoidRadius: 2.5,
    avoidStrength: 2,
    blastRadius: 2.2,
    blastStrength: 1.6,
    blastDamping: 0.92,
  };

  const ui = document.createElement("div");
  ui.className = "control-panel";
  ui.innerHTML = `<div class="control-panel__title">controls</div>`;
  document.body.appendChild(ui);

  const controlMap = {};

  function formatValue(value, step) {
    if (step < 1) {
      return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    }
    return String(Math.round(value));
  }

  function addSlider({ key, label, min, max, step }) {
    const row = document.createElement("div");
    row.className = "control-panel__row";
    row.innerHTML = `
      <div class="control-panel__label">
        <span>${label}</span>
        <span class="control-panel__value">${formatValue(settings[key], step)}</span>
      </div>
    `;
    const input = document.createElement("input");
    input.className = "control-panel__slider";
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(settings[key]);
    row.appendChild(input);
    ui.appendChild(row);
    controlMap[key] = { input, value: row.querySelector(".control-panel__value"), step };
    return input;
  }

  function syncValue(key) {
    const control = controlMap[key];
    if (!control) return;
    control.input.value = String(settings[key]);
    control.value.textContent = formatValue(settings[key], control.step);
  }

  function rebuildClusters(count) {
    clusters.forEach((cluster) => {
      scene.remove(cluster.group);
    });
    clusters.length = 0;
    for (let i = 0; i < count; i += 1) {
      clusters.push(createCluster());
    }
  }
  
  addSlider({ key: "clusterCount", label: "clusters", min: 1, max: 500, step: 1 }).addEventListener(
    "input",
    (event) => {
      settings.clusterCount = Number(event.target.value);
      syncValue("clusterCount");
      rebuildClusters(settings.clusterCount);
    }
  );
  addSlider({ key: "colorSpeed", label: "color speed", min: 0.05, max: 1, step: 0.05 })
    .addEventListener("input", (event) => {
      settings.colorSpeed = Number(event.target.value);
      syncValue("colorSpeed");
    });
  addSlider({ key: "scaleMin", label: "scale min", min: 0.1, max: 1.2, step: 0.05 })
    .addEventListener("input", (event) => {
      settings.scaleMin = Number(event.target.value);
      if (settings.scaleMin > settings.scaleMax) {
        settings.scaleMax = settings.scaleMin;
        syncValue("scaleMax");
      }
      syncValue("scaleMin");
    });
  addSlider({ key: "scaleMax", label: "scale max", min: 0.3, max: 2, step: 0.05 })
    .addEventListener("input", (event) => {
      settings.scaleMax = Number(event.target.value);
      if (settings.scaleMax < settings.scaleMin) {
        settings.scaleMin = settings.scaleMax;
        syncValue("scaleMin");
      }
      syncValue("scaleMax");
    });
  addSlider({ key: "scaleSpeed", label: "scale speed", min: 0.05, max: 1, step: 0.05 })
    .addEventListener("input", (event) => {
      settings.scaleSpeed = Number(event.target.value);
      syncValue("scaleSpeed");
    });
  addSlider({ key: "rotationSpeed", label: "rotation speed", min: 0, max: 2, step: 0.05 })
    .addEventListener("input", (event) => {
      settings.rotationSpeed = Number(event.target.value);
      syncValue("rotationSpeed");
    });

  function createCluster() {
    const group = new THREE.Group();
    scene.add(group);

    const knotMaterial = new THREE.MeshStandardMaterial({
      color: vibe.cyan.clone(),
      metalness: 0.5,
      roughness: 0.18,
      emissive: vibe.purple.clone(),
      emissiveIntensity: 0.18,
    });
    const knot = new THREE.Mesh(knotGeometry, knotMaterial);
    group.add(knot);

    const ringMaterial = new THREE.MeshStandardMaterial({
      color: vibe.gold.clone(),
      metalness: 0.15,
      roughness: 0.2,
      emissive: vibe.amber.clone(),
      emissiveIntensity: 0.28,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2.6;
    ring.rotation.y = Math.PI / 8;
    group.add(ring);

    const shellMaterial = new THREE.MeshBasicMaterial({
      color: vibe.purple.clone(),
      wireframe: true,
      transparent: true,
      opacity: 0.22,
    });
    const shell = new THREE.Mesh(shellGeometry, shellMaterial);
    group.add(shell);

    const satellites = new THREE.Group();
    const satelliteMaterial = new THREE.MeshStandardMaterial({
      color: vibe.cyan.clone(),
      metalness: 0.2,
      roughness: 0.2,
      emissive: vibe.purple.clone(),
      emissiveIntensity: 0.22,
    });
    for (let i = 0; i < 9; i += 1) {
      const sphere = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
      const angle = (i / 9) * Math.PI * 2;
      const radius = 3 + (i % 3) * 0.35;
      sphere.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle * 1.6) * 0.8,
        Math.sin(angle) * radius
      );
      satellites.add(sphere);
    }
    group.add(satellites);

    const basePosition = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(4),
      THREE.MathUtils.randFloatSpread(2.4),
      THREE.MathUtils.randFloatSpread(1.2)
    );
    group.position.copy(basePosition);

    return {
      group,
      knot,
      ring,
      shell,
      satellites,
      materials: {
        knot: knotMaterial,
        ring: ringMaterial,
        shell: shellMaterial,
        satellites: satelliteMaterial,
      },
      basePosition,
      velocity: new THREE.Vector3(),
      drift: new THREE.Vector2(
        THREE.MathUtils.randFloat(0.3, 0.8),
        THREE.MathUtils.randFloat(0.2, 0.6)
      ),
      speed: new THREE.Vector2(
        THREE.MathUtils.randFloat(0.2, 0.5),
        THREE.MathUtils.randFloat(0.25, 0.6)
      ),
      offsets: {
        color: Math.random(),
        scale: Math.random(),
        rotation: Math.random() * Math.PI * 2,
      },
    };
  }

  rebuildClusters(settings.clusterCount);

  window.addEventListener("pointerdown", () => {
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(cursorPlane, cursorPoint);
    clusters.forEach((cluster) => {
      const toCluster = cluster.group.position.clone().sub(cursorPoint);
      const distance = toCluster.length();
      if (distance < interaction.blastRadius) {
        const strength =
          THREE.MathUtils.smootherstep(
            interaction.blastRadius - distance,
            0,
            interaction.blastRadius
          ) * interaction.blastStrength;
        cluster.velocity.add(toCluster.normalize().multiplyScalar(strength));
      }
    });
  });

  const renderer = new WebGPURenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  app.appendChild(renderer.domElement);

  const clock = new THREE.Clock();
  const palettes = {
    knot: [
      new THREE.Color("#7fe3ff"),
      new THREE.Color("#5bffc9"),
      new THREE.Color("#ff8fe0"),
    ],
    ring: [
      new THREE.Color("#fff0a6"),
      new THREE.Color("#9be8ff"),
      new THREE.Color("#d98bff"),
    ],
    shell: [
      new THREE.Color("#d98bff"),
      new THREE.Color("#5bffc9"),
      new THREE.Color("#7fe3ff"),
    ],
    satellites: [
      new THREE.Color("#7fe3ff"),
      new THREE.Color("#b0f1ff"),
      new THREE.Color("#ff8fe0"),
    ],
  };
  const workColor = new THREE.Color();
  const workEmissive = new THREE.Color();

  function mixPalette(colors, t) {
    if (t < 0.5) {
      const localT = THREE.MathUtils.smootherstep(t * 2, 0, 1);
      workColor.copy(colors[0]).lerp(colors[1], localT);
    } else {
      const localT = THREE.MathUtils.smootherstep((t - 0.5) * 2, 0, 1);
      workColor.copy(colors[1]).lerp(colors[2], localT);
    }
    workEmissive.copy(workColor).multiplyScalar(0.2);
  }

  function animate() {
    const elapsed = clock.getElapsedTime();
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(cursorPlane, cursorPoint);
    clusters.forEach((cluster) => {
      const { group, knot, ring, shell, satellites, materials } = cluster;
      const phaseOffset = cluster.offsets.color * Math.PI * 2;
      const colorPhase =
        (Math.sin(elapsed * settings.colorSpeed + phaseOffset) + 1) / 2;

      mixPalette(palettes.knot, colorPhase);
      materials.knot.color.copy(workColor);
      materials.knot.emissive.copy(workEmissive);

      mixPalette(palettes.ring, (colorPhase + 0.2) % 1);
      materials.ring.color.copy(workColor);
      materials.ring.emissive.copy(workEmissive);

      mixPalette(palettes.shell, (colorPhase + 0.4) % 1);
      materials.shell.color.copy(workColor);

      mixPalette(palettes.satellites, (colorPhase + 0.6) % 1);
      materials.satellites.color.copy(workColor);
      materials.satellites.emissive.copy(workEmissive);

      const scalePhase =
        (Math.sin(elapsed * settings.scaleSpeed + cluster.offsets.scale * Math.PI * 2) +
          1) /
        2;
      const scale = THREE.MathUtils.lerp(settings.scaleMin, settings.scaleMax, scalePhase);
      group.scale.setScalar(scale);

      const driftX =
        Math.cos(elapsed * cluster.speed.x + cluster.offsets.rotation) *
        cluster.drift.x;
      const driftY =
        Math.sin(elapsed * cluster.speed.y + cluster.offsets.rotation) *
        cluster.drift.y;
      const targetPosition = new THREE.Vector3(
        cluster.basePosition.x + driftX,
        cluster.basePosition.y + driftY,
        cluster.basePosition.z
      );

      const toCursor = targetPosition.clone().sub(cursorPoint);
      const distance = toCursor.length();
      if (distance < interaction.avoidRadius) {
        const strength = THREE.MathUtils.smoothstep(
          interaction.avoidRadius - distance,
          0,
          interaction.avoidRadius
        );
        targetPosition.add(
          toCursor.normalize().multiplyScalar(strength * interaction.avoidStrength)
        );
      }

      cluster.velocity.multiplyScalar(interaction.blastDamping);
      targetPosition.add(cluster.velocity);
      group.position.copy(targetPosition);

      group.rotation.y = elapsed * 0.25 * settings.rotationSpeed + cluster.offsets.rotation;
      knot.rotation.x = elapsed * 0.5 * settings.rotationSpeed + cluster.offsets.rotation;
      knot.rotation.z = elapsed * 0.35 * settings.rotationSpeed;
      ring.rotation.z = elapsed * 0.6 * settings.rotationSpeed + cluster.offsets.rotation;
      shell.rotation.y = -elapsed * 0.15 * settings.rotationSpeed;
      satellites.children.forEach((mesh, index) => {
        const offset = index * 0.35 + cluster.offsets.rotation;
        const radius = 3 + (index % 3) * 0.35;
        mesh.position.x =
          Math.cos(elapsed * 0.6 * settings.rotationSpeed + offset) * radius;
        mesh.position.z =
          Math.sin(elapsed * 0.6 * settings.rotationSpeed + offset) * radius;
        mesh.position.y =
          Math.sin(elapsed * 1.1 * settings.rotationSpeed + offset) * 0.8;
      });
    });
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener("resize", onResize);

  async function start() {
    await renderer.init();
    animate();
  }

  start();
}
