/* =====================================================
   CodeCrew Club Events - script.js
   How the app works:
   1. DATA      -> events + registrations kept in memory and saved to localStorage
   2. HELPERS   -> small reusable functions (formatting, popups, toast)
   3. PAGES     -> home, events list, admin (each one builds HTML with JavaScript)
   4. FORMS     -> registration form validation, admin add/edit/delete
   5. ROUTER    -> shows the right page based on the URL after '#'
   ===================================================== */

// ---------- 1. SETTINGS & DATA ----------
// Categories shown in the filter dropdown and the admin form
const CATS = ["Technical", "Cultural", "Sports", "Workshop", "Social"];
// Demo admin password (a real app would check this on a server)
const ADMIN_PASS = "admin123";
// Shortcut: $('#id') instead of document.querySelector('#id')
const $ = (s) => document.querySelector(s);
// Makes user text safe before putting it in HTML (prevents script injection)
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
// Creates a random short id for each event / registration
const uid = () => Math.random().toString(36).slice(2, 9);

// ---- storage (localStorage with in-memory fallback) ----
// Backup copy in memory, used if localStorage is blocked
let mem = {};
// Read saved data by key; return default value if nothing saved
const load = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    if (v) return JSON.parse(v);
  } catch (e) {}
  return mem[k] ?? d;
};
// Save data to memory and to localStorage
const save = (k, v) => {
  mem[k] = v;
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {}
};

// Sample events shown the first time the site opens.
// d(n, h) builds a date n days from today at hour h.
function seed() {
  const d = (n, h) => {
    const t = new Date();
    t.setDate(t.getDate() + n);
    t.setHours(h, 0, 0, 0);
    const p = (x) => String(x).padStart(2, "0");
    return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T${p(h)}:00`;
  };
  return [
    {
      id: uid(),
      name: "HackNova 24-Hour Hackathon",
      date: d(9, 10),
      venue: "Main Auditorium",
      category: "Technical",
      featured: true,
      description:
        "Team up, build something bold, and pitch it to industry mentors. Prizes worth ₹50,000.",
    },
    {
      id: uid(),
      name: "Intro to Web Development",
      date: d(3, 15),
      venue: "Lab 204",
      category: "Workshop",
      featured: false,
      description:
        "Hands-on HTML, CSS and JavaScript session for beginners. Bring your laptop.",
    },
    {
      id: uid(),
      name: "Rangmanch Cultural Night",
      date: d(14, 18),
      venue: "Open Air Theatre",
      category: "Cultural",
      featured: false,
      description:
        "Music, dance and drama performances by students from all departments.",
    },
    {
      id: uid(),
      name: "Inter-Year Cricket Cup",
      date: d(6, 9),
      venue: "College Ground",
      category: "Sports",
      featured: false,
      description: "Knockout T10 tournament between first, second and final year teams.",
    },
    {
      id: uid(),
      name: "Freshers Meet & Greet",
      date: d(20, 16),
      venue: "Seminar Hall",
      category: "Social",
      featured: false,
      description:
        "Meet the club, play games and find out how to get involved this year.",
    },
  ];
}
// Load saved events (or create sample ones on first visit)
let events = load("ev", null);
if (!events) {
  events = seed();
  save("ev", events);
}
// Registrations: each has eventId, name, email, college, phone
let regs = load("rg", []);
// Is the admin logged in? (remembered between visits)
let admin = load("adm", false) === true;

// ---------- 2. HELPER FUNCTIONS ----------
// Turn a date string into a readable one, e.g. '12 Oct 2026, 10:00 am'
const fmt = (s) =>
  new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
// Only future events, sorted with the nearest date first
const upcoming = () =>
  events
    .filter((e) => new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date));
// Find an event's name from its id (used in the registrations table)
const evName = (id) =>
  (events.find((e) => e.id === id) || { name: "(deleted event)" }).name;

// Small green message at the bottom of the screen
function toast(m) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = m;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
// Close the popup
function closeModal() {
  $("#layer").innerHTML = "";
}
// Open a popup with any HTML inside it
function modal(html) {
  $("#layer").innerHTML =
    `<div class="modal" onclick="if(event.target===this)closeModal()"><div class="box">${html}</div></div>`;
}

// ---------- EVENT CARD ----------
// Emoji and colour for each category (used on the cards)
const CATEGORY_INFO = {
  Technical: ["💻", "#4f46e5"],
  Cultural: ["🎭", "#db2777"],
  Sports: ["🏏", "#16a34a"],
  Workshop: ["🛠️", "#ea580c"],
  Social: ["🎉", "#0891b2"],
};
// Get [emoji, colour] for a category, with a default if unknown
const getCategory = (c) => CATEGORY_INFO[c] || ["📌", "#4f46e5"];
// Number of days left until a date
const daysTo = (d) => Math.ceil((new Date(d) - new Date()) / 864e5);
// Returns the HTML of one event card (used on Home and Events pages)
const card = (e) => {
  const [i, c] = getCategory(e.category),
    n = daysTo(e.date);
  return `<div class="card ev" style="--c:${c}">
<div class="top"><div class="ico">${i}</div>${n >= 0 && n <= 7 ? `<span class="soon">🔥 ${n <= 1 ? "Very soon" : "In " + n + " days"}</span>` : ""}</div>
<span class="tag">${esc(e.category)}</span><h3>${esc(e.name)}</h3>
<div class="meta">📅 ${fmt(e.date)}</div><div class="meta">📍 ${esc(e.venue)}</div>
<p style="margin:4px 0 8px">${esc(e.description)}</p>
<button class="btn" onclick="openReg('${e.id}')">Register →</button></div>`;
};
// Holds the countdown timer so it can be stopped when leaving the page
let T;
// Animates the hero numbers from 0 up to their value
function countUp() {
  document.querySelectorAll("[data-n]").forEach((el) => {
    const n = +el.dataset.n;
    let k = 0;
    const t = setInterval(() => {
      k += Math.max(1, Math.ceil(n / 30));
      if (k >= n) {
        k = n;
        clearInterval(t);
      }
      el.textContent = k + (n > 99 ? "+" : "");
    }, 30);
  });
}
// Updates the featured-event countdown (called every second)
function tick() {
  const el = $("#cd");
  if (!el) return clearInterval(T);
  let ms = Math.max(0, new Date(el.dataset.t) - new Date()),
    p = (v, l) => `<div><b>${String(v).padStart(2, "0")}</b><span>${l}</span></div>`;
  el.innerHTML =
    p(Math.floor(ms / 864e5), "DAYS") +
    p(Math.floor(ms / 36e5) % 24, "HRS") +
    p(Math.floor(ms / 6e4) % 60, "MIN") +
    p(Math.floor(ms / 1e3) % 60, "SEC");
}

// ---------- 3. PAGES ----------
// HOME: hero, featured event, upcoming events, 'why join' section
function home() {
  const up = upcoming(),
    f = up.find((e) => e.featured) || up[0];
  $("#app").innerHTML =
    `<section class="hero"><span class="blob b1"></span><span class="blob b2"></span>
  <span class="fl f1">💻</span><span class="fl f2">🎭</span><span class="fl f3">🏏</span>
  <div class="pill">🎓 Registrations are open</div>
  <h1>Where campus <span class="grad">ideas</span> come alive</h1>
  <p>CodeCrew is the college community for builders, performers and players. Learn, compete, make friends and have fun, all year round.</p>
  <a class="btn big" href="#/events">Explore events →</a><a class="btn ghost big" href="#/events">Join the club</a>
  <div class="stats"><div><b data-n="${events.length}">0</b><span>Events</span></div><div><b data-n="250">0</b><span>Members</span></div><div><b data-n="${CATS.length}">0</b><span>Categories</span></div></div></section>
  ${
    f
      ? `<h2>Don't miss this one</h2><div class="card feat" style="--c:${getCategory(f.category)[1]}"><div style="display:flex;flex-direction:column;gap:6px">
  <span class="tag">${getCategory(f.category)[0]} ${esc(f.category)}</span><h3 style="font-size:1.4rem">${esc(f.name)}</h3>
  <div class="meta">📅 ${fmt(f.date)} · 📍 ${esc(f.venue)}</div><div class="cd" id="cd" data-t="${f.date}"></div>
  <p style="margin:4px 0 8px">${esc(f.description)}</p><button class="btn big" style="align-self:flex-start" onclick="openReg('${f.id}')">Register now →</button></div></div>`
      : ""
  }
  <h2>Upcoming events</h2>${up.length ? `<div class="grid">${up.slice(0, 3).map(card).join("")}</div><p><a class="btn sec" href="#/events">See all events →</a></p>` : '<div class="empty">No upcoming events yet.</div>'}
  <h2>Why join us?</h2><div class="why">
  <div class="card"><div class="ico">🚀</div><h3>Learn by doing</h3><span class="meta">Hands-on workshops and hackathons.</span></div>
  <div class="card"><div class="ico">🤝</div><h3>Meet your people</h3><span class="meta">Friends and mentors across every year.</span></div>
  <div class="card"><div class="ico">🏆</div><h3>Win and shine</h3><span class="meta">Contests, prizes and stage time.</span></div></div>`;
  countUp();
  clearInterval(T);
  if ($("#cd")) {
    tick();
    T = setInterval(tick, 1000);
  }
}

// EVENTS PAGE: search box + category filter + list of cards
function eventsPage() {
  $("#app").innerHTML = `<h1 style="margin-top:0">All events</h1>
  <div class="tools"><input id="q" placeholder="Search events by name…" aria-label="Search">
  <select id="cat" aria-label="Category"><option value="">All categories</option>${CATS.map((c) => `<option>${c}</option>`).join("")}</select></div>
  <div id="list" class="grid"></div>`;
  const draw = () => {
    const q = $("#q").value.toLowerCase(),
      c = $("#cat").value;
    const r = [...events]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .filter((e) => e.name.toLowerCase().includes(q) && (!c || e.category === c));
    $("#list").innerHTML = r.length
      ? r.map(card).join("")
      : '<div class="empty" style="grid-column:1/-1">No events match your search.</div>';
  };
  $("#q").oninput = draw;
  $("#cat").onchange = draw;
  draw();
}

// ---------- 4. REGISTRATION FORM ----------
// Opens the registration popup for one event
function openReg(id) {
  const e = events.find((x) => x.id === id);
  if (!e) return;
  modal(`<h3>Register: ${esc(e.name)}</h3>
  <label>Name</label><input id="rn"><label>Email</label><input id="re" type="email">
  <label>College / Year</label><input id="rc" placeholder="e.g. ABC College, 2nd Year">
  <label>Phone number</label><input id="rp" type="tel" inputmode="numeric">
  <div class="err" id="rerr"></div>
  <div class="row"><button class="btn sec" onclick="closeModal()">Cancel</button><button class="btn" onclick="submitReg('${id}')">Submit</button></div>`);
}
// Validates the form; if everything is OK, saves the registration
function submitReg(eid) {
  const v = (i) => $(i).value.trim(),
    name = v("#rn"),
    email = v("#re"),
    college = v("#rc"),
    phone = v("#rp"),
    er = $("#rerr");
  if (!name || !email || !college || !phone)
    return (er.textContent = "Please fill in all fields.");
  if (!/^\S+@\S+\.\S+$/.test(email))
    return (er.textContent = "Enter a valid email address.");
  if (!/^\+?\d{10,13}$/.test(phone.replace(/[\s-]/g, "")))
    return (er.textContent = "Enter a valid phone number (10–13 digits).");
  if (
    regs.some((r) => r.eventId === eid && r.email.toLowerCase() === email.toLowerCase())
  )
    return (er.textContent = "This email is already registered for the event.");
  regs.push({
    id: uid(),
    eventId: eid,
    name,
    email,
    college,
    phone,
    at: new Date().toISOString(),
  });
  save("rg", regs);
  closeModal();
  toast("Registration submitted! 🎉");
}

// ---------- ADMIN DASHBOARD ----------
// tab = which tab is open; rq/rf = registration search text and event filter
let tab = "events",
  rq = "",
  rf = "";
// Shows the login box, or the dashboard with two tabs (Events / Registrations)
function adminPage() {
  if (!admin) {
    $("#app").innerHTML =
      `<div class="card" style="max-width:360px;margin:40px auto"><h3>Admin login</h3>
    <input id="pw" type="password" placeholder="Password"><div class="err" id="perr"></div>
    <button class="btn" onclick="login()">Login</button><div class="meta">Demo password: admin123</div></div>`;
    $("#pw").onkeydown = (e) => {
      if (e.key === "Enter") login();
    };
    return;
  }
  $("#app").innerHTML =
    `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
  <h1 style="margin:0">Admin dashboard</h1><button class="btn sec sm" onclick="admin=false;save('adm',false);adminPage()">Logout</button></div>
  <div class="tabs" style="margin-top:14px"><button class="btn ${tab === "events" ? "" : "sec"}" onclick="tab='events';adminPage()">Events (${events.length})</button>
  <button class="btn ${tab === "regs" ? "" : "sec"}" onclick="tab='regs';adminPage()">Registrations (${regs.length})</button></div><div id="pane"></div>`;
  tab === "events" ? adminEvents() : adminRegs();
}
// Check the password typed by the admin
function login() {
  if ($("#pw").value === ADMIN_PASS) {
    admin = true;
    save("adm", true);
    adminPage();
  } else $("#perr").textContent = "Wrong password.";
}

// Events tab: table of events with Edit and Delete buttons
function adminEvents() {
  $("#pane").innerHTML =
    `<button class="btn" onclick="editEvent()" style="margin-bottom:12px">+ Add event</button>
  <div class="wrap"><table><tr><th>Name</th><th>Date</th><th>Category</th><th>Regs</th><th></th></tr>
  ${
    events
      .map(
        (
          e,
        ) => `<tr><td>${e.featured ? "⭐ " : ""}${esc(e.name)}</td><td>${fmt(e.date)}</td><td>${esc(e.category)}</td>
  <td>${regs.filter((r) => r.eventId === e.id).length}</td><td style="white-space:nowrap">
  <button class="btn sec sm" onclick="editEvent('${e.id}')">Edit</button> <button class="btn dan sm" onclick="delEvent('${e.id}')">Delete</button></td></tr>`,
      )
      .join("") || '<tr><td colspan="5" class="empty">No events.</td></tr>'
  }</table></div>`;
}
// Popup form used for both Add (no id) and Edit (with id)
function editEvent(id) {
  const e = events.find((x) => x.id === id) || {
    name: "",
    date: "",
    venue: "",
    category: CATS[0],
    description: "",
    featured: false,
  };
  modal(`<h3>${id ? "Edit" : "Add"} event</h3>
  <label>Name</label><input id="en" value="${esc(e.name)}"><label>Date & time</label><input id="ed" type="datetime-local" value="${esc(e.date)}">
  <label>Venue</label><input id="ev" value="${esc(e.venue)}"><label>Category</label>
  <select id="ec">${CATS.map((c) => `<option ${c === e.category ? "selected" : ""}>${c}</option>`).join("")}</select>
  <label>Description</label><textarea id="edsc" rows="3">${esc(e.description)}</textarea>
  <label style="display:flex;gap:8px;align-items:center"><input id="ef" type="checkbox" style="width:auto" ${e.featured ? "checked" : ""}> Featured event</label>
  <div class="err" id="eerr"></div><div class="row"><button class="btn sec" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveEvent('${id || ""}')">Save</button></div>`);
}
// Validate, then update the existing event or add a new one
function saveEvent(id) {
  const o = {
    name: $("#en").value.trim(),
    date: $("#ed").value,
    venue: $("#ev").value.trim(),
    category: $("#ec").value,
    description: $("#edsc").value.trim(),
    featured: $("#ef").checked,
  };
  if (!o.name || !o.date || !o.venue)
    return ($("#eerr").textContent = "Name, date and venue are required.");
  if (o.featured) events.forEach((x) => (x.featured = false));
  if (id)
    Object.assign(
      events.find((x) => x.id === id),
      o,
    );
  else events.push({ id: uid(), ...o });
  save("ev", events);
  closeModal();
  adminPage();
  toast("Event saved");
}
// Delete an event (and its registrations) after confirmation
function delEvent(id) {
  if (!confirm("Delete this event and its registrations?")) return;
  events = events.filter((e) => e.id !== id);
  regs = regs.filter((r) => r.eventId !== id);
  save("ev", events);
  save("rg", regs);
  adminPage();
}
// Registrations tab: table with search and filter by event
function adminRegs() {
  $("#pane").innerHTML =
    `<div class="tools"><input id="rq" placeholder="Search name, email, college…" value="${esc(rq)}">
  <select id="rf"><option value="">All events</option>${events.map((e) => `<option value="${e.id}" ${e.id === rf ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</select></div>
  <div class="wrap"><table><thead><tr><th>Student</th><th>Email</th><th>College / Year</th><th>Phone</th><th>Event</th><th></th></tr></thead><tbody id="rb"></tbody></table></div>`;
  const draw = () => {
    rq = $("#rq").value;
    rf = $("#rf").value;
    const q = rq.toLowerCase();
    const r = regs.filter(
      (x) =>
        (!rf || x.eventId === rf) &&
        [x.name, x.email, x.college].some((s) => s.toLowerCase().includes(q)),
    );
    $("#rb").innerHTML =
      r
        .map(
          (
            x,
          ) => `<tr><td>${esc(x.name)}</td><td>${esc(x.email)}</td><td>${esc(x.college)}</td><td>${esc(x.phone)}</td><td>${esc(evName(x.eventId))}</td>
    <td><button class="btn dan sm" onclick="delReg('${x.id}')">Remove</button></td></tr>`,
        )
        .join("") ||
      '<tr><td colspan="6" class="empty">No registrations found.</td></tr>';
  };
  $("#rq").oninput = draw;
  $("#rf").onchange = draw;
  draw();
}
// Remove a single registration
function delReg(id) {
  regs = regs.filter((r) => r.id !== id);
  save("rg", regs);
  adminPage();
}

// ---------- 5. ROUTER ----------
// Reads the URL part after '#' (/, /events, /admin) and shows that page
function route() {
  closeModal();
  const r = location.hash.slice(1) || "/";
  document
    .querySelectorAll(".nav .l")
    .forEach((a) => a.classList.toggle("on", a.dataset.r === r));
  (r === "/events" ? eventsPage : r === "/admin" ? adminPage : home)();
  window.scrollTo(0, 0);
}
// Run when the URL changes, and once when the page first loads
addEventListener("hashchange", route);
route();