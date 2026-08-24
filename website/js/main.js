/* ============================================================
   WE ARE MADE — interaction
    1. Preloader (counter + curtain + intro choreography)
    2. Lenis-style smooth scrolling (wheel inertia)
    3. Custom cursor (with contextual labels)
    4. Fit-to-width hero lines
    5. Split titles (letters drift apart on scroll)
    6. Track titles (letter-spacing breathes on scroll)
    7. Fill title (outline → ink as you scroll through)
    8. Word-by-word reveal (manifesto)
    9. Ticker that reacts to scroll speed
   10. Roll-on-hover links / magnetic buttons
   11. Hero: living ink-ribbon visual (video placeholder)
   12. Generative artworks (gallery + floating module preview)
   13. Parallax (hero media + gallery pieces) + nav hide/show
   ============================================================ */

(() => {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const INK = "#171512";
  const PAPER = "#ece7db";
  const RED = "#c03018";

  /* ---------- 1. PRELOADER ---------- */
  const loader = document.querySelector(".loader");
  const countEl = document.querySelector(".loader__count");
  document.body.classList.add("is-loading");

  function finishLoad() {
    document.body.classList.remove("is-loading");
    document.body.classList.add("is-ready");
    if (loader) loader.classList.add("is-done");
    setTimeout(() => {
      document.body.classList.add("intro-done");
      if (loader) loader.style.display = "none";
    }, 1500);
  }

  if (prefersReduced || !loader) {
    finishLoad();
  } else {
    const t0 = performance.now();
    const DUR = 1350;
    (function tick(now) {
      const p = clamp((now - t0) / DUR, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      if (countEl) countEl.textContent = String(Math.floor(eased * 100));
      if (p < 1) requestAnimationFrame(tick);
      else finishLoad();
    })(t0);
  }

  /* ---------- 2. SMOOTH SCROLLING ---------- */
  // Lenis-style: the wheel feeds a target, a rAF loop glides the real
  // scroll position towards it. Native behaviour stays intact for
  // touch, keyboard and scrollbar drags.
  const smooth = {
    on: finePointer && !prefersReduced,
    target: window.scrollY,
    current: window.scrollY,
  };
  const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;

  if (smooth.on) {
    window.addEventListener("wheel", (e) => {
      if (e.ctrlKey || document.body.classList.contains("menu-open")) return;
      e.preventDefault();
      const mult = e.deltaMode === 1 ? 16 : 1;
      smooth.target = clamp(smooth.target + e.deltaY * mult, 0, maxScroll());
    }, { passive: false });

    window.addEventListener("scroll", () => {
      // scrollbar drag / keyboard: adopt the external position
      if (Math.abs(window.scrollY - Math.round(smooth.current)) > 2) {
        smooth.target = smooth.current = window.scrollY;
      }
    });
  }

  // Anchor glide
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const el = id.length > 1 && document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      const y = clamp(el.getBoundingClientRect().top + window.scrollY, 0, maxScroll());
      if (smooth.on) smooth.target = y;
      else window.scrollTo({ top: y, behavior: "smooth" });
    });
  });

  /* ---------- 3. CUSTOM CURSOR ---------- */
  const cursor = document.querySelector(".cursor");
  const cursorLabel = document.querySelector(".cursor__label");
  if (cursor && finePointer) {
    let cx = -100, cy = -100, tx = -100, ty = -100;
    window.addEventListener("pointermove", (e) => { tx = e.clientX; ty = e.clientY; });
    (function moveCursor() {
      cx = lerp(cx, tx, 0.22);
      cy = lerp(cy, ty, 0.22);
      cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      requestAnimationFrame(moveCursor);
    })();
    document.querySelectorAll("[data-hover]").forEach((el) => {
      el.addEventListener("pointerenter", () => {
        cursor.classList.add("is-active");
        const label = el.dataset.cursor;
        if (label && cursorLabel) {
          cursorLabel.textContent = label;
          cursor.classList.add("has-label");
        }
      });
      el.addEventListener("pointerleave", () => {
        cursor.classList.remove("is-active", "has-label");
      });
    });
  }

  /* ---------- CHAR SPLITTER (keeps nested elements intact) ---------- */
  function splitChars(root) {
    const chars = [];
    (function walk(node) {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const ch of n.textContent) {
            const s = document.createElement("span");
            s.className = "ch";
            s.textContent = ch;
            frag.appendChild(s);
            chars.push(s);
          }
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") {
          walk(n);
        }
      });
    })(root);
    return chars;
  }

  /* ---------- 4. FIT-TO-WIDTH HERO LINES ---------- */
  const fitEls = [...document.querySelectorAll("[data-fit]")];
  function fitLines() {
    for (const el of fitEls) {
      const parent = el.closest(".hero__title") || el.parentElement;
      el.style.fontSize = "100px";
      const w = el.scrollWidth;
      if (w > 0) el.style.fontSize = `${(100 * parent.clientWidth / w) * 0.99}px`;
    }
    // cap the block height so the title never runs into the nav
    const title = document.querySelector(".hero__title");
    if (title && fitEls.length) {
      const avail = window.innerHeight * 0.56;
      const h = title.getBoundingClientRect().height;
      if (h > avail) {
        const k = avail / h;
        for (const el of fitEls) {
          el.style.fontSize = `${parseFloat(el.style.fontSize) * k}px`;
        }
      }
    }
  }

  /* ---------- 5. SPLIT TITLES ---------- */
  const splitEls = [];
  document.querySelectorAll("[data-split]").forEach((el, i) => {
    splitEls.push({ el, chars: splitChars(el), dir: i % 2 === 0 ? -1 : 1 });
  });

  function updateSplits() {
    const vh = window.innerHeight;
    for (const { el, chars, dir } of splitEls) {
      const inHero = el.closest(".hero") !== null;
      let p; // 0 = at rest, 1 = fully apart
      if (inHero) {
        // hands off until the intro reveal has finished
        if (!document.body.classList.contains("intro-done")) continue;
        p = clamp(window.scrollY / (vh * 0.85), 0, 1);
        // whole line slides sideways while its letters spread
        el.style.transform = `translateX(${dir * p * vh * 0.14}px)`;
      } else {
        const rect = el.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        p = clamp(Math.abs(center - vh / 2) / (vh * 0.6), 0, 1);
      }
      const mid = (chars.length - 1) / 2;
      for (let i = 0; i < chars.length; i++) {
        const d = (i - mid) / Math.max(mid, 1);
        chars[i].style.transform = `translateX(${d * p * el.clientWidth * 0.12}px)`;
      }
      el.style.opacity = String(1 - p * 0.65);
    }
  }

  /* ---------- 6. TRACK TITLES ---------- */
  const trackEls = [...document.querySelectorAll("[data-track]")];
  function updateTracks() {
    const vh = window.innerHeight;
    for (const el of trackEls) {
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const t = Math.max(0, 1 - Math.abs(center - vh / 2) / (vh * 0.75));
      el.style.letterSpacing = `${(t * 0.08).toFixed(3)}em`;
      el.style.wordSpacing = `${(t * 0.18).toFixed(3)}em`;
    }
  }

  /* ---------- 7. FILL TITLE (outline → ink) ---------- */
  const fillEls = [];
  document.querySelectorAll("[data-fill]").forEach((el) => {
    const chars = splitChars(el);
    // the closing full stop turns red once filled
    for (let i = chars.length - 1; i >= 0; i--) {
      if (chars[i].textContent === ".") { chars[i].classList.add("is-red"); break; }
    }
    fillEls.push({ el, chars });
  });
  function updateFills() {
    const vh = window.innerHeight;
    for (const { el, chars } of fillEls) {
      const rect = el.getBoundingClientRect();
      const p = clamp((vh * 0.92 - rect.top) / (vh * 0.8), 0, 1);
      const n = Math.floor(p * chars.length);
      chars.forEach((c, i) => c.classList.toggle("is-filled", i < n));
    }
  }

  /* ---------- 8. WORD REVEAL (manifesto) ---------- */
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
    const p = clamp((vh * 0.85 - rect.top) / (vh * 0.7), 0, 1);
    const n = Math.floor(p * wordSpans.length);
    wordSpans.forEach((s, i) => s.classList.toggle("is-on", i < n));
  }

  /* ---------- 9. TICKER ---------- */
  const tickerTrack = document.querySelector(".ticker__track");
  let tickerX = 0, scrollVel = 0, lastScrollY = window.scrollY;
  function updateTicker() {
    if (!tickerTrack) return;
    const base = prefersReduced ? 0 : 1;
    tickerX -= base + Math.min(Math.abs(scrollVel) * 0.35, 16);
    const half = tickerTrack.scrollWidth / 2;
    if (-tickerX >= half) tickerX += half;
    tickerTrack.style.transform = `translateX(${tickerX}px)`;
  }

  /* ---------- 10a. ROLL-ON-HOVER LINKS ---------- */
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

  /* ---------- 10b. MAGNETIC BUTTONS ---------- */
  if (finePointer && !prefersReduced) {
    document.querySelectorAll("[data-magnet]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * 0.22}px, ${dy * 0.32}px)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }

  /* ---------- 11. HERO INK RIBBONS (video placeholder) ---------- */
  // Ink brushes wander over the paper along a flowing field, leaving
  // slowly fading trails. The field bends around the mouse.
  const heroCanvas = document.getElementById("heroCanvas");
  if (heroCanvas) {
    const ctx = heroCanvas.getContext("2d");
    let w = 0, h = 0;
    const mouse = { x: 0.5, y: 0.5, vx: 0 };

    function resizeHero() {
      w = heroCanvas.clientWidth;
      h = heroCanvas.clientHeight;
      heroCanvas.width = w;
      heroCanvas.height = h;
      ctx.fillStyle = "#f1ede4";
      ctx.fillRect(0, 0, w, h);
    }
    resizeHero();
    window.addEventListener("resize", resizeHero);

    window.addEventListener("pointermove", (e) => {
      mouse.vx = Math.abs(e.movementX) + Math.abs(e.movementY);
      mouse.x = e.clientX / window.innerWidth;
      mouse.y = e.clientY / window.innerHeight;
    });

    const N = 15;
    const brushes = [];
    for (let i = 0; i < N; i++) {
      brushes.push({
        x: Math.random() * 1,
        y: Math.random() * 1,
        life: 100 + Math.random() * 300,
        red: i === 0, // one red thread
      });
    }

    function field(x, y, t) {
      // pseudo-noise flow field + a swirl around the mouse
      let a = Math.sin(x * 3.1 + t * 0.00022) + Math.cos(y * 2.7 - t * 0.00018)
            + Math.sin((x + y) * 1.9 + t * 0.00013);
      const mdx = x - mouse.x, mdy = y - mouse.y;
      const md = Math.sqrt(mdx * mdx + mdy * mdy);
      if (md < 0.3) a += (0.3 - md) * 8 * Math.atan2(mdy, mdx);
      return a;
    }

    function drawHero(t) {
      // paper veil: fades old strokes into the page
      ctx.fillStyle = "rgba(241, 237, 228, 0.05)";
      ctx.fillRect(0, 0, w, h);

      for (const b of brushes) {
        const a = field(b.x, b.y, t);
        const speed = 0.0016 + Math.min(mouse.vx, 40) * 0.00002;
        const nx = b.x + Math.cos(a) * speed;
        const ny = b.y + Math.sin(a) * speed * (h / w);
        ctx.beginPath();
        ctx.moveTo(b.x * w, b.y * h);
        ctx.lineTo(nx * w, ny * h);
        ctx.strokeStyle = b.red
          ? "rgba(192, 48, 24, 0.38)"
          : "rgba(23, 21, 18, 0.2)";
        ctx.lineWidth = b.red ? 1.6 : 0.5 + 1.6 * Math.abs(Math.sin(t * 0.0006 + b.life));
        ctx.lineCap = "round";
        ctx.stroke();
        b.x = nx; b.y = ny;
        b.life--;
        if (b.life <= 0 || b.x < -0.05 || b.x > 1.05 || b.y < -0.05 || b.y > 1.05) {
          // respawn, sometimes near the mouse so it feels responsive
          const nearMouse = Math.random() < 0.5;
          b.x = nearMouse ? mouse.x + (Math.random() - 0.5) * 0.2 : Math.random();
          b.y = nearMouse ? mouse.y + (Math.random() - 0.5) * 0.2 : Math.random();
          b.life = 150 + Math.random() * 350;
        }
      }
      mouse.vx *= 0.94;
      if (!prefersReduced) requestAnimationFrame(drawHero);
    }
    if (!prefersReduced) requestAnimationFrame(drawHero);
    else {
      // reduced motion: draw a static version in a few hundred steps
      function drawHeroStatic(s) {
        for (const b of brushes) {
          const a = field(b.x, b.y, s * 16);
          const nx = b.x + Math.cos(a) * 0.002;
          const ny = b.y + Math.sin(a) * 0.002;
          ctx.beginPath();
          ctx.moveTo(b.x * w, b.y * h);
          ctx.lineTo(nx * w, ny * h);
          ctx.strokeStyle = b.red ? "rgba(192,48,24,.5)" : "rgba(23,21,18,.16)";
          ctx.lineWidth = 1;
          ctx.stroke();
          b.x = nx; b.y = ny;
        }
      }
      for (let s = 0; s < 400; s++) drawHeroStatic(s);
    }
  }

  /* ---------- 12. GENERATIVE ARTWORKS ---------- */
  // Four ink-on-paper styles, seeded per piece. Used by the gallery
  // and by the floating module preview.
  function artDraw(ctx, W, H, seed, t) {
    const rnd = (n) => Math.abs(Math.sin(seed * 91.7 + n * 47.9)) % 1;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    const style = seed % 4;

    if (style === 0) {
      // flowing horizontal waves
      const lines = 26 + Math.floor(rnd(1) * 16);
      for (let i = 0; i < lines; i++) {
        const y0 = (i / lines) * H;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 8) {
          const y = y0 + Math.sin(x * (0.006 + rnd(2) * 0.01) + t * 0.02 + i * (0.3 + rnd(3) * 0.4)) * (10 + rnd(4) * 30);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        const red = i === Math.floor(rnd(6) * lines);
        ctx.strokeStyle = red ? RED : `rgba(23, 21, 18, ${i % 4 === 0 ? 0.7 : 0.25})`;
        ctx.lineWidth = red ? 2 : i % 4 === 0 ? 1.3 : 0.7;
        ctx.stroke();
      }
    } else if (style === 1) {
      // warped concentric rings
      const cx = W * (0.35 + rnd(1) * 0.3), cy = H * (0.35 + rnd(2) * 0.3);
      const rings = 22 + Math.floor(rnd(3) * 10);
      for (let i = 1; i <= rings; i++) {
        const r = (i / rings) * Math.max(W, H) * 0.7;
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.08) {
          const rr = r + Math.sin(a * (3 + Math.floor(rnd(4) * 4)) + t * 0.02 + i * 0.5) * (6 + rnd(5) * 14);
          const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
          a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        const red = i === Math.floor(rnd(7) * rings);
        ctx.strokeStyle = red ? RED : `rgba(23, 21, 18, ${i % 3 === 0 ? 0.65 : 0.22})`;
        ctx.lineWidth = red ? 2 : i % 3 === 0 ? 1.2 : 0.7;
        ctx.stroke();
      }
    } else if (style === 2) {
      // displaced vertical strokes + red block
      const cols = 40 + Math.floor(rnd(1) * 24);
      for (let i = 0; i < cols; i++) {
        const x0 = (i / cols) * W;
        ctx.beginPath();
        for (let y = 0; y <= H; y += 8) {
          const x = x0 + Math.sin(y * (0.008 + rnd(2) * 0.008) + t * 0.02 + i * 0.35) * (6 + rnd(3) * 18);
          y === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(23, 21, 18, ${i % 5 === 0 ? 0.6 : 0.2})`;
        ctx.lineWidth = i % 5 === 0 ? 1.2 : 0.7;
        ctx.stroke();
      }
      ctx.fillStyle = RED;
      const bw = W * (0.1 + rnd(4) * 0.12);
      ctx.fillRect(W * (0.15 + rnd(5) * 0.55), H * (0.15 + rnd(6) * 0.5), bw, bw * (0.5 + rnd(7)));
    } else {
      // breathing dot field
      const step = 18 + Math.floor(rnd(1) * 8);
      for (let y = step; y < H; y += step) {
        for (let x = step; x < W; x += step) {
          const s = 1.2 + Math.abs(Math.sin(x * 0.02 + y * 0.015 + t * 0.03 + seed)) * (3.4 + rnd(2) * 2);
          const red = rnd(x * 0.01 + y * 0.013) > 0.985;
          ctx.fillStyle = red ? RED : `rgba(23, 21, 18, ${0.25 + 0.5 * Math.abs(Math.sin(x * 0.01 - y * 0.02 + seed))})`;
          ctx.beginPath();
          ctx.arc(x, y, s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // paper edge vignette
    ctx.strokeStyle = "rgba(23, 21, 18, 0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }

  // Gallery pieces: draw once, animate on hover
  const pieces = [...document.querySelectorAll(".piece")];
  pieces.forEach((piece) => {
    const canvas = piece.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const seed = parseInt(piece.dataset.art || "1", 10);
    let t = seed * 113, raf = null;
    artDraw(ctx, canvas.width, canvas.height, seed, t);
    piece.addEventListener("pointerenter", () => {
      if (prefersReduced) return;
      cancelAnimationFrame(raf);
      (function anim() { t += 1; artDraw(ctx, canvas.width, canvas.height, seed, t); raf = requestAnimationFrame(anim); })();
    });
    piece.addEventListener("pointerleave", () => cancelAnimationFrame(raf));
  });

  // Floating module preview
  const floatPrev = document.querySelector(".floatpreview");
  const modulesList = document.querySelector(".modules__list");
  if (floatPrev && modulesList && finePointer) {
    const pctx = floatPrev.getContext("2d");
    let fx = 0, fy = 0, fxT = 0, fyT = 0, prevRaf = null, prevT = 0, prevSeed = 1;
    function animPrev() {
      fx = lerp(fx, fxT, 0.16);
      fy = lerp(fy, fyT, 0.16);
      floatPrev.style.left = `${fx}px`;
      floatPrev.style.top = `${fy}px`;
      prevT += 1;
      artDraw(pctx, floatPrev.width, floatPrev.height, prevSeed, prevT);
      prevRaf = requestAnimationFrame(animPrev);
    }
    modulesList.addEventListener("pointermove", (e) => { fxT = e.clientX + 40; fyT = e.clientY; });
    document.querySelectorAll(".module").forEach((mod) => {
      mod.addEventListener("pointerenter", () => {
        prevSeed = parseInt(mod.dataset.seed || "1", 10);
        floatPrev.classList.add("is-on");
        cancelAnimationFrame(prevRaf);
        if (!prefersReduced) animPrev();
        else artDraw(pctx, floatPrev.width, floatPrev.height, prevSeed, 0);
      });
    });
    modulesList.addEventListener("pointerleave", () => {
      floatPrev.classList.remove("is-on");
      cancelAnimationFrame(prevRaf);
    });
  }

  /* ---------- 13. PARALLAX + NAV ---------- */
  const heroMedia = document.querySelector("[data-heroparallax]");
  const nav = document.querySelector(".nav");
  let navHidden = false;

  function updateParallax() {
    const y = window.scrollY;
    const vh = window.innerHeight;
    if (heroMedia && y < vh * 1.2) {
      heroMedia.style.transform = `translateY(${y * 0.22}px) scale(${1 + y / vh * 0.06})`;
    }
    for (const piece of pieces) {
      const speed = parseFloat(piece.dataset.speed || "0");
      const rect = piece.getBoundingClientRect();
      const rel = rect.top + rect.height / 2 - vh / 2;
      piece.style.transform = `translateY(${(-rel * speed).toFixed(1)}px)`;
    }
    // nav: hide going down, show going up
    if (nav) {
      const goingDown = scrollVel > 1.5 && y > 300;
      const goingUp = scrollVel < -1.5 || y <= 300;
      if (goingDown && !navHidden) { nav.style.transform = "translateY(-100%)"; navHidden = true; }
      else if (goingUp && navHidden) { nav.style.transform = ""; navHidden = false; }
    }
  }

  /* ---------- MAIN LOOP ---------- */
  function onFrame() {
    if (smooth.on) {
      smooth.target = clamp(smooth.target, 0, maxScroll());
      smooth.current = lerp(smooth.current, smooth.target, 0.09);
      if (Math.abs(smooth.current - smooth.target) < 0.3) smooth.current = smooth.target;
      if (Math.round(smooth.current) !== window.scrollY) {
        window.scrollTo(0, Math.round(smooth.current));
      }
    }
    const y = window.scrollY;
    scrollVel = lerp(scrollVel, y - lastScrollY, 0.14);
    lastScrollY = y;

    if (!prefersReduced) {
      updateSplits();
      updateTracks();
      updateParallax();
    }
    updateFills();
    updateWords();
    updateTicker();
    requestAnimationFrame(onFrame);
  }
  requestAnimationFrame(onFrame);

  /* ---------- FOOTER WORDMARK (per letter) ---------- */
  document.querySelectorAll("[data-wave]").forEach((el) => splitChars(el));

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
    ".section__label, .section__title, .manifest__stats, .module, .piece, .pack, .tool, .faq__item, .precta__link"
  );
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    }),
    { threshold: 0.1 }
  );
  revealTargets.forEach((el) => { el.classList.add("reveal"); io.observe(el); });

  /* ---------- FIT AFTER FONTS ---------- */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitLines);
  }
  fitLines();
  window.addEventListener("resize", fitLines);
})();
