// Sign-in gate shared by the home page and the trivia page.
// It uses the wishlist's Firebase project and its access list: whoever can read the
// wishlist items (owners + emails added in the wishlist's access panel) gets in.
// Note: this hides the page from casual visitors; the files themselves are still public
// on GitHub Pages. The wishlist data is protected by the Firebase database rules.
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
const db = getDatabase(app);

// Keep in sync with OWNERS in wishlist/index.html.
export const OWNERS = ['lilialatona@gmail.com', 'latona@gmail.com'];

const css = `
#gate { position:fixed; inset:0; z-index:1000; background:#1b0f3a; color:#fff; display:flex;
  align-items:center; justify-content:center; padding:24px 16px;
  font-family:system-ui,-apple-system,"Segoe UI",sans-serif; text-align:center; }
#gate .card { max-width:380px; width:100%; }
#gate h1 { color:#ffd166; font-size:clamp(1.8rem,7vw,2.6rem); margin:0 0 12px; }
#gate p { opacity:.85; line-height:1.45; margin:0 0 20px; }
#gate button { font:inherit; font-size:1.05rem; font-weight:700; padding:12px 22px; border-radius:10px;
  border:0; cursor:pointer; background:#ffd166; color:#1b0f3a; }
#gate button.ghost { background:transparent; color:#fff; border:1px solid #fff6; margin-top:10px; }
#gate .err { color:#ffb4b4; font-size:.95rem; margin-top:14px; min-height:1.2em; }
html.locked body > *:not(#gate) { visibility:hidden; }
`;

function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }

/**
 * Hides the page until someone with wishlist access signs in.
 * onAllowed(user) runs once they're in; user has { email, name, owner }.
 */
export function gate(onAllowed) {
  document.head.appendChild(el(`<style>${css}</style>`));
  document.documentElement.classList.add('locked');
  const box = el('<div id="gate"><div class="card"></div></div>');
  document.body.appendChild(box);
  const card = box.firstChild;
  const set = (html) => { card.innerHTML = html; };

  set('<p>Loading…</p>');
  let shown = false;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      set(`<h1>Lilia Latona</h1><p>This page is just for family and friends. Sign in with the Google account that has access to Lilia's wishlist.</p>
        <button id="gateIn">Sign in with Google</button><div class="err" id="gateErr"></div>`);
      card.querySelector('#gateIn').onclick = signInClick;
      return;
    }
    const email = (user.email || '').toLowerCase();
    set('<p>Checking access…</p>');
    let allowed = false;
    try {
      await get(query(ref(db, 'items'), limitToFirst(1)));
      allowed = true;
    } catch (e) {
      allowed = false;
    }
    if (!allowed) {
      set(`<h1>No access yet</h1><p><b>${email.replace(/</g, '&lt;')}</b> isn't on the list. Ask Lilia or her dad to add this email, or try a different account.</p>
        <button id="gateOut">Use a different account</button>`);
      card.querySelector('#gateOut').onclick = () => signOut(auth);
      return;
    }
    box.remove();
    document.documentElement.classList.remove('locked');
    if (!shown) {
      shown = true;
      onAllowed({ email, name: (user.displayName || email).split(' ')[0], owner: OWNERS.includes(email) });
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
