import { auth, db } from "./firebase.js";
import { getApiBase } from "./api-base.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const PUBLIC_LINKS = [
  { href: "./index.html", label: "Home" },
  { href: "./index.html#docs", label: "Docs" },
  { href: "./index.html#leaderboard", label: "Leaderboard" }
];

const PRIVATE_LINKS = [
  { href: "./game.html", label: "Game" },
  { href: "./profile-settings.html", label: "Profile" }
];
const API_BASE = getApiBase();
const USERS_COLLECTION = "users";
const ADMIN_LIKE_ROLES = new Set(["admin", "superadmin", "owner", "co-owner", "coowner"]);

function normalizeRole(role) {
  return String(role).trim().toLowerCase().replace(/[_\s]+/g, "-");
}

function getNavElement() {
  return document.querySelector("header nav, .site-header nav, .site-header .nav, nav.nav");
}

function makeLink({ href, label }) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.textContent = label;
  return anchor;
}

function makeLogoutLink() {
  const anchor = document.createElement("a");
  anchor.href = "#";
  anchor.textContent = "Logout";
  anchor.dataset.action = "logout";
  return anchor;
}

function isAdminClaims(claims) {
  if (!claims || typeof claims !== "object") return false;
  if (claims.admin === true) return true;

  if (typeof claims.role === "string" && ADMIN_LIKE_ROLES.has(normalizeRole(claims.role))) {
    return true;
  }

  if (Array.isArray(claims.roles)) {
    const normalized = claims.roles.map((role) => normalizeRole(role));
    if (normalized.some((role) => ADMIN_LIKE_ROLES.has(role))) {
      return true;
    }
  }

  if (typeof claims.rank === "string" && ADMIN_LIKE_ROLES.has(normalizeRole(claims.rank))) {
    return true;
  }

  if (Array.isArray(claims.ranks)) {
    const normalized = claims.ranks.map((role) => normalizeRole(role));
    if (normalized.some((role) => ADMIN_LIKE_ROLES.has(role))) {
      return true;
    }
  }

  return false;
}

function isAdminProfile(profile) {
  if (!profile || typeof profile !== "object") return false;
  const role = typeof profile.role === "string" ? normalizeRole(profile.role) : "";
  const rank = typeof profile.rank === "string" ? normalizeRole(profile.rank) : "";
  return ADMIN_LIKE_ROLES.has(role) || ADMIN_LIKE_ROLES.has(rank);
}

async function isAdminUser(user) {
  const tokenResult = await user.getIdTokenResult(true);
  if (isAdminClaims(tokenResult.claims)) {
    return true;
  }

  try {
    const token = await user.getIdToken();
    const response = await fetch(`${API_BASE}/profile/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.ok) {
      let payload = null;
      try {
        payload = await response.json();
      } catch (_error) {
        payload = null;
      }
      if (isAdminProfile(payload?.profile)) {
        return true;
      }
    }
  } catch (_error) {
    // Fall through to Firestore check.
  }

  try {
    const snapshot = await getDoc(doc(db, USERS_COLLECTION, user.uid));
    if (snapshot.exists() && isAdminProfile(snapshot.data())) {
      return true;
    }
  } catch (_error) {
    // Ignore read issues and return false below.
  }

  return false;
}

async function getLinksForUser(user) {
  const links = [...PUBLIC_LINKS];
  if (user) {
    links.push(...PRIVATE_LINKS);

    try {
      if (await isAdminUser(user)) {
        links.push({ href: "./admin-panel.html", label: "Admin" });
      }
    } catch (error) {
      console.error("Failed to inspect auth claims for nav:", error);
    }

    links.push({ href: "#", label: "Logout", action: "logout" });
  } else {
    links.push({ href: "./login.html", label: "Login" }, { href: "./signup.html", label: "Sign Up" });
  }
  return links;
}

function linksSignature(links) {
  return links.map((link) => `${link.label}|${link.href}|${link.action || ""}`).join("::");
}

function renderNav(nav, links) {
  nav.replaceChildren();
  links.forEach((link) => {
    if (link.action === "logout") {
      nav.appendChild(makeLogoutLink());
      return;
    }
    nav.appendChild(makeLink(link));
  });
}

function wireLogout(nav) {
  nav.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.dataset.action !== "logout") return;

    event.preventDefault();
    try {
      await signOut(auth);
      window.location.href = "./login.html";
    } catch (error) {
      console.error("Logout failed:", error);
      alert(error?.message || "Failed to log out.");
    }
  });
}

const nav = getNavElement();
if (nav) {
  wireLogout(nav);
  let lastRenderedSignature = null;

  onAuthStateChanged(auth, async (user) => {
    const links = await getLinksForUser(user);
    const nextSignature = linksSignature(links);
    if (nextSignature === lastRenderedSignature) return;

    renderNav(nav, links);
    lastRenderedSignature = nextSignature;
  });
}
