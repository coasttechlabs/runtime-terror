import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const PUBLIC_LINKS = [
  { href: "./index.html", label: "Home" },
  { href: "./index.html#docs", label: "Docs" },
  { href: "./index.html#leaderboard", label: "Leaderboard" }
];

const PRIVATE_LINKS = [
  { href: "./game-search.html", label: "Game" },
  { href: "./profile-settings.html", label: "Profile" }
];

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

  const adminLikeRoles = new Set(["admin", "superadmin", "owner", "co-owner", "coowner"]);
  const normalizeRole = (role) => String(role).trim().toLowerCase().replace(/[_\s]+/g, "-");

  if (typeof claims.role === "string" && adminLikeRoles.has(normalizeRole(claims.role))) {
    return true;
  }

  if (Array.isArray(claims.roles)) {
    const normalized = claims.roles.map((role) => normalizeRole(role));
    if (normalized.some((role) => adminLikeRoles.has(role))) {
      return true;
    }
  }

  return false;
}

async function getLinksForUser(user) {
  const links = [...PUBLIC_LINKS];
  if (user) {
    links.push(...PRIVATE_LINKS);

    try {
      const tokenResult = await user.getIdTokenResult();
      if (isAdminClaims(tokenResult.claims)) {
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
