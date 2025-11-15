// ---------------- GLOBAL SETTINGS ----------------
const ADMIN_PASSWORD = "shiva";

function uid() {
    return Date.now() + Math.floor(Math.random() * 1000);
}

// Storage Keys
const KEY_INFO = "gp_info";
const KEY_IMAGES = "gp_images";
const KEY_MEMBERS = "gp_members";
const KEY_SCHEMES = "gp_schemes";

// ---------------- UTILITY ----------------
function escapeHtml(s) {
    return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

// ---------------- INFO SECTION ----------------
function loadInfo() {
    const raw = localStorage.getItem(KEY_INFO);
    return raw ? JSON.parse(raw) : [];
}
function saveInfo(items) {
    localStorage.setItem(KEY_INFO, JSON.stringify(items));
}
function renderInfoList() {
    const container = document.getElementById("infoItems");
    if (!container) return;
    const items = loadInfo().sort((a, b) => b.createdAt - a.createdAt);
    container.innerHTML = items.map(item => `
        <div class="card">
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.desc)}</p>
            <small>${new Date(item.createdAt).toLocaleString()}</small>
            <div style="margin-top:8px;">
                <button onclick="deleteInfo(${item.id})">Delete (admin)</button>
            </div>
        </div>`).join("");
}

// ---------------- GALLERY SECTION ----------------
// ---------------- GALLERY SECTION (BACKEND VERSION) ----------------

// Fetch images from backend
async function fetchGallery() {
    const res = await fetch("/api/gallery");
    const data = await res.json();
    return data.images || [];
}

// Render gallery (user page)
async function renderGallery() {
    const gallery = document.getElementById("gallery");
    if (!gallery) return;

    const images = await fetchGallery();

    if (!images.length) {
        gallery.innerHTML = "<p>No images uploaded yet</p>";
        return;
    }

    gallery.innerHTML = "";

    images.forEach(img => {
        const wrapper = document.createElement("div");
        const el = document.createElement("img");

        el.src = img.url;
        el.alt = img.alt || "Gallery Image";
        el.style.cursor = "pointer";

        // ⭐ FIX: Lightbox click event
        el.addEventListener("click", () => {
            document.getElementById("lightboxImg").src = img.url;
            document.getElementById("lightbox").style.display = "flex";
        });

        wrapper.appendChild(el);
        gallery.appendChild(wrapper);
    });
}


// ---------------- MEMBERS SECTION (BACKEND VERSION) ----------------
async function fetchMembers() {
    const res = await fetch("/api/members");
    const data = await res.json();
    return data.members || [];
}

async function renderMembers() {
    const list = document.getElementById("memberList");
    if (!list) return;

    const members = await fetchMembers();

    if (!members.length) {
        list.innerHTML = "<p>सदस्यांची नोंद उपलब्ध नाही</p>";
        return;
    }

    list.innerHTML = members.map(m => `
        <div class="card">
            <h3>👤 ${m.name}</h3>
            <p><strong>भूमिका:</strong> ${m.role}</p>
            <p><strong>संपर्क:</strong> ${m.contact}</p>
        </div>
    `).join("");
}

async function renderAdminMembers() {
    const adminList = document.getElementById("adminMembers");
    if (!adminList) return;

    const members = await fetchMembers();

    adminList.innerHTML = members.map(m => `
        <div class="card">
            <h3>${m.name}</h3>
            <p>${m.role} - ${m.contact}</p>
            <button onclick="deleteMember(${m.id})">Delete</button>
        </div>
    `).join("");
}

window.deleteMember = async function (id) {
    const pwd = prompt("Admin Password:");
    if (pwd !== ADMIN_PASSWORD) return alert("Incorrect password");

    await fetch(`/admin/delete/member/${id}`, { method: "DELETE" });

    renderAdminMembers();
    renderMembers();
};

function initMemberForm() {
    const form = document.getElementById("memberForm");
    if (!form) return;

    form.addEventListener("submit", async e => {
        e.preventDefault();

        if (document.getElementById("memberPassword").value !== ADMIN_PASSWORD)
            return alert("Incorrect password");

        await fetch("/admin/members", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: document.getElementById("memberName").value.trim(),
                role: document.getElementById("memberRole").value.trim(),
                contact: document.getElementById("memberContact").value.trim()
            })
        });

        form.reset();
        renderMembers();
        renderAdminMembers();
    });
}


// ---------------- SCHEMES SECTION ----------------
function loadSchemes() {
    const raw = localStorage.getItem(KEY_SCHEMES);
    return raw ? JSON.parse(raw) : [];
}
function saveSchemes(arr) {
    localStorage.setItem(KEY_SCHEMES, JSON.stringify(arr));
}
function cleanupExpiredSchemes() {
    const now = Date.now();
    const schemes = loadSchemes().filter(s => new Date(s.endDate).getTime() >= now);
    saveSchemes(schemes);
}
function renderSchemes() {
    cleanupExpiredSchemes();
    const list = document.getElementById("schemeList");
    if (!list) return;
    const schemes = loadSchemes().sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    list.innerHTML = schemes.map(s => `
        <div class="card">
            <h3>${escapeHtml(s.title)}</h3>
            <p>${escapeHtml(s.desc)}</p>
            <p><strong>From:</strong> ${escapeHtml(s.startDate)} <strong>To:</strong> ${escapeHtml(s.endDate)}</p>
        </div>`).join("");
}
function renderAdminSchemes() {
    cleanupExpiredSchemes();
    const list = document.getElementById("adminSchemes");
    if (!list) return;
    const schemes = loadSchemes();
    list.innerHTML = schemes.map(s => `
        <div class="card">
            <h3>${escapeHtml(s.title)}</h3>
            <p>${escapeHtml(s.desc)}</p>
            <p><strong>${s.startDate}</strong> → <strong>${s.endDate}</strong></p>
            <div><button onclick="deleteScheme(${s.id})">Delete</button></div>
        </div>`).join("");
}

window.deleteScheme = function (id) {
    const pwd = prompt("Enter admin password to delete scheme:");
    if (pwd !== ADMIN_PASSWORD) return alert("Incorrect password");
    const schemes = loadSchemes().filter(s => s.id !== id);
    saveSchemes(schemes);
    renderAdminSchemes();
    renderSchemes();
};

function initSchemeForm() {
    const form = document.getElementById("schemeForm");
    if (!form) return;
    form.addEventListener("submit", e => {
        e.preventDefault();
        const title = document.getElementById("schemeTitle").value.trim();
        const desc = document.getElementById("schemeDesc").value.trim();
        const start = document.getElementById("schemeStart").value;
        const end = document.getElementById("schemeEnd").value;
        const pwd = document.getElementById("schemePassword").value.trim();
        if (pwd !== ADMIN_PASSWORD) return alert("Incorrect password");

        if (new Date(end) < new Date(start)) return alert("End date cannot be before start date");

        const arr = loadSchemes();
        arr.push({ id: uid(), title, desc, startDate: start, endDate: end });
        saveSchemes(arr);
        form.reset();
        renderAdminSchemes();
        renderSchemes();
        socket.emit('update-data'); // Notify server of new scheme
    });
}

// ---------------- INFO & IMAGE FORMS ----------------
function initForms() {
    const infoForm = document.getElementById("infoForm");
    const imageForm = document.getElementById("imageForm");

    if (infoForm) {
        infoForm.addEventListener("submit", e => {
            e.preventDefault();
            const title = document.getElementById("infoTitle").value.trim();
            const desc = document.getElementById("infoDesc").value.trim();
            const pass = document.getElementById("infoPassword").value.trim();
            if (pass !== ADMIN_PASSWORD) return alert("Incorrect password");

            const infos = loadInfo();
            infos.push({ id: uid(), title, desc, createdAt: Date.now() });
            saveInfo(infos);
            infoForm.reset();
            renderInfoList();
            renderAdminLists();
            socket.emit('update-data'); // Notify server
        });
    }

    if (imageForm) {
        imageForm.addEventListener("submit", e => {
            e.preventDefault();
            const file = document.getElementById("imageFile").files[0];
            const pass = document.getElementById("imagePassword").value.trim();
            if (pass !== ADMIN_PASSWORD) return alert("Incorrect password");
            if (!file) return alert("Select an image.");

            const reader = new FileReader();
            reader.onload = event => {
                const imgs = loadImages();
                imgs.push({ id: uid(), dataUrl: event.target.result, uploadedAt: Date.now() });
                saveImages(imgs);
                imageForm.reset();
                renderGallery();
                renderAdminLists();
                socket.emit('update-data'); // Notify server
            };
            reader.readAsDataURL(file);
        });
    }
}


// ---------------- DELETE HANDLERS ----------------
window.deleteInfo = function (id) {
    const pwd = prompt("Enter admin password to delete this info:");
    if (pwd !== ADMIN_PASSWORD) return alert("Incorrect password");
    const items = loadInfo().filter(i => i.id !== id);
    saveInfo(items);
    renderInfoList();
    renderAdminLists();
    socket.emit('update-data'); // Notify server
};

window.deleteImage = function (id) {
    const pwd = prompt("Enter admin password to delete this image:");
    if (pwd !== ADMIN_PASSWORD) return alert("Incorrect password");
    const imgs = loadImages().filter(i => i.id !== id);
    saveImages(imgs);
    renderGallery();
    renderAdminLists();
    socket.emit('update-data'); // Notify server
};

// ---------------- ADMIN RENDER ----------------
function renderAdminLists() {
    const infoList = document.getElementById("adminInfoList");
    const adminGallery = document.getElementById("adminGallery");

    if (infoList) {
        const items = loadInfo().sort((a, b) => b.createdAt - a.createdAt);
        infoList.innerHTML = items.map(it => `
            <div class="card">
                <h3>${escapeHtml(it.title)}</h3>
                <p>${escapeHtml(it.desc)}</p>
                <small>${new Date(it.createdAt).toLocaleString()}</small>
                <div style="margin-top:8px;"><button onclick="deleteInfo(${it.id})">Delete</button></div>
            </div>`).join("");
    }

    if (adminGallery) {
        const imgs = loadImages().sort((a, b) => b.uploadedAt - a.uploadedAt);
        adminGallery.innerHTML = imgs.map(im => `
            <div>
                <img src="${im.dataUrl}" alt="img"/>
                <div style="margin-top:6px;">
                    <button onclick="deleteImage(${im.id})">Delete</button>
                </div>
            </div>`).join("");
    }
}

// ---------------- NAVIGATION ----------------
function initNav() {
    document.querySelectorAll(".nav-toggle").forEach(btn => {
        btn.addEventListener("click", () => {
            const nav = btn.nextElementSibling;
            if (nav) nav.classList.toggle("show");
        });
    });
}

// ------------------- SOCKET.IO LIVE UPDATES -------------------
socket.on('new-data', () => {
    renderMembers();
    renderAdminMembers();
    renderSchemes();
    renderAdminSchemes();
    renderGallery();
    renderInfoList();
    renderAdminLists();
});

// ------------------- INIT -------------------
document.addEventListener("DOMContentLoaded", () => {
    renderInfoList();
    renderGallery();
    renderAdminLists();
    renderMembers();
    renderAdminMembers();
    renderSchemes();
    renderAdminSchemes();
    initForms();
    initMemberForm();
    initSchemeForm();
    initNav();
});
