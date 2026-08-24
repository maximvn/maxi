/* ============================================================
   WE ARE MADE — client-side demo auth
   Accounts live in this browser's localStorage; passwords are
   stored as salted SHA-256 hashes. This is a front-end prototype:
   swap it for a real backend (e.g. Supabase/Auth0 + Stripe)
   before taking real customers.
   ============================================================ */
(() => {
  "use strict";
  // Page navigation goes through wamGo so the single-file preview build
  // can reroute it; on the hosted site it is a plain redirect.
  if (!window.wamGo) window.wamGo = (url) => { location.href = url; };
  const USERS_KEY = "wam_users";
  const SESSION_KEY = "wam_session";

  const store = {
    users() {
      try { return JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); }
      catch (e) { return {}; }
    },
    saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); },
  };

  async function hash(text, salt) {
    const data = new TextEncoder().encode(`${salt}::${text}`);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  window.wamAuth = {
    // In the hosted site these come from the URL; the preview build
    // stores them in sessionStorage instead.
    params() {
      const qs = location.search || sessionStorage.getItem("wam_qs") || "";
      return new URLSearchParams(qs);
    },
    hashTarget() {
      return location.hash || sessionStorage.getItem("wam_hash") || "";
    },

    currentEmail() {
      try { return localStorage.getItem(SESSION_KEY); } catch (e) { return null; }
    },
    currentUser() {
      const email = this.currentEmail();
      if (!email) return null;
      const u = store.users()[email];
      return u ? { email, ...u } : null;
    },

    async register({ name, email, password, plan }) {
      email = String(email || "").trim().toLowerCase();
      name = String(name || "").trim();
      if (!name) throw new Error("Please tell us your name.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("That email address doesn't look right.");
      if (!password || password.length < 6) throw new Error("Choose a password of at least 6 characters.");
      const users = store.users();
      if (users[email]) throw new Error("There is already an account for this email — sign in instead.");
      const salt = crypto.getRandomValues(new Uint32Array(4)).join("-");
      users[email] = {
        name,
        salt,
        hash: await hash(password, salt),
        plan: plan || "starter",
        progress: {},
        created: new Date().toISOString(),
      };
      store.saveUsers(users);
      localStorage.setItem(SESSION_KEY, email);
      return users[email];
    },

    async signIn({ email, password }) {
      email = String(email || "").trim().toLowerCase();
      const user = store.users()[email];
      if (!user) throw new Error("No account found for this email.");
      if (await hash(password, user.salt) !== user.hash) throw new Error("That password is not correct.");
      localStorage.setItem(SESSION_KEY, email);
      return user;
    },

    signOut() { localStorage.removeItem(SESSION_KEY); },

    update(fields) {
      const email = this.currentEmail();
      if (!email) return;
      const users = store.users();
      if (!users[email]) return;
      Object.assign(users[email], fields);
      store.saveUsers(users);
    },

    setProgress(moduleId, lessonIndex, done) {
      const user = this.currentUser();
      if (!user) return;
      const progress = user.progress || {};
      const set = new Set(progress[moduleId] || []);
      done ? set.add(lessonIndex) : set.delete(lessonIndex);
      progress[moduleId] = [...set];
      this.update({ progress });
    },
  };

  // Landing nav: swap "Sign in" for "My course" when a session exists.
  document.addEventListener("DOMContentLoaded", () => {
    const slot = document.querySelector("[data-authlink]");
    if (slot && window.wamAuth.currentUser()) {
      slot.textContent = "My course";
      slot.setAttribute("href", "app.html");
    }
  });
})();
