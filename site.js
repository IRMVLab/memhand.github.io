const listEl = document.getElementById("clip-list");
const methodsEl = document.getElementById("methods");
const worldFrame = document.getElementById("world-frame");
const cam = document.getElementById("view-cam");
const world = document.getElementById("view-world");
const camLabel = document.getElementById("cam-label");
const playhead = document.getElementById("playhead");
const scrub = document.getElementById("scrub");
const miss = document.getElementById("miss");
const playBtn = document.getElementById("play");
const clockEl = document.getElementById("clock");

let clip = CLIPS[0];
let methodId = "memhand";
let syncing = false;
let seekTimer = 0;

function currentMethod() {
  return clip.methods.find((item) => item.id === methodId) || clip.methods[clip.methods.length - 1];
}

function clock(t) {
  const s = Math.max(0, Math.floor(Number.isFinite(t) ? t : 0));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

function renderList() {
  listEl.replaceChildren();
  let groupName = "";
  let cards = null;
  for (const item of CLIPS) {
    if (item.group !== groupName) {
      groupName = item.group;
      const group = document.createElement("div");
      group.className = "clip-group";
      const label = document.createElement("div");
      label.className = "group-label";
      label.textContent = groupName;
      cards = document.createElement("div");
      cards.className = "clip-cards";
      group.append(label, cards);
      listEl.appendChild(group);
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "clip";
    button.dataset.id = item.id;
    const img = document.createElement("img");
    img.src = "media/thumbs/" + item.id + ".jpg";
    img.alt = "";
    const body = document.createElement("span");
    body.className = "clip-body";
    const title = document.createElement("span");
    title.className = "clip-title";
    title.textContent = item.title;
    body.append(title);
    button.append(img, body);
    button.addEventListener("click", () => selectClip(item.id));
    cards.appendChild(button);
  }
  markClip();
}

function markClip() {
  for (const button of listEl.querySelectorAll(".clip")) {
    const on = button.dataset.id === clip.id;
    button.classList.toggle("on", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

function renderMethods() {
  methodsEl.replaceChildren();
  const selected = currentMethod();
  methodId = selected.id;
  for (const item of clip.methods) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "method" + (item.id === methodId ? " on" : "") + (item.id === "memhand" ? " ours" : "");
    button.textContent = item.name;
    button.setAttribute("aria-pressed", item.id === methodId ? "true" : "false");
    button.addEventListener("click", () => selectMethod(item.id));
    methodsEl.appendChild(button);
  }
}

function showMiss() {
  miss.hidden = false;
}

function load(keepTime) {
  const item = currentMethod();
  const time = keepTime ? cam.currentTime : 0;
  const playing = keepTime && !cam.paused;
  miss.hidden = true;
  camLabel.textContent = item.world ? "Camera" : "Input";
  worldFrame.classList.toggle("is-empty", !item.world);
  cam.src = "media/" + clip.dir + "/" + item.cam;
  if (item.world) {
    world.src = "media/" + clip.dir + "/" + item.world;
  } else {
    world.removeAttribute("src");
    world.load();
  }
  cam.addEventListener("loadedmetadata", function place() {
    if (time > 0.05 && Number.isFinite(cam.duration)) {
      cam.currentTime = Math.min(time, Math.max(0, cam.duration - 0.05));
    }
    if (playing) cam.play();
    tick();
  }, { once: true });
  if (item.world) {
    world.addEventListener("loadedmetadata", function placeWorld() {
      if (time > 0.05 && Number.isFinite(world.duration)) {
        world.currentTime = Math.min(time, Math.max(0, world.duration - 0.05));
      }
      if (playing) world.play();
    }, { once: true });
  }
  markClip();
  renderMethods();
  tick();
}

function selectClip(id) {
  const next = CLIPS.find((item) => item.id === id);
  if (!next || next.id === clip.id) return;
  clip = next;
  if (!next.methods.some((item) => item.id === methodId)) {
    methodId = next.methods[next.methods.length - 1].id;
  }
  load(false);
}

function selectMethod(id) {
  if (id === methodId) return;
  methodId = id;
  load(true);
}

function follow(from, to) {
  if (syncing || !to.getAttribute("src")) return;
  if (Math.abs((from.currentTime || 0) - (to.currentTime || 0)) < 0.08) return;
  syncing = true;
  to.currentTime = from.currentTime;
  to.addEventListener("seeked", () => { syncing = false; }, { once: true });
  setTimeout(() => { syncing = false; }, 300);
}

function tick() {
  const dur = (Number.isFinite(cam.duration) && cam.duration) || (clip.frames / 12);
  playhead.style.left = (100 * (cam.currentTime || 0) / dur) + "%";
  clockEl.textContent = clock(cam.currentTime) + " / " + clock(dur);
  playBtn.textContent = cam.paused ? "Play" : "Pause";
}

cam.addEventListener("timeupdate", () => { tick(); follow(cam, world); });
world.addEventListener("timeupdate", () => follow(world, cam));
cam.addEventListener("play", () => {
  if (world.getAttribute("src")) world.play();
  tick();
});
cam.addEventListener("pause", () => {
  if (world.getAttribute("src")) world.pause();
  tick();
});
world.addEventListener("play", () => {
  if (!world.getAttribute("src")) return;
  if (cam.paused) cam.play();
});
world.addEventListener("pause", () => {
  if (!world.getAttribute("src")) return;
  if (!cam.paused && !syncing) cam.pause();
});
cam.addEventListener("error", () => { if (cam.getAttribute("src")) showMiss(); });
world.addEventListener("error", () => { if (world.getAttribute("src")) showMiss(); });

playBtn.addEventListener("click", () => {
  if (cam.paused) cam.play();
  else cam.pause();
});

function seekTo(clientX) {
  const box = scrub.getBoundingClientRect();
  const fraction = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
  const dur = (Number.isFinite(cam.duration) && cam.duration) || (clip.frames / 12);
  const time = fraction * dur;
  syncing = true;
  cam.currentTime = time;
  if (world.getAttribute("src")) world.currentTime = time;
  clearTimeout(seekTimer);
  seekTimer = setTimeout(() => { syncing = false; }, 300);
  tick();
}

scrub.addEventListener("pointerdown", (event) => {
  scrub.setPointerCapture(event.pointerId);
  seekTo(event.clientX);
});
scrub.addEventListener("pointermove", (event) => {
  if (!scrub.hasPointerCapture(event.pointerId)) return;
  seekTo(event.clientX);
});

const bib = document.getElementById("bibtex");
const copyBib = document.getElementById("copy-bib");
if (copyBib && bib) {
  copyBib.addEventListener("click", async () => {
    const text = bib.textContent.replace(/^\n|\n$/g, "");
    const range = document.createRange();
    range.selectNodeContents(bib);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (err) {
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    }
    copyBib.textContent = ok ? "Copied" : "Selected";
    window.setTimeout(() => { copyBib.textContent = "Copy"; }, 1600);
  });
}

const asked = new URLSearchParams(location.search).get("clip");
if (asked) {
  const found = CLIPS.find((item) => item.id === asked);
  if (found) clip = found;
}

renderList();
load(false);
