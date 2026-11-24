import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy,
         runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = id => document.getElementById(id);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const gifts = collection(db, "gifts");

const PEOPLE = { thibaut: "Thibaut", sara: "Sara", sohan: "Sohan" };
let current = PEOPLE[location.hash.slice(1)] ? location.hash.slice(1) : "thibaut";
let isAdmin = false, items = [], editingId = null, pendingImageData = null;

const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; } };
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); kids.forEach(k => e.append(k)); return e; };

// ---------- Rendu ----------
const ownerOf = g => PEOPLE[g.owner] ? g.owner : "thibaut"; // anciens cadeaux sans champ owner
function renderTabs() {
  $("tabs").replaceChildren(...Object.entries(PEOPLE).map(([k, n]) => {
    const b = el("button", { className: "tab" + (k === current ? " active" : ""), textContent: `${n} (${items.filter(g => ownerOf(g) === k).length})` });
    b.onclick = () => { current = k; location.hash = k; render(); };
    return b;
  }));
  document.title = "Liste de Noël de " + PEOPLE[current];
}
function render() {
  renderTabs();
  const grid = $("grid"); grid.replaceChildren();
  const shown = items.filter(g => ownerOf(g) === current);
  $("status").textContent = shown.length ? "" : "Aucun cadeau pour l'instant.";
  for (const g of shown) {
    const img = el("div", { className: "img" + (g.imageIsData ? "" : " cover") });
    const src = g.image && (g.image.startsWith("data:image/") ? g.image : safeUrl(g.image));
    if (src) img.style.backgroundImage = `url("${src}")`;
    if (g.takenBy) img.append(el("span", { className: "badge", textContent: "Pris par " + g.takenBy }));

    const actions = el("div", { className: "actions" });
    if (g.takenBy) {
      actions.append(btn("Annuler", () => release(g), "small"));
    } else {
      actions.append(btn("🎁 Je l'offre", () => openTake(g), "primary"));
    }
    if (isAdmin) {
      actions.append(btn("Modifier", () => openGift(g), "small"), btn("Supprimer", () => remove(g), "small"));
    }
    const link = safeUrl(g.url);
    const body = el("div", { className: "body" },
      el("h3", { textContent: g.title }),
      g.price ? el("div", { className: "price", textContent: g.price }) : "",
      g.note ? el("div", { className: "note", textContent: g.note }) : "",
      link ? el("a", { className: "link", href: link, target: "_blank", rel: "noopener noreferrer", textContent: "Voir le produit ↗" }) : "",
      actions);
    grid.append(el("div", { className: "card" + (g.takenBy ? " taken" : "") }, img, body));
  }
}
function btn(text, fn, cls = "") { const b = el("button", { className: "btn " + cls, textContent: text, type: "button" }); b.onclick = fn; return b; }

onSnapshot(query(gifts, orderBy("createdAt", "asc")),
  s => { items = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); },
  e => { $("status").textContent = "Erreur de chargement : " + e.message; });

// ---------- Réserver / libérer ----------
let takingId = null;
function openTake(g) {
  takingId = g.id; $("takeTitle").textContent = g.title;
  $("takeName").value = localStorage.getItem("giftName") || "";
  $("takeDlg").showModal();
}
$("takeForm").onsubmit = async () => {
  const name = $("takeName").value.trim(); if (!name) return;
  localStorage.setItem("giftName", name);
  const ref = doc(db, "gifts", takingId);
  try {
    await runTransaction(db, async tx => {
      const s = await tx.get(ref);
      if (s.data().takenBy) throw new Error("taken");
      tx.update(ref, { takenBy: name, takenAt: serverTimestamp() });
    });
  } catch (e) {
    alert(e.message === "taken" ? "Oups, quelqu'un vient de prendre ce cadeau !" : "Erreur : " + e.message);
  }
};
async function release(g) {
  if (!confirm(`Libérer ce cadeau (actuellement pris par ${g.takenBy}) ?`)) return;
  try { await updateDoc(doc(db, "gifts", g.id), { takenBy: null, takenAt: null }); }
  catch (e) { alert("Erreur : " + e.message); }
}

// ---------- Admin : connexion ----------
$("adminLink").onclick = e => { e.preventDefault(); isAdmin ? null : $("loginDlg").showModal(); };
$("loginForm").onsubmit = async () => {
  $("loginErr").textContent = "";
  try { await signInWithEmailAndPassword(auth, $("loginEmail").value, $("loginPwd").value); $("loginPwd").value = ""; }
  catch { $("loginErr").textContent = "Identifiants invalides"; $("loginDlg").showModal(); }
};
$("logoutBtn").onclick = () => signOut(auth);
onAuthStateChanged(auth, u => { isAdmin = !!u; $("adminBar").hidden = !isAdmin; render(); });

// ---------- Admin : ajout / édition ----------
$("gOwner").replaceChildren(...Object.entries(PEOPLE).map(([k, n]) => el("option", { value: k, textContent: n })));
$("addBtn").onclick = () => openGift(null);
function openGift(g) {
  editingId = g?.id || null; pendingImageData = null;
  $("giftDlgTitle").textContent = g ? "Modifier le cadeau" : "Ajouter un cadeau";
  $("gOwner").value = g ? ownerOf(g) : current;
  $("gUrl").value = g?.url || ""; $("gTitle").value = g?.title || ""; $("gPrice").value = g?.price || "";
  $("gNote").value = g?.note || ""; $("gImage").value = g && !g.imageIsData ? (g.image || "") : "";
  $("gFile").value = ""; $("fetchMsg").textContent = "";
  preview(g?.image || "");
  $("giftDlg").showModal();
}
function preview(src) { const p = $("gPreview"); p.hidden = !src; if (src) p.src = src; }
$("gImage").oninput = () => { pendingImageData = null; preview(safeUrl($("gImage").value)); };

// Récupération auto titre/photo via microlink.io (gratuit, best-effort : certains sites bloquent)
$("fetchBtn").onclick = async () => {
  const url = safeUrl($("gUrl").value); if (!url) { $("fetchMsg").textContent = "Colle d'abord un lien valide."; return; }
  $("fetchMsg").textContent = "Recherche…";
  try {
    const r = await (await fetch("https://api.microlink.io/?url=" + encodeURIComponent(url))).json();
    if (r.status !== "success") throw 0;
    const d = r.data;
    if (d.title && !$("gTitle").value) $("gTitle").value = d.title.slice(0, 140);
    if (d.image?.url) { $("gImage").value = d.image.url; pendingImageData = null; preview(d.image.url); }
    $("fetchMsg").textContent = d.image?.url ? "Titre et photo récupérés (vérifie-les)." : "Titre récupéré, pas de photo : ajoute-la à la main.";
  } catch { $("fetchMsg").textContent = "Impossible de lire cette page : remplis à la main (photo : URL ou fichier)."; }
};

// Photo depuis l'appareil : redimensionnée (max 700 px, JPEG) et stockée dans le document
$("gFile").onchange = async () => {
  const f = $("gFile").files[0]; if (!f) return;
  const bmp = await createImageBitmap(f);
  const k = Math.min(1, 700 / Math.max(bmp.width, bmp.height));
  const c = el("canvas", { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  pendingImageData = c.toDataURL("image/jpeg", 0.8);
  $("gImage").value = ""; preview(pendingImageData);
};

$("giftForm").onsubmit = async () => {
  const image = pendingImageData || safeUrl($("gImage").value) || (editingId ? items.find(i => i.id === editingId)?.image || "" : "");
  const data = {
    owner: $("gOwner").value,
    url: safeUrl($("gUrl").value), title: $("gTitle").value.trim(), price: $("gPrice").value.trim(),
    note: $("gNote").value.trim(), image, imageIsData: image.startsWith("data:image/")
  };
  try {
    if (editingId) await updateDoc(doc(db, "gifts", editingId), data);
    else await addDoc(gifts, { ...data, takenBy: null, takenAt: null, createdAt: serverTimestamp() });
  } catch (e) { alert("Erreur d'enregistrement : " + e.message); }
};
async function remove(g) {
  if (!confirm(`Supprimer « ${g.title} » ?`)) return;
  try { await deleteDoc(doc(db, "gifts", g.id)); } catch (e) { alert("Erreur : " + e.message); }
}

document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => b.closest("dialog").close());
