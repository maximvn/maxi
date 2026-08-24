/* ============================================================
   WE ARE MADE — interaction
   1. Custom cursor
   2. Split titles (letters drift apart on scroll)
   3. Track titles (letter-spacing widens on scroll)
   4. Word-by-word reveal (manifesto)
   5. Ticker that reacts to scroll speed
   6. Roll-on-hover links (upright → italic)
   7. Hero: generative, mouse-reactive ink-wash visual (video placeholder)
   8. Module art: generative ink-line drawings per module
   9. Mobile menu + reveal-on-scroll
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

  /* ---------- 2. SPLIT TITLES ---------- */
  // Each letter in its own span; on scroll the letters drift apart
  // from the centre while the line gently fades.
  const splitEls = [];
  document.querySelectorAll("[data-split]").forEach((el) => {
    const text = el.textContent;
    el.textContent = "";
    const chars = [];
    for (const ch of text) {
      const span = document.createElement("span");
      span.className = "ch";
      span.textContent = ch === " " ? " " : ch;
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
      let p; // 0 = at rest, 1 = fully apart
      if (inHero) {
        // Hero lines rest together and drift apart as you scroll away.
        p = Math.min(1, Math.max(0, window.scrollY / (vh * 0.8)));
      } else {
        // Other split titles assemble around the centre of the screen
        // and drift apart outside it.
        const center = rect.top + rect.height / 2;
        p = Math.min(1, Math.abs(center - vh / 2) / (vh * 0.6));
      }
      const mid = (chars.length - 1) / 2;
      for (let i = 0; i < chars.length; i++) {
        const d = (i - mid) / Math.max(mid, 1); // -1 … 1
        const x = d * p * el.clientWidth * 0.16;
        chars[i].style.transform = `translateX(${x}px)`;
      }
      el.style.opacity = String(1 - p * 0.6);
    }
  }

  /* ---------- 3. TRACK TITLES ---------- */
  // Section titles breathe: letter-spacing widens as they pass
  // through the centre of the screen.
  const trackEls = [...document.querySelectorAll("[data-track]")];
  function updateTracks() {
    const vh = window.innerHeight;
    for (const el of trackEls) {
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      // 1 in the centre of the screen, 0 at the edges
      const t = Math.max(0, 1 - Math.abs(center - vh / 2) / (vh * 0.75));
      el.style.letterSpacing = `${(t * 0.09).toFixed(3)}em`;
      el.style.wordSpacing = `${(t * 0.2).toFixed(3)}em`;
    }
  }

  /* ---------- 4. WORD REVEAL (manifesto) ---------- */
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

  /* ---------- 5. TICKER ---------- */
  const track = document.querySelector(".ticker__track");
  let tickerX = 0, scrollVel = 0, lastScrollY = window.scrollY;
  function updateTicker() {
    if (!track) return;
    const base = prefersReduced ? 0 : 0.8;
    tickerX -= base + Math.min(Math.abs(scrollVel) * 0.3, 12);
    const half = track.scrollWidth / 2;
    if (-tickerX >= half) tickerX += half;
    track.style.transform = `translateX(${tickerX}px)`;
  }

  /* ---------- SCROLL LOOP ---------- */
  function onFrame() {
    const y = window.scrollY;
    scrollVel = lerp(scrollVel, y - lastScrollY, 0.12);
    lastScrollY = y;
    if (!prefersReduced) {
      updateSplits();
      updateTracks();
    }
    updateWords();
    updateTicker();
    requestAnimationFrame(onFrame);
  }
  requestAnimationFrame(onFrame);

  /* ---------- 6. ROLL-ON-HOVER LINKS ---------- */
  // Two stacked copies: the upright text rolls up and an italic
  // copy rolls in from below.
  document.querySelectorAll("[data-roll]").forEach((el) => {
    const text = el.textContent;
    el.textContent = "";
    const a = document.createElement("span");
    a.className = "roll";
    a.textContent = text;
    const b = document.createElement("span");
    b.className = "roll roll--dup";
    b.textContent = text;
    a.appendChild(b);
    el.appendChild(a);
  });

  /* ---------- 7. HERO CANVAS (video placeholder) ---------- */
  // Soft ink-wash clouds on warm paper, drawn on a low-res buffer
  // and scaled up — reads as a calm abstract visual. Follows the mouse.
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

    // warm shadow tones + one deep ink accent, all translucent
    const BLOBS = [
      { rgb: [184, 173, 152], a: 0.5, r: 0.6, sp: 0.00021, ph: 0.0, follow: 0.3 },
      { rgb: [154, 144, 122], a: 0.4, r: 0.45, sp: 0.00029, ph: 2.1, follow: -0.22 },
      { rgb: [23, 21, 18], a: 0.22, r: 0.3, sp: 0.00039, ph: 4.2, follow: 0.55 },
      { rgb: [210, 200, 178], a: 0.5, r: 0.75, sp: 0.00016, ph: 5.4, follow: 0.12 },
    ];

    function drawHero(t) {
      mouse.x = lerp(mouse.x, mouse.tx, 0.05);
      mouse.y = lerp(mouse.y, mouse.ty, 0.05);

      const bw = buf.width, bh = buf.height;
      bctx.globalCompositeOperation = "source-over";
      bctx.fillStyle = "#f1ede4";
      bctx.fillRect(0, 0, bw, bh);
      bctx.globalCompositeOperation = "multiply";

      for (const b of BLOBS) {
        const ox = Math.sin(t * b.sp + b.ph) * 0.3 + Math.cos(t * b.sp * 0.7 + b.ph * 2) * 0.16;
        const oy = Math.cos(t * b.sp * 0.85 + b.ph) * 0.28 + Math.sin(t * b.sp * 1.3) * 0.12;
        const x = (0.5 + ox + (mouse.x - 0.5) * b.follow) * bw;
        const y = (0.45 + oy + (mouse.y - 0.5) * b.follow) * bh;
        const r = b.r * Math.min(bw, bh) * (1 + Math.sin(t * b.sp * 2 + b.ph) * 0.1);
        const g = bctx.createRadialGradient(x, y, 0, x, y, Math.max(r, 1));
        const [cr, cg, cb] = b.rgb;
        g.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${b.a})`);
        g.addColorStop(1, "rgba(255, 255, 255, 0)");
        bctx.fillStyle = g;
        bctx.beginPath();
        bctx.arc(x, y, Math.max(r, 1), 0, Math.PI * 2);
        bctx.fill();
      }

      ctx.imageSmoothingEnabled = true;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(buf, 0, 0, w, h);

      // light veil at the bottom so the text stays readable
      const v = ctx.createLinearGradient(0, 0, 0, h);
      v.addColorStop(0, "rgba(241, 237, 228, 0.1)");
      v.addColorStop(0.55, "rgba(241, 237, 228, 0)");
      v.addColorStop(1, "rgba(241, 237, 228, 0.55)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);

      if (!prefersReduced) requestAnimationFrame(drawHero);
    }
    requestAnimationFrame(drawHero);
  }

  /* ---------- 8. MODULE ART ---------- */
  // Each module gets its own generative ink-line drawing
  // (seeded per module); on hover the lines start to move.
  document.querySelectorAll(".module").forEach((mod) => {
    const canvas = mod.querySelector(".module__art");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const seed = parseInt(mod.dataset.seed || "1", 10);
    let t = seed * 137, raf = null;

    function rnd(n) { return Math.abs(Math.sin(seed * 91.7 + n * 47.9)) % 1; }

    function draw() {
      const W = canvas.width, H = canvas.height;
      ctx.fillStyle = "#ece7db";
      ctx.fillRect(0, 0, W, H);
      const lines = 22 + Math.floor(rnd(1) * 16);
      for (let i = 0; i < lines; i++) {
        const y0 = (i / lines) * H;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 6) {
          const y = y0 +
            Math.sin(x * (0.008 + rnd(2) * 0.012) + t * 0.02 + i * (0.3 + rnd(3) * 0.4)) * (8 + rnd(4) * 22) +
            Math.sin(x * 0.03 + i) * 3;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        const isBold = i % Math.max(3, Math.floor(rnd(5) * 9)) === 0;
        ctx.strokeStyle = isBold ? "rgba(23, 21, 18, 0.75)" : "rgba(23, 21, 18, 0.28)";
        ctx.lineWidth = isBold ? 1.4 : 0.8;
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

  /* ---------- MOBILE MENU ---------- */
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
