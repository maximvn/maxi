/* Sign-in / sign-up page logic (demo auth via js/auth.js). */
(() => {
  "use strict";
  const auth = window.wamAuth;
  const params = auth.params();

  // Already signed in? Straight to the course.
  if (auth.currentUser() && params.get("mode") !== "signup") {
    window.wamGo("app.html");
    return;
  }

  const tabSignin = document.getElementById("tabSignin");
  const tabSignup = document.getElementById("tabSignup");
  const formSignin = document.getElementById("formSignin");
  const formSignup = document.getElementById("formSignup");
  const title = document.querySelector(".authpage__title");

  function show(mode) {
    const signup = mode === "signup";
    tabSignin.classList.toggle("is-active", !signup);
    tabSignup.classList.toggle("is-active", signup);
    formSignin.hidden = signup;
    formSignup.hidden = !signup;
    title.innerHTML = signup ? "Start<br><em>creating.</em>" : "Welcome<br><em>back.</em>";
  }
  tabSignin.addEventListener("click", () => show("signin"));
  tabSignup.addEventListener("click", () => show("signup"));

  if (params.get("mode") === "signup") show("signup");
  const plan = params.get("plan");
  if (plan && ["starter", "pro", "studio"].includes(plan)) {
    document.getElementById("suPlan").value = plan;
    show("signup");
  }

  formSignin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("siError");
    err.textContent = "";
    try {
      await auth.signIn({
        email: document.getElementById("siEmail").value,
        password: document.getElementById("siPassword").value,
      });
      window.wamGo("app.html");
    } catch (ex) {
      err.textContent = ex.message;
    }
  });

  formSignup.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("suError");
    err.textContent = "";
    try {
      await auth.register({
        name: document.getElementById("suName").value,
        email: document.getElementById("suEmail").value,
        password: document.getElementById("suPassword").value,
        plan: document.getElementById("suPlan").value,
      });
      window.wamGo("app.html");
    } catch (ex) {
      err.textContent = ex.message;
    }
  });

  // Side panel: a slow ink drawing (same generator family as the site).
  const canvas = document.getElementById("authCanvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    const cs = getComputedStyle(document.documentElement);
    const paint = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      const W = canvas.width, H = canvas.height;
      if (!W || !H) return;
      ctx.fillStyle = cs.getPropertyValue("--bg-soft").trim();
      ctx.fillRect(0, 0, W, H);
      const ink = cs.getPropertyValue("--ink").trim();
      const red = cs.getPropertyValue("--red").trim();
      const rings = 30;
      const cx = W * 0.55, cy = H * 0.42;
      for (let i = 1; i <= rings; i++) {
        const r = (i / rings) * Math.max(W, H) * 0.62;
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.06) {
          const rr = r + Math.sin(a * 5 + i * 0.6) * (6 + i * 0.8);
          const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
          a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = i === 12 ? red : ink;
        ctx.globalAlpha = i === 12 ? 0.9 : i % 3 === 0 ? 0.5 : 0.16;
        ctx.lineWidth = i === 12 ? 2 : 0.8;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    paint();
    window.addEventListener("resize", paint);
    window.addEventListener("themechange", () => requestAnimationFrame(paint));
  }
})();
