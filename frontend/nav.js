import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const STATIC_LINKS = [
  { href: "./index.html", label: "Home" },
  { href: "./index.html#docs", label: "Docs" },
  { href: "./index.html#leaderboard", label: "Leaderboard" },
  { href: "./game-search.html", label: "Game" },
  { href: "./profile-settings.html", label: "Profile" },
  { href: "./admin-panel.html", label: "Admin" }
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

function renderNav(nav, user) {
  nav.innerHTML = "";

  STATIC_LINKS.forEach((link) => {
    nav.appendChild(makeLink(link));
  });

  if (user) {
    nav.appendChild(makeLogoutLink());
    return;
  }

  nav.appendChild(makeLink({ href: "./login.html", label: "Login" }));
  nav.appendChild(makeLink({ href: "./signup.html", label: "Sign Up" }));
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
  renderNav(nav, auth.currentUser);
  wireLogout(nav);
  onAuthStateChanged(auth, (user) => {
    renderNav(nav, user);
  });
}
