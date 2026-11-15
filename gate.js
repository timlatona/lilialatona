// Sign-in gate and access settings shared by every page on lilialatona.com.
//
// Who can see what lives in Firebase at access/people/<email with dots as commas>:
//   { admin: false, wishlist: true, trivia: true }
// Tim and Lilia (OWNERS) always have everything and are the only ones who can grant admin.
// Admins can add/remove people and change their sections, but not other admins.
//
// TO ADD A NEW PART OF THE SITE: add it to SECTIONS below, make its page call
// gate('<key>', ...), and give it a rule in firebase/database.rules.json if it stores data.
// The admin table on the home page picks up the new column automatically.
//
// Note: this hides pages from people without access; the page files themselves are public
// on GitHub Pages. Data in Firebase (like the wishlist) is protected by the database rules.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut }
  from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getDatabase, ref, query, limitToFirst, get }
  from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js';

// Public web config (same as the wishlist).
const app = initializeApp({
  apiKey: 'AIzaSyDb6TIqn7Z8h9vnzL5helNfAD6GfZ5TDDs',
  authDomain: 'buzr-71cd8.firebaseapp.com',
  databaseURL: 'https://buzr-71cd8-default-rtdb.firebaseio.com',
  projectId: 'buzr-71cd8',
  storageBucket: 'buzr-71cd8.firebasestorage.app',
  messagingSenderId: '977001661603',
  appId: '1:977001661603:web:1f33de82dac9f63516eb16',
});
const auth = getAuth(app);
export const db = getDatabase(app);

// Keep in sync with OWNERS in wishlist/index.html and firebase/database.rules.json.
export const OWNERS = ['lilialatona@gmail.com', 'latona@gmail.com'];

// The parts of the site that can be shared, in the order they appear.
export const SECTIONS = [
  { key: 'wishlist', label: 'Wishlist', icon: '🎁', href: '/wishlist/' },
  { key: 'trivia', label: 'Birthday Trivia', icon: '🎂', href: '/trivia/' },
];

export const encodeEmail = (e) => e.toLowerCase().replaceAll('.', ',');
export const decodeEmail = (k) => k.replaceAll(',', '.');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// What this signed-in person may see: { owner, admin, wishlist, trivia, ... }.
async function permsFor(user) {
  const email = (user.email || '').toLowerCase();
  const all = Object.fromEntries(SECTIONS.map((s) => [s.key, true]));
  if (OWNERS.includes(email) && user.emailVerified) return { ...all, owner: true, admin: true };
  try {
    const row = (await get(ref(db, `access/people/${encodeEmail(email)}`))).val();
    if (row) return { ...row, owner: false };
  } catch (e) { /* not readable: fall through */ }
  // People from the old wishlist-only list (access/emails) keep full access until an
  // owner opens the home page, which moves them into access/people.
  try {
    await get(query(ref(db, 'items'), limitToFirst(1)));
    return { ...all, owner: false, admin: false };
  } catch (e) {
    return { owner: false, admin: false };
  }
}

const css = `
#gate { position:fixed; inset:0; z-index:1000; background:#1b0f3a; color:#fff; display:flex;
  align-items:center; justify-content:center; padding:24px 16px;
  font-family:system-ui,-apple-system,"Segoe UI",sans-serif; text-align:center; }
#gate .card { max-width:380px; width:100%; }
#gate h1 { color:#ffd166; font-size:clamp(1.8rem,7vw,2.6rem); margin:0 0 12px; }
#gate p { opacity:.85; line-height:1.45; margin:0 0 20px; }
#gate button, #gate a.btn { display:inline-block; font:inherit; font-size:1.05rem; font-weight:700; padding:12px 22px;
  border-radius:10px; border:0; cursor:pointer; background:#ffd166; color:#1b0f3a; text-decoration:none; }
#gate button.ghost { background:transparent; color:#fff; border:1px solid #fff6; margin-top:10px; }
#gate .err { color:#ffb4b4; font-size:.95rem; margin-top:14px; min-height:1.2em; }
html.locked body > *:not(#gate) { visibility:hidden; }
`;

function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }

/**
 * Hides the page until someone allowed in signs in.
 * section: a SECTIONS key the page needs (e.g. 'trivia'), or null for "any access" (home page).
 * onAllowed(me) runs once; me = { email, name, owner, admin, <section>: true/false, ... }.
 */
export function gate(section, onAllowed) {
  document.head.appendChild(el(`<style>${css}</style>`));
  document.documentElement.classList.add('locked');
  const box = el('<div id="gate"><div class="card"></div></div>');
  document.body.appendChild(box);
  const card = box.firstChild;
  const set = (html) => { card.innerHTML = html; };
  const otherAccount = () => {
    card.insertAdjacentHTML('beforeend', '<br><button class="ghost" id="gateOut">Use a different account</button>');
    card.querySelector('#gateOut').onclick = () => signOut(auth);
  };

  set('<p>Loading…</p>');
  let shown = false;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      set(`<h1>Lilia Latona</h1><p>This site is just for family and friends. Sign in with the Google account Lilia shared it with.</p>
        <button id="gateIn">Sign in with Google</button><div class="err" id="gateErr"></div>`);
      card.querySelector('#gateIn').onclick = signInClick;
      return;
    }
    const email = (user.email || '').toLowerCase();
    set('<p>Checking access…</p>');
    const p = await permsFor(user);
    const any = p.admin || SECTIONS.some((s) => p[s.key]);
    if (!any) {
      set(`<h1>No access yet</h1><p><b>${esc(email)}</b> isn't on the list. Ask Lilia or Tim to add this email, or try a different account.</p>`);
      return otherAccount();
    }
    if (section && !p[section]) {
      const name = (SECTIONS.find((s) => s.key === section) || { label: 'This page' }).label;
      set(`<h1>Not shared with you</h1><p><b>${esc(name)}</b> isn't shared with <b>${esc(email)}</b>.</p><a class="btn" href="/">Go to the home page</a>`);
      return otherAccount();
    }
    box.remove();
    document.documentElement.classList.remove('locked');
    if (!shown) {
      shown = true;
      onAllowed({ ...p, email, name: (user.displayName || email).split(' ')[0] });
    }
  });
}

async function signInClick() {
  const err = document.getElementById('gateErr');
  err.textContent = '';
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    if (e.code === 'auth/cancelled-popup-request' || e.code === 'auth/popup-closed-by-user') return;
    err.textContent = e.code === 'auth/popup-blocked'
      ? 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.'
      : e.code === 'auth/unauthorized-domain'
      ? `Sign-in isn't switched on for ${location.hostname} yet (Firebase → Authentication → Settings → Authorized domains).`
      : `Sign-in didn't work (${e.code || e.message}). Try again?`;
  }
}

export function signOutAndReload() { signOut(auth).then(() => location.reload()); }
