/* ============================================================
   MAXIVISUALS — interactie
   1. Custom cursor
   2. Split-titels (letters die uit elkaar schuiven op scroll)
   3. Stretch-titels (variabel font rekt uit op scroll)
   4. Woord-voor-woord reveal (manifest)
   5. Marquee die op scrollsnelheid reageert
   6. Scramble-effect op links (hover)
   7. Hero: generatieve, muis-reactieve visual (video-placeholder)
   8. Module-art: generatieve mini-visuals per module
   9. Mobiel menu + reveal-on-scroll
   ============================================================ */

(() => {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- 1. CUSTOM CURSOR ---------- */
  const cursor = document.querySelector(".cursor");
  if (cursor && window.matchMedia("(hover: hover)").matches) {
    let cx = -100, cy = -100, tx = -100, ty = -100;
    window.addEventListener("pointermove", (e) => { tx = e.clientX; ty = e.clientY; });
    (function moveCursor() {
      cx = lerp(cx, tx, 0.2);
      cy = lerp(cy, ty, 0.2);
      cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      requestAnimationFrame(moveCursor);
    })();
    document.querySelectorAll("[data-hover]").forEach((el) => {
      el.addEventListener("pointerenter", () => cursor.classList.add("is-active"));
      el.addEventListener("pointerleave", () => cursor.classList.remove("is-active"));
    });
  }

  /* ---------- 2. SPLIT-TITELS ---------- */
  // Elke letter in een eigen span; op scroll schuiven de letters
  // vanuit het midden uit elkaar en vervaagt de regel licht.
  const splitEls = [];
  document.querySelectorAll("[data-split]").forEach((el) => {
    const text = el.textContent;
    el.textContent = "";
    const chars = [];
    for (const ch of text) {
      const span = document.createElement("span");
      span.className = "ch";
      span.textContent = ch === " " ? " " : ch;
      el.appendChild(span);
      chars.push(span);
    }
    splitEls.push({ el, chars });
  });

  function updateSplits() {
    const vh = window.innerHeight;
    for (const { el, chars } of splitEls) {
      const rect = el.getBoundingClientRect();
      const inHero = el.closest(".hero") !== null;
      let p; // 0 = rust, 1 = maximaal uit elkaar
      if (inHero) {
        // Hero-regels staan in rust bij elkaar en spatten uiteen
        // terwijl je wegscrolt.
        p = Math.min(1, Math.max(0, window.scrollY / (vh * 0.75)));
      } else {
        // Overige split-titels komen "samen" rond het midden van het scherm
        // en schuiven daarbuiten uit elkaar.
        const center = rect.top + rect.height / 2;
        p = Math.min(1, Math.abs(center - vh / 2) / (vh * 0.55));
      }
      const mid = (chars.length - 1) / 2;
      for (let i = 0; i < chars.length; i++) {
        const d = (i - mid) / Math.max(mid, 1); // -1 … 1
        const x = d * p * el.clientWidth * 0.18;
        const r = d * p * 6;
        chars[i].style.transform = `translateX(${x}px) rotate(${r}deg)`;
      }
      el.style.opacity = String(1 - p * 0.55);
    }
  }

  /* ---------- 3. STRETCH-TITELS (variabel font) ---------- */
  // Archivo heeft een breedte-as (62–125): koppen rekken uit
  // naarmate ze door het scherm bewegen.
  const stretchEls = [...document.querySelectorAll("[data-stretch]")];
  function updateStretch() {
    const vh = window.innerHeight;
    for (const el of stretchEls) {
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      // 1 in het midden van het scherm, 0 aan de randen
      const t = Math.max(0, 1 - Math.abs(center - vh / 2) / (vh * 0.75));
      const wdth = 62 + t * 58; // 62 → 120
      el.style.fontVariationSettings = `"wdth" ${wdth.toFixed(1)}`;
      el.style.letterSpacing = `${(t * 0.02 - 0.01).toFixed(3)}em`;
    }
  }

  /* ---------- 4. WOORD-REVEAL (manifest) ---------- */
  const wordsEl = document.querySelector("[data-words]");
  let wordSpans = [];
  if (wordsEl) {
    const words = wordsEl.textContent.trim().split(/\s+/);
    wordsEl.textContent = "";
    words.forEach((w, i) => {
      const span = document.createElement("span");
      span.className = "w";
      span.textContent = w;
      wordsEl.appendChild(span);
      if (i < words.length - 1) wordsEl.appendChild(document.createTextNode(" "));
      wordSpans.push(span);
    });
  }
  function updateWords() {
    if (!wordsEl) return;
    const vh = window.innerHeight;
    const rect = wordsEl.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (vh * 0.85 - rect.top) / (vh * 0.7)));
    const n = Math.floor(p * wordSpans.length);
    wordSpans.forEach((s, i) => s.classList.toggle("is-on", i < n));
  }

  /* ---------- 5. MARQUEE ---------- */
  const track = document.querySelector(".marquee__track");
  let marqueeX = 0, scrollVel = 0, lastScrollY = window.scrollY;
  function updateMarquee() {
    if (!track) return;
    const base = prefersReduced ? 0 : 1.2;
    marqueeX -= base + Math.min(Math.abs(scrollVel) * 0.35, 14);
    const half = track.scrollWidth / 2;
    if (-marqueeX >= half) marqueeX += half;
    track.style.transform = `translateX(${marqueeX}px)`;
  }

  /* ---------- SCROLL LOOP ---------- */
  function onFrame() {
    const y = window.scrollY;
    scrollVel = lerp(scrollVel, y - lastScrollY, 0.12);
    lastScrollY = y;
    if (!prefersReduced) {
      updateSplits();
      updateStretch();
    }
    updateWords();
    updateMarquee();
    requestAnimationFrame(onFrame);
  }
  requestAnimationFrame(onFrame);

  /* ---------- 6. SCRAMBLE OP HOVER ---------- */
  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&@01▮";
  document.querySelectorAll("[data-scramble]").forEach((el) => {
    const original = el.textContent;
    let frame = 0, raf = null;
    el.addEventListener("pointerenter", () => {
      if (prefersReduced) return;
      cancelAnimationFrame(raf);
      frame = 0;
      const total = Math.max(original.length * 2, 14);
      (function scramble() {
        frame++;
        const fixed = Math.floor((frame / total) * original.length);
        let out = "";
        for (let i = 0; i < original.length; i++) {
          const ch = original[i];
          if (i < fixed || /\s/.test(ch) || ch === "→" || ch === " ") out += ch;
          else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        el.textContent = out;
        if (frame < total) raf = requestAnimationFrame(scramble);
        else el.textContent = original;
      })();
    });
    el.addEventListener("pointerleave", () => {
      cancelAnimationFrame(raf);
      el.textContent = original;
    });
  });

  /* ---------- 7. HERO CANVAS (video-placeholder) ---------- */
  // Vloeiende, muis-reactieve "blobs" op een laag-resolutie buffer,
  // opgeblazen naar volledig scherm — leest als een abstracte visual.
  const heroCanvas = document.getElementById("heroCanvas");
  if (heroCanvas) {
    const ctx = heroCanvas.getContext("2d");
    const buf = document.createElement("canvas");
    const bctx = buf.getContext("2d");
    const SCALE = 0.14;

    let w = 0, h = 0;
    function resizeHero() {
      w = heroCanvas.clientWidth;
      h = heroCanvas.clientHeight;
      heroCanvas.width = w;
      heroCanvas.height = h;
      buf.width = Math.max(2, Math.floor(w * SCALE));
      buf.height = Math.max(2, Math.floor(h * SCALE));
    }
    resizeHero();
    window.addEventListener("resize", resizeHero);

    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    window.addEventListener("pointermove", (e) => {
      mouse.tx = e.clientX / window.innerWidth;
      mouse.ty = e.clientY / window.innerHeight;
    });

    const BLOBS = [
      { hue: [200, 200, 190], r: 0.55, sp: 0.00023, ph: 0.0, follow: 0.35 },
      { hue: [235, 235, 225], r: 0.42, sp: 0.00031, ph: 2.1, follow: -0.25 },
      { hue: [200, 255, 46], r: 0.30, sp: 0.00041, ph: 4.2, follow: 0.6 },
      { hue: [90, 90, 96], r: 0.72, sp: 0.00017, ph: 5.4, follow: 0.15 },
    ];

    function drawHero(t) {
      mouse.x = lerp(mouse.x, mouse.tx, 0.05);
      mouse.y = lerp(mouse.y, mouse.ty, 0.05);

      const bw = buf.width, bh = buf.height;
      bctx.fillStyle = "#0b0b0b";
      bctx.fillRect(0, 0, bw, bh);
      bctx.globalCompositeOperation = "lighter";

      for (const b of BLOBS) {
        const ox = Math.sin(t * b.sp + b.ph) * 0.32 + Math.cos(t * b.sp * 0.7 + b.ph * 2) * 0.18;
        const oy = Math.cos(t * b.sp * 0.85 + b.ph) * 0.3 + Math.sin(t * b.sp * 1.3) * 0.14;
        const x = (0.5 + ox + (mouse.x - 0.5) * b.follow) * bw;
        const y = (0.48 + oy + (mouse.y - 0.5) * b.follow) * bh;
        const r = b.r * Math.min(bw, bh) * (1 + Math.sin(t * b.sp * 2 + b.ph) * 0.12);
        const g = bctx.createRadialGradient(x, y, 0, x, y, Math.max(r, 1));
        const [cr, cg, cb] = b.hue;
        g.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, 0.5)`);
        g.addColorStop(1, "rgba(0, 0, 0, 0)");
        bctx.fillStyle = g;
        bctx.beginPath();
        bctx.arc(x, y, Math.max(r, 1), 0, Math.PI * 2);
        bctx.fill();
      }
      bctx.globalCompositeOperation = "source-over";

      ctx.imageSmoothingEnabled = true;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(buf, 0, 0, w, h);

      // donkere vignet zodat de tekst leesbaar blijft
      const v = ctx.createLinearGradient(0, 0, 0, h);
      v.addColorStop(0, "rgba(11, 11, 11, 0.25)");
      v.addColorStop(0.55, "rgba(11, 11, 11, 0.05)");
      v.addColorStop(1, "rgba(11, 11, 11, 0.72)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);

      if (!prefersReduced) requestAnimationFrame(drawHero);
    }
    requestAnimationFrame(drawHero);
  }

  /* ---------- 8. MODULE-ART ---------- */
  // Elke module krijgt een eigen generatief interferentie-patroon
  // (seed per module); op hover gaat het patroon bewegen.
  document.querySelectorAll(".module").forEach((mod) => {
    const canvas = mod.querySelector(".module__art");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const seed = parseInt(mod.dataset.seed || "1", 10);
    let t = seed * 137, raf = null;

    function rnd(n) { return Math.abs(Math.sin(seed * 91.7 + n * 47.9)) % 1; }

    function draw() {
      const W = canvas.width, H = canvas.height;
      ctx.fillStyle = "#0e0e0d";
      ctx.fillRect(0, 0, W, H);
      const lines = 26 + Math.floor(rnd(1) * 18);
      for (let i = 0; i < lines; i++) {
        const y0 = (i / lines) * H;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 6) {
          const y = y0 +
            Math.sin(x * (0.008 + rnd(2) * 0.012) + t * 0.02 + i * (0.3 + rnd(3) * 0.4)) * (8 + rnd(4) * 22) +
            Math.sin(x * 0.03 + i) * 3;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        const isAccent = i % Math.max(3, Math.floor(rnd(5) * 9)) === 0;
        ctx.strokeStyle = isAccent ? "rgba(200, 255, 46, 0.8)" : "rgba(239, 236, 228, 0.35)";
        ctx.lineWidth = isAccent ? 1.4 : 0.8;
        ctx.stroke();
      }
    }
    draw();

    mod.addEventListener("pointerenter", () => {
      if (prefersReduced) return;
      cancelAnimationFrame(raf);
      (function anim() { t += 1; draw(); raf = requestAnimationFrame(anim); })();
    });
    mod.addEventListener("pointerleave", () => cancelAnimationFrame(raf));
  });

  /* ---------- 9. FOOTER WORDMARK (per letter) ---------- */
  document.querySelectorAll("[data-wave]").forEach((el) => {
    const text = el.textContent;
    el.textContent = "";
    for (const ch of text) {
      const span = document.createElement("span");
      span.className = "ch";
      span.textContent = ch;
      el.appendChild(span);
    }
  });

  /* ---------- MOBIEL MENU ---------- */
  const burger = document.querySelector(".nav__burger");
  const mobileMenu = document.querySelector(".mobilemenu");
  if (burger && mobileMenu) {
    burger.addEventListener("click", () => {
      const open = mobileMenu.classList.toggle("is-open");
      document.body.classList.toggle("menu-open", open);
      mobileMenu.setAttribute("aria-hidden", String(!open));
    });
    mobileMenu.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        mobileMenu.classList.remove("is-open");
        document.body.classList.remove("menu-open");
        mobileMenu.setAttribute("aria-hidden", "true");
      })
    );
  }

  /* ---------- REVEAL ON SCROLL ---------- */
  const revealTargets = document.querySelectorAll(
    ".section__label, .section__title, .manifest__stats, .module, .pack, .tool, .faq__item, .footer__mail"
  );
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    }),
    { threshold: 0.12 }
  );
  revealTargets.forEach((el) => { el.classList.add("reveal"); io.observe(el); });
})();
