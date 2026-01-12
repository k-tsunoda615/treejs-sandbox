import "./style.css";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";

const app = document.querySelector("#app");

const PALETTE_SETS = {
  psychedelic: {
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
  },
  pastel: {
    knot: [
      new THREE.Color("#ffd6e8"),
      new THREE.Color("#c8f2ff"),
      new THREE.Color("#d9d3ff"),
    ],
    ring: [
      new THREE.Color("#fff1c9"),
      new THREE.Color("#d5f3e2"),
      new THREE.Color("#ffe0f0"),
    ],
    shell: [
      new THREE.Color("#e6d9ff"),
      new THREE.Color("#cfe9ff"),
      new THREE.Color("#ffdce6"),
    ],
    satellites: [
      new THREE.Color("#d4f0ff"),
      new THREE.Color("#e6dcff"),
      new THREE.Color("#ffe7cf"),
    ],
  },
  primary: {
    knot: [
      new THREE.Color("#ff3b30"),
      new THREE.Color("#34c759"),
      new THREE.Color("#007aff"),
    ],
    ring: [
      new THREE.Color("#ff9f0a"),
      new THREE.Color("#ffd60a"),
      new THREE.Color("#af52de"),
    ],
    shell: [
      new THREE.Color("#0a84ff"),
      new THREE.Color("#30d158"),
      new THREE.Color("#ff375f"),
    ],
    satellites: [
      new THREE.Color("#ff453a"),
      new THREE.Color("#64d2ff"),
      new THREE.Color("#ffd60a"),
    ],
  },
  neon: {
    knot: [
      new THREE.Color("#00f7ff"),
      new THREE.Color("#39ff14"),
      new THREE.Color("#ff4dff"),
    ],
    ring: [
      new THREE.Color("#ffea00"),
      new THREE.Color("#00e5ff"),
      new THREE.Color("#ff0080"),
    ],
    shell: [
      new THREE.Color("#8c52ff"),
      new THREE.Color("#00ffcc"),
      new THREE.Color("#ff4dff"),
    ],
    satellites: [
      new THREE.Color("#00f7ff"),
      new THREE.Color("#39ff14"),
      new THREE.Color("#ffea00"),
    ],
  },
  mono: {
    knot: [
      new THREE.Color("#f5f7ff"),
      new THREE.Color("#c7d2ff"),
      new THREE.Color("#8f9bff"),
    ],
    ring: [
      new THREE.Color("#e9edf8"),
      new THREE.Color("#b7c0e6"),
      new THREE.Color("#6d75b8"),
    ],
    shell: [
      new THREE.Color("#dfe3f5"),
      new THREE.Color("#9ea6c9"),
      new THREE.Color("#6b7396"),
    ],
    satellites: [
      new THREE.Color("#eef1fb"),
      new THREE.Color("#c0c8e9"),
      new THREE.Color("#8892c2"),
    ],
  },
};

const SETTINGS_DEFAULTS = {
  clusterCount: 100,
  colorSpeed: 0.5,
  scaleMin: 1.2,
  scaleMax: 1.4,
  scaleSpeed: 0.3,
  rotationSpeed: 2,
  avoidEnabled: true,
  palette: "primary",
};

const INTERACTION = {
  avoidRadius: 2.5,
  avoidStrength: 2,
  blastRadius: 2.2,
  blastStrength: 1.6,
  blastDamping: 0.92,
};

if (!navigator.gpu) {
  app.innerHTML = "WebGPU is not supported in this browser.";
} else {
  initScene();
}

function initScene() {
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

  function updateCursorPoint() {
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(cursorPlane, cursorPoint);
  }

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

  const geometries = {
    knot: new THREE.TorusKnotGeometry(1.2, 0.35, 220, 32),
    ring: new THREE.TorusGeometry(2.2, 0.06, 16, 120),
    shell: new THREE.IcosahedronGeometry(2.4, 1),
    satellite: new THREE.SphereGeometry(0.12, 16, 16),
  };

  const settings = { ...SETTINGS_DEFAULTS };
  const clusters = [];
  let activePalette = PALETTE_SETS[settings.palette];

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
        <span class="control-panel__value">${formatValue(
          settings[key],
          step
        )}</span>
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
    controlMap[key] = {
      input,
      value: row.querySelector(".control-panel__value"),
      step,
    };
    return input;
  }

  function addSelect({ key, label, options }) {
    const row = document.createElement("div");
    row.className = "control-panel__row";
    row.innerHTML = `
      <div class="control-panel__label">
        <span>${label}</span>
        <span class="control-panel__value">${settings[key]}</span>
      </div>
    `;
    const select = document.createElement("select");
    select.className = "control-panel__select";
    options.forEach((option) => {
      const item = document.createElement("option");
      item.value = option.value;
      item.textContent = option.label;
      if (option.value === settings[key]) {
        item.selected = true;
      }
      select.appendChild(item);
    });
    row.appendChild(select);
    ui.appendChild(row);
    controlMap[key] = {
      input: select,
      value: row.querySelector(".control-panel__value"),
    };
    return select;
  }

  function addToggle({ key, label }) {
    const row = document.createElement("div");
    row.className = "control-panel__row";
    row.innerHTML = `
      <div class="control-panel__label">
        <span>${label}</span>
        <span class="control-panel__value">${settings[key] ? "on" : "off"}</span>
      </div>
    `;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "control-panel__toggle";
    input.checked = Boolean(settings[key]);
    row.appendChild(input);
    ui.appendChild(row);
    controlMap[key] = {
      input,
      value: row.querySelector(".control-panel__value"),
    };
    return input;
  }

  function addButton(label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "control-panel__button";
    button.textContent = label;
    ui.appendChild(button);
    return button;
  }

  function randomInRange(min, max, step) {
    if (step >= 1) {
      return Math.floor(THREE.MathUtils.randFloat(min, max + 1));
    }
    const steps = Math.round((max - min) / step);
    return min + Math.round(Math.random() * steps) * step;
  }

  function syncValue(key) {
    const control = controlMap[key];
    if (!control) return;
    control.input.value = String(settings[key]);
    control.value.textContent = formatValue(settings[key], control.step || 1);
  }

  function rebuildClusters(count) {
    clusters.forEach(disposeCluster);
    clusters.length = 0;
    for (let i = 0; i < count; i += 1) {
      clusters.push(createCluster());
    }
  }

  function disposeCluster(cluster) {
    scene.remove(cluster.group);
    Object.values(cluster.materials).forEach((material) => material.dispose());
  }

  addSlider({
    key: "clusterCount",
    label: "clusters",
    min: 1,
    max: 350,
    step: 1,
  }).addEventListener("input", (event) => {
    settings.clusterCount = Number(event.target.value);
    syncValue("clusterCount");
    rebuildClusters(settings.clusterCount);
  });
  addSlider({
    key: "colorSpeed",
    label: "color speed",
    min: 0.05,
    max: 1,
    step: 0.05,
  }).addEventListener("input", (event) => {
    settings.colorSpeed = Number(event.target.value);
    syncValue("colorSpeed");
  });
  addSlider({
    key: "scaleMin",
    label: "scale min",
    min: 0.1,
    max: 1.2,
    step: 0.05,
  }).addEventListener("input", (event) => {
    settings.scaleMin = Number(event.target.value);
    if (settings.scaleMin > settings.scaleMax) {
      settings.scaleMax = settings.scaleMin;
      syncValue("scaleMax");
    }
    syncValue("scaleMin");
  });
  addSlider({
    key: "scaleMax",
    label: "scale max",
    min: 0.3,
    max: 2,
    step: 0.05,
  }).addEventListener("input", (event) => {
    settings.scaleMax = Number(event.target.value);
    if (settings.scaleMax < settings.scaleMin) {
      settings.scaleMin = settings.scaleMax;
      syncValue("scaleMin");
    }
    syncValue("scaleMax");
  });
  addSlider({
    key: "scaleSpeed",
    label: "scale speed",
    min: 0.05,
    max: 1,
    step: 0.05,
  }).addEventListener("input", (event) => {
    settings.scaleSpeed = Number(event.target.value);
    syncValue("scaleSpeed");
  });
  addSlider({
    key: "rotationSpeed",
    label: "rotation speed",
    min: 0,
    max: 2,
    step: 0.05,
  }).addEventListener("input", (event) => {
    settings.rotationSpeed = Number(event.target.value);
    syncValue("rotationSpeed");
  });

  const shuffleButton = addButton("shuffle settings");
  ui.insertBefore(shuffleButton, ui.children[1]);

  shuffleButton.addEventListener("click", () => {
    settings.clusterCount = randomInRange(1, 500, 1);
    settings.colorSpeed = randomInRange(0.05, 1, 0.05);
    settings.scaleMin = randomInRange(0.1, 1.1, 0.05);
    settings.scaleMax = randomInRange(settings.scaleMin, 2, 0.05);
    settings.scaleSpeed = randomInRange(0.05, 1, 0.05);
    settings.rotationSpeed = randomInRange(0, 2, 0.05);
    settings.avoidEnabled = Math.random() > 0.4;

    const paletteKeys = Object.keys(PALETTE_SETS);
    settings.palette = paletteKeys[Math.floor(Math.random() * paletteKeys.length)];
    activePalette = PALETTE_SETS[settings.palette] || PALETTE_SETS.psychedelic;

    Object.keys(controlMap).forEach((key) => {
      if (key === "palette") {
        controlMap.palette.input.value = settings.palette;
        controlMap.palette.value.textContent = settings.palette;
        return;
      }
      if (key === "avoidEnabled") {
        controlMap.avoidEnabled.input.checked = settings.avoidEnabled;
        controlMap.avoidEnabled.value.textContent = settings.avoidEnabled ? "on" : "off";
        return;
      }
      syncValue(key);
    });

    rebuildClusters(settings.clusterCount);
  });

  addToggle({ key: "avoidEnabled", label: "avoid cursor" }).addEventListener(
    "change",
    (event) => {
      settings.avoidEnabled = event.target.checked;
      const control = controlMap.avoidEnabled;
      if (control) {
        control.value.textContent = settings.avoidEnabled ? "on" : "off";
      }
    }
  );

  addSelect({
    key: "palette",
    label: "palette",
    options: [
      { value: "primary", label: "primary" },
      { value: "psychedelic", label: "psychedelic" },
      { value: "pastel", label: "pastel" },
      { value: "neon", label: "neon" },
      { value: "mono", label: "mono" },
    ],
  }).addEventListener("change", (event) => {
    settings.palette = event.target.value;
    activePalette = PALETTE_SETS[settings.palette] || PALETTE_SETS.psychedelic;
    const control = controlMap.palette;
    if (control) {
      control.value.textContent = settings.palette;
    }
  });

  function createMaterials() {
    return {
      knot: new THREE.MeshStandardMaterial({
        color: vibe.cyan.clone(),
        metalness: 0.5,
        roughness: 0.18,
        emissive: vibe.purple.clone(),
        emissiveIntensity: 0.18,
      }),
      ring: new THREE.MeshStandardMaterial({
        color: vibe.gold.clone(),
        metalness: 0.15,
        roughness: 0.2,
        emissive: vibe.amber.clone(),
        emissiveIntensity: 0.28,
      }),
      shell: new THREE.MeshBasicMaterial({
        color: vibe.purple.clone(),
        wireframe: true,
        transparent: true,
        opacity: 0.22,
      }),
      satellites: new THREE.MeshStandardMaterial({
        color: vibe.cyan.clone(),
        metalness: 0.2,
        roughness: 0.2,
        emissive: vibe.purple.clone(),
        emissiveIntensity: 0.22,
      }),
    };
  }

  function createSatellites(material) {
    const satellites = new THREE.Group();
    for (let i = 0; i < 9; i += 1) {
      const sphere = new THREE.Mesh(geometries.satellite, material);
      const angle = (i / 9) * Math.PI * 2;
      const radius = 3 + (i % 3) * 0.35;
      sphere.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle * 1.6) * 0.8,
        Math.sin(angle) * radius
      );
      satellites.add(sphere);
    }
    return satellites;
  }

  function createCluster() {
    const group = new THREE.Group();
    scene.add(group);

    const materials = createMaterials();
    const knot = new THREE.Mesh(geometries.knot, materials.knot);
    const ring = new THREE.Mesh(geometries.ring, materials.ring);
    ring.rotation.x = Math.PI / 2.6;
    ring.rotation.y = Math.PI / 8;
    const shell = new THREE.Mesh(geometries.shell, materials.shell);
    const satellites = createSatellites(materials.satellites);

    group.add(knot, ring, shell, satellites);

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
      materials,
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
    updateCursorPoint();
    clusters.forEach((cluster) => {
      const toCluster = cluster.group.position.clone().sub(cursorPoint);
      const distance = toCluster.length();
      if (distance < INTERACTION.blastRadius) {
        const strength =
          THREE.MathUtils.smootherstep(
            INTERACTION.blastRadius - distance,
            0,
            INTERACTION.blastRadius
          ) * INTERACTION.blastStrength;
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
  const workColor = new THREE.Color();
  const workEmissive = new THREE.Color();
  const tempPosition = new THREE.Vector3();
  const tempToCursor = new THREE.Vector3();

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
    updateCursorPoint();

    clusters.forEach((cluster) => {
      const { group, knot, ring, shell, satellites, materials } = cluster;
      const phaseOffset = cluster.offsets.color * Math.PI * 2;
      const colorPhase =
        (Math.sin(elapsed * settings.colorSpeed + phaseOffset) + 1) / 2;

      mixPalette(activePalette.knot, colorPhase);
      materials.knot.color.copy(workColor);
      materials.knot.emissive.copy(workEmissive);

      mixPalette(activePalette.ring, (colorPhase + 0.2) % 1);
      materials.ring.color.copy(workColor);
      materials.ring.emissive.copy(workEmissive);

      mixPalette(activePalette.shell, (colorPhase + 0.4) % 1);
      materials.shell.color.copy(workColor);

      mixPalette(activePalette.satellites, (colorPhase + 0.6) % 1);
      materials.satellites.color.copy(workColor);
      materials.satellites.emissive.copy(workEmissive);

      const scalePhase =
        (Math.sin(
          elapsed * settings.scaleSpeed + cluster.offsets.scale * Math.PI * 2
        ) +
          1) /
        2;
      const scale = THREE.MathUtils.lerp(
        settings.scaleMin,
        settings.scaleMax,
        scalePhase
      );
      group.scale.setScalar(scale);

      tempPosition.set(
        cluster.basePosition.x +
          Math.cos(elapsed * cluster.speed.x + cluster.offsets.rotation) *
            cluster.drift.x,
        cluster.basePosition.y +
          Math.sin(elapsed * cluster.speed.y + cluster.offsets.rotation) *
            cluster.drift.y,
        cluster.basePosition.z
      );

      if (settings.avoidEnabled) {
        tempToCursor.copy(tempPosition).sub(cursorPoint);
        const distance = tempToCursor.length();
        if (distance < INTERACTION.avoidRadius) {
          const strength = THREE.MathUtils.smoothstep(
            INTERACTION.avoidRadius - distance,
            0,
            INTERACTION.avoidRadius
          );
          tempPosition.add(
            tempToCursor
              .normalize()
              .multiplyScalar(strength * INTERACTION.avoidStrength)
          );
        }
      }

      cluster.velocity.multiplyScalar(INTERACTION.blastDamping);
      tempPosition.add(cluster.velocity);
      group.position.copy(tempPosition);

      group.rotation.y =
        elapsed * 0.25 * settings.rotationSpeed + cluster.offsets.rotation;
      knot.rotation.x =
        elapsed * 0.5 * settings.rotationSpeed + cluster.offsets.rotation;
      knot.rotation.z = elapsed * 0.35 * settings.rotationSpeed;
      ring.rotation.z =
        elapsed * 0.6 * settings.rotationSpeed + cluster.offsets.rotation;
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
