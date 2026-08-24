/* ============================================================
   WE ARE MADE — course dashboard
   Modules, lessons, progress and tools. Requires a session
   (js/auth.js); redirects to login.html otherwise.
   ============================================================ */
(() => {
  "use strict";
  const auth = window.wamAuth;
  let user = auth.currentUser();
  if (!user) {
    window.wamGo("login.html");
    return;
  }

  /* ---------- COURSE CONTENT ---------- */
  const PLANS = {
    starter: { label: "Starter", modules: ["m01", "m02"] },
    pro: { label: "Pro", modules: ["m01", "m02", "m03", "m04", "m05", "m06"] },
    studio: { label: "Studio", modules: ["m01", "m02", "m03", "m04", "m05", "m06"] },
  };

  const MODULES = [
    {
      id: "m01", index: "M–01", title: "Foundations",
      lessons: [
        { t: "How image models see", p: "An image model doesn't read your prompt like a person — it maps words to visual patterns it has learned. In this lesson you learn to think in those patterns: subjects, materials, moods and references, not full sentences.", ex: "Take one boring prompt ('a house') and rewrite it five times, changing only the pattern words: material, era, weather, lens, mood." },
        { t: "Prompt anatomy", p: "A strong prompt has a skeleton: subject → context → light → lens → mood → style. Order matters less than completeness — the model fills every gap you leave with an average, and averages are boring.", ex: "Write a prompt using all six slots for the same subject. Remove one slot at a time and compare what the model invents in its place." },
        { t: "Light and lens", p: "Photographers control two things above all: where the light comes from and what glass they shoot through. Naming both transforms AI output more than any style keyword — 'low winter sun, 85mm, wide open' beats a paragraph of adjectives.", ex: "Render one subject at three times of day with three focal lengths. Keep a note of which combinations feel like 'you'." },
        { t: "Composition rules that survive AI", p: "Rule of thirds, leading lines, negative space: models understand these terms surprisingly well. Use them as commands, not hopes — 'subject in lower-left third, empty sky above' is a composition brief.", ex: "Recreate a famous composition (not the image!) with a completely different subject." },
      ],
    },
    {
      id: "m02", index: "M–02", title: "A Style of Your Own",
      lessons: [
        { t: "From taste to language", p: "Your style already exists — in what you save, like and steal. This lesson turns a moodboard into a written visual language: five adjectives, three colour rules, two light rules and one thing you always refuse to do.", ex: "Build a 20-image moodboard, then extract your five/three/two/one. That paragraph is your style bible; every prompt will end with it." },
        { t: "Style references without theft", p: "Referencing living artists by name is a dead end — legally grey and creatively hollow. Instead, decompose what you admire into transferable qualities: palette, contrast, grain, era, printing technique.", ex: "Pick a work you love and describe it in ten words without naming its creator. Prompt with those words only." },
        { t: "Series thinking", p: "A single good image is luck; five that belong together is a style. Fix the constants (palette, light, framing) and vary one variable per image. That's the whole trick behind coherent feeds and campaigns.", ex: "Produce a series of five images where only the subject changes. Everything else stays fixed." },
        { t: "Consistency at scale", p: "Seeds, style-reference images and reusable prompt suffixes keep a look stable across dozens of outputs. You'll build a personal 'style suffix' that travels with every prompt you write.", ex: "Write your style suffix (max 40 words) and run it on ten unrelated subjects. Count how many feel like one author." },
      ],
    },
    {
      id: "m03", index: "M–03", title: "Images in Motion",
      lessons: [
        { t: "The still that wants to move", p: "Not every image is a video waiting to happen. Motion adds meaning when something changes: light, weather, a gesture. Learn to spot the one element in your still that earns the movement.", ex: "Choose three of your stills and write one sentence per image: what moves, how slowly, and why." },
        { t: "Motion prompts", p: "Video models want verbs and camera language: push in, orbit, handheld drift. Combine one camera move with one subject change per shot — stack more and it turns to soup.", ex: "Animate one still three ways: camera-only, subject-only, both. Compare which keeps your style intact." },
        { t: "Loops and social formats", p: "A perfect loop hides its seam: end where you began. Slow, small, seamless beats fast and flashy on every feed. We cover ratios, durations and safe areas for the platforms that matter.", ex: "Make a 4-second seamless loop from a still in your series." },
      ],
    },
    {
      id: "m04", index: "M–04", title: "Workflow & Automation",
      lessons: [
        { t: "Claude as your studio manager", p: "The craft is yours; the repetition is Claude's. You'll set up an assistant that writes prompt variations in your style, names files properly and keeps a log of what worked.", ex: "Give Claude your style bible from M-02 and ask for ten on-style prompt variations of one concept. Grade them: how many pass?" },
        { t: "The claude.md file", p: "A claude.md is your studio's memory: style rules, output formats, naming conventions and the mistakes never to repeat. Written once, it makes every future session start at full speed.", ex: "Draft your own claude.md with the template from the downloads. Test it on a fresh session — does it produce your look first try?" },
        { t: "Batch work and pipelines", p: "Series of fifty need process: a sheet of prompts in, a folder of selects out, and a review pass in between. You'll build a simple pipeline you can rerun for every new campaign.", ex: "Run one 10-image batch end to end: brief → prompts → generate → select best 3 → note why they won." },
      ],
    },
    {
      id: "m05", index: "M–05", title: "Upscale & Finish",
      lessons: [
        { t: "From draft to master", p: "Generation is sketching; finishing is craft. Learn the pass sequence — upscale, retouch, grade, grain — and why the order matters for print versus screen.", ex: "Take your favourite output through all four passes. Export a screen master and a print master." },
        { t: "Print without surprises", p: "Screens forgive; paper doesn't. Resolution targets, colour space and the dreaded dark-detail crush — a checklist that keeps your first print run from teaching you expensive lessons.", ex: "Prepare one image for A2 print. Write down every step, then order a proof." },
      ],
    },
    {
      id: "m06", index: "M–06", title: "Publish & Sell",
      lessons: [
        { t: "A portfolio that sells one thing", p: "Twenty styles impress no one; one style twenty times deep gets you hired. Curate ruthlessly: your weakest public image is your reputation.", ex: "Select exactly nine images for a portfolio grid. Every image that doesn't reinforce the style goes." },
        { t: "Clients, briefs and boundaries", p: "How to price AI-assisted work, what to promise (style, direction, finish) and what never to promise (a specific output). Includes a plain-language brief template.", ex: "Write a one-page offer for a service you could sell next month." },
        { t: "Rights and honesty", p: "Model terms, commercial licences and disclosure. Where the rules are settled, where they're moving, and why transparency about process is a selling point, not a confession.", ex: "Write the two sentences you'd use to explain your AI process to a client." },
      ],
    },
  ];

  /* ---------- STATE ---------- */
  const plan = PLANS[user.plan] || PLANS.starter;
  let currentModule = null;
  let currentLesson = 0;

  const listEl = document.getElementById("moduleList");
  const paneEl = document.getElementById("lessonPane");

  const unlocked = (id) => plan.modules.includes(id);
  const doneSet = (id) => new Set((user.progress || {})[id] || []);

  function totals() {
    let done = 0, all = 0;
    for (const m of MODULES) {
      if (!unlocked(m.id)) continue;
      all += m.lessons.length;
      done += [...doneSet(m.id)].filter((i) => i < m.lessons.length).length;
    }
    return { done, all };
  }

  /* ---------- HEADER ---------- */
  document.getElementById("appName").textContent = user.name.split(" ")[0];
  document.getElementById("planBadge").textContent = plan.label;
  function renderProgress() {
    const { done, all } = totals();
    const pct = all ? Math.round((done / all) * 100) : 0;
    document.getElementById("progressBar").style.width = `${pct}%`;
    document.getElementById("progressLabel").textContent = `${pct}% complete · ${done}/${all} lessons`;
  }

  /* ---------- MODULE LIST ---------- */
  function renderList() {
    listEl.innerHTML = "";
    for (const m of MODULES) {
      const isOpen = unlocked(m.id);
      const done = [...doneSet(m.id)].filter((i) => i < m.lessons.length).length;
      const btn = document.createElement("button");
      btn.className = "applist__item" + (isOpen ? "" : " is-locked") + (currentModule === m.id ? " is-active" : "");
      btn.setAttribute("data-hover", "");
      btn.innerHTML = `
        <span class="applist__index label">${m.index}</span>
        <span class="applist__title">${m.title}</span>
        <span class="applist__state label">${isOpen ? (done === m.lessons.length ? '<span class="done">Done ✓</span>' : `${done}/${m.lessons.length}`) : "Locked"}</span>`;
      if (isOpen) btn.addEventListener("click", () => openModule(m.id, 0));
      listEl.appendChild(btn);
    }
  }

  /* ---------- LESSON PANE ---------- */
  function openModule(id, lessonIndex) {
    currentModule = id;
    currentLesson = lessonIndex;
    history.replaceState(null, "", `#${id}`);
    renderList();
    renderLesson();
    paneEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function renderLesson() {
    const m = MODULES.find((x) => x.id === currentModule);
    if (!m) return renderWelcome();
    const done = doneSet(m.id);
    const l = m.lessons[currentLesson];
    const isDone = done.has(currentLesson);
    const last = currentLesson === m.lessons.length - 1;

    paneEl.innerHTML = `
      <p class="lesson__label label">${m.index} — ${m.title} · Lesson ${currentLesson + 1} of ${m.lessons.length}</p>
      <h2 class="lesson__title">${l.t}</h2>
      <div class="lesson__body">
        <p>${l.p}</p>
        <p class="lesson__exercise"><strong>Exercise:</strong> ${l.ex}</p>
        <p class="aside">Video lesson coming with the launch — the written lesson and exercise are complete.</p>
      </div>
      <div class="lesson__nav">
        <div class="lesson__steps">${m.lessons.map((_, i) =>
          `<button class="lesson__step${i === currentLesson ? " is-active" : ""}${done.has(i) ? " is-done" : ""}" data-step="${i}" data-hover>${i + 1}</button>`).join("")}
        </div>
        <button class="btn ${isDone ? "btn--line" : "btn--solid"}" id="markDone" data-hover data-magnet>
          ${isDone ? "Completed ✓ (undo)" : "Mark lesson complete"}
        </button>
        <button class="btn btn--line" id="nextLesson" data-hover data-magnet>${last ? "Next module →" : "Next lesson →"}</button>
      </div>`;

    paneEl.querySelectorAll("[data-step]").forEach((b) =>
      b.addEventListener("click", () => { currentLesson = +b.dataset.step; renderLesson(); }));

    paneEl.querySelector("#markDone").addEventListener("click", () => {
      auth.setProgress(m.id, currentLesson, !isDone);
      user = auth.currentUser();
      renderLesson(); renderList(); renderProgress();
    });

    paneEl.querySelector("#nextLesson").addEventListener("click", () => {
      if (!last) { currentLesson++; renderLesson(); return; }
      const order = MODULES.filter((x) => unlocked(x.id)).map((x) => x.id);
      const next = order[order.indexOf(m.id) + 1];
      if (next) openModule(next, 0);
      else renderWelcome(true);
    });
  }

  function renderWelcome(finished) {
    currentModule = null;
    renderList();
    const { done, all } = totals();
    const lockedCount = MODULES.filter((m) => !unlocked(m.id)).length;
    paneEl.innerHTML = `
      <p class="lesson__label label">( Overview )</p>
      <h2 class="lesson__title">${finished ? "That's every open module — well made." : "Pick a module to begin."}</h2>
      <div class="lesson__body">
        <p>${finished
          ? "You've reached the end of the modules in your package. Revisit any lesson, or go deeper with an upgrade."
          : `Your <em>${plan.label}</em> package gives you access to ${plan.modules.length} of ${MODULES.length} modules. Progress saves automatically — leave and pick up where you stopped.`}</p>
        ${lockedCount ? `<p class="aside">${lockedCount} modules are locked on your current package. <a href="index.html#packages" style="text-decoration: underline">Upgrade to Pro</a> to open them all.</p>` : ""}
      </div>
      <div class="lesson__nav">
        <button class="btn btn--solid" id="startFirst" data-hover data-magnet>${done ? "Continue where I left off" : "Start with M–01"}</button>
      </div>`;
    paneEl.querySelector("#startFirst").addEventListener("click", () => {
      for (const m of MODULES) {
        if (!unlocked(m.id)) continue;
        const dn = doneSet(m.id);
        for (let i = 0; i < m.lessons.length; i++) {
          if (!dn.has(i)) return openModule(m.id, i);
        }
      }
      openModule("m01", 0);
    });
  }

  /* ---------- CLAUDE.MD DOWNLOAD ---------- */
  document.getElementById("downloadMd").addEventListener("click", () => {
    const md = `# claude.md — We Are Made starter
# Personal visual workflow for ${user.name}

## Who I am
I make visuals with AI. Help me work like an art director:
concept first, style always, repetition automated.

## My style bible (fill this in during Module 02)
- Five adjectives: …
- Three colour rules: …
- Two light rules: …
- One thing I never do: …

## How to write prompts for me
- Use the skeleton: subject → context → light → lens → mood → style.
- Always append my style suffix (below) unless I say otherwise.
- Offer 3 variations max, each changing exactly one variable.

## My style suffix
"…"

## Output conventions
- File names: YYYYMMDD_project_subject_v01
- Keep a running log of prompts that worked in prompts-log.md

_Generated from the We Are Made course · wearemade.studio_
`;
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "claude.md";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  if ((user.plan || "starter") === "starter") {
    document.getElementById("assistantNote").innerHTML =
      "The Visual Assistant is part of <em>Pro</em> and <em>Studio</em>. <a href='index.html#packages' style='text-decoration: underline'>Upgrade</a> to add it to your package.";
  }

  /* ---------- SIGN OUT ---------- */
  document.getElementById("signOut").addEventListener("click", () => {
    auth.signOut();
    window.wamGo("index.html");
  });

  /* ---------- BOOT ---------- */
  renderProgress();
  const target = (auth.hashTarget() || "").replace("#", "");
  if (target === "tools") {
    renderWelcome();
    document.getElementById("tools").scrollIntoView();
  } else if (MODULES.some((m) => m.id === target) && unlocked(target)) {
    openModule(target, 0);
  } else if (MODULES.some((m) => m.id === target)) {
    renderWelcome(); // locked module: show overview with upgrade note
  } else {
    renderWelcome();
  }
})();
