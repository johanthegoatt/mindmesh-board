// Pip, the thought bubble who keeps you company while you map. Pip looks at
// the idea you picked (or your pointer), changes face with the board, hops
// when tapped, gives a tip that fits where you are, and reacts to what you
// do. Everything Pip says goes through a live region, so screen readers hear
// it too. A small friendly guide like this is the "persona effect" Lester et
// al. measured (CHI 1997): people rated a task more helpful and engaging
// with an animated character than without one.

export const TIPS = {
  empty: [
    "Hi, I'm Pip! Pick your main idea and press Tab to add one linked to it.",
    "Got a list somewhere? Copy it and press Ctrl+V here. I'll turn it into a map.",
    "Everything stays on this device. No sign up."
  ],
  loose: [
    "Click one idea, then another, to link them.",
    "Pick an idea and press Tab to add one that's already linked.",
    "Double-click an idea to rename it."
  ],
  linked: [
    "Press Tab to add a linked idea, then keep typing.",
    "Use the arrow keys to hop between ideas.",
    "Press T and I'll tidy the board so nothing overlaps.",
    "\"Copy as list\" turns your map into bullet points for your notes."
  ],
  busy: [
    "That's a lot of thinking! Press T to tidy up.",
    "Open this page in a second tab. Changes show up in both.",
    "Made a mess? Ctrl+Z undoes it."
  ]
};

export function stageFor(ideas, links) {
  if (ideas <= 1) return "empty";
  if (links === 0) return "loose";
  if (ideas >= 12) return "busy";
  return "linked";
}

export function moodFor(stage) {
  return { empty: "sleepy", loose: "curious", linked: "happy", busy: "happy" }[stage] || "happy";
}

export function createPip(root, { storage = globalThis.localStorage } = {}) {
  const btn = root.querySelector(".pip");
  const bubble = root.querySelector(".pip-bubble");
  const hide = root.querySelector(".pip-hide");
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const pupils = btn.querySelectorAll(".pip-pupil");
  let stage = "empty";
  let baseMood = "sleepy";
  let flashTimer = null;
  let bubbleTimer = null;
  let flashing = false;
  let taps = [];
  const tipIndex = {};

  const setMood = (m) => btn.setAttribute("data-mood", m);

  function say(text, ms = 6500) {
    if (root.classList.contains("tucked")) return;
    bubble.textContent = text;
    bubble.classList.remove("pop");
    void bubble.offsetWidth;
    bubble.classList.add("pop");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => { bubble.textContent = ""; }, ms);
  }

  function flash(m, ms = 1400) {
    setMood(m);
    flashing = true;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { flashing = false; setMood(baseMood); }, ms);
  }

  function play(cls) {
    if (still.matches) return;
    btn.classList.remove("hop", "spin");
    void btn.offsetWidth;
    btn.classList.add(cls);
  }
  btn.addEventListener("animationend", () => btn.classList.remove("hop", "spin"));

  function remember(tucked) {
    try { storage.setItem("mindmesh.pipTucked", tucked ? "1" : ""); } catch { /* private mode */ }
  }

  btn.addEventListener("click", () => {
    if (root.classList.contains("tucked")) {
      root.classList.remove("tucked");
      remember(false);
      play("hop");
      say("I'm back! Tap me any time for a tip.");
      return;
    }
    const now = Date.now();
    taps = taps.filter((t) => now - t < 1600);
    taps.push(now);
    if (taps.length >= 5) {
      taps = [];
      play("spin");
      flash("wow", 1200);
      say("Whoa, dizzy! Too many thoughts at once.");
      return;
    }
    play("hop");
    if (baseMood === "sleepy") flash("happy", 1600);
    const list = TIPS[stage];
    const i = tipIndex[stage] || 0;
    tipIndex[stage] = (i + 1) % list.length;
    say(list[i]);
  });

  hide.addEventListener("click", () => {
    root.classList.add("tucked");
    bubble.textContent = "";
    remember(true);
  });

  // Eyes follow a point on screen, a few pixels at most.
  let target = null;
  let frame = 0;
  function look() {
    frame = 0;
    if (!target) return;
    const r = btn.getBoundingClientRect();
    const dx = target.x - (r.left + r.width / 2);
    const dy = target.y - (r.top + r.height * 0.45);
    const d = Math.hypot(dx, dy) || 1;
    const reach = Math.min(1, d / 220);
    const x = (dx / d) * 3 * reach;
    const y = (dy / d) * 3.5 * reach;
    pupils.forEach((p) => { p.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px)`; });
  }
  function lookAt(point) {
    target = point;
    if (!frame) frame = requestAnimationFrame(look);
  }
  window.addEventListener("pointermove", (e) => lookAt({ x: e.clientX, y: e.clientY }), { passive: true });

  (function blink() {
    setTimeout(() => {
      if (baseMood !== "sleepy" && !document.hidden) {
        btn.classList.add("blink");
        setTimeout(() => btn.classList.remove("blink"), 140);
      }
      blink();
    }, 2600 + Math.random() * 3800);
  })();

  function update(ideas, links) {
    stage = stageFor(ideas, links);
    baseMood = moodFor(stage);
    if (!flashing) setMood(baseMood);
  }

  function react(what, d = {}) {
    switch (what) {
      case "added": play("hop"); if (d.ideas === 1) say("Your first idea! Press Tab to add one linked to it."); break;
      case "linked": play("hop"); flash("wow", 900); say(`Linked "${d.a}" and "${d.b}".`); break;
      case "removed": flash("worried", 1200); say("Gone. Changed your mind? Press Ctrl+Z."); break;
      case "tidied": play("spin"); flash("wow", 1100); say("All tidy. Linked ideas sit together now."); break;
      case "copied": play("hop"); say("Copied! Paste it into your notes or an email."); break;
      case "pasted": play("hop"); flash("wow", 1100); say(`I made ${d.count} ideas from your list.`); break;
      case "undo": say("Undone."); break;
      case "synced": say("Your other tab changed something. I copied it here."); break;
      case "fresh": flash("sleepy", 1200); say("Fresh start. What's on your mind?"); break;
      case "nothing": flash("worried", 1200); say(d.text); break;
    }
  }

  function start(ideas, links, returning) {
    try { if (storage.getItem("mindmesh.pipTucked")) root.classList.add("tucked"); } catch { /* ignore */ }
    update(ideas, links);
    setTimeout(() => {
      if (bubble.textContent) return;
      say(returning ? "Welcome back! Your map is right where you left it." : "Hi, I'm Pip! Tap me for tips.");
    }, 700);
  }

  return { say, react, update, start, lookAt };
}
