const ADMIN_PASSWORD = "shiva";

// ---------------- DATA TYPES ----------------
interface InfoItem { id:number; title:string; desc:string; createdAt:number; }
interface Member { id:number; name:string; role:string; contact:string; }
interface Scheme { id:number; title:string; desc:string; start:string; end:string; }
interface GalleryImage { id:number; dataUrl:string; uploadedAt:number; }

// ---------------- STORAGE KEYS ----------------
const KEY_INFO = "gp_info";
const KEY_MEMBERS = "gp_members";
const KEY_SCHEMES = "gp_schemes";
const KEY_IMAGES = "gp_images";

// ---------------- UTILITIES ----------------
function uid(): number { return Date.now() + Math.floor(Math.random()*1000); }
function load<T>(key:string): T[] { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : []; }
function save<T>(key:string, arr:T[]): void { localStorage.setItem(key, JSON.stringify(arr)); }
function escapeHtml(s:string): string { return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }

// ---------------- RENDER ----------------
function renderInfoList(){
    const container = document.getElementById("adminInfoList");
    if(!container) return;
    const items = load<InfoItem>(KEY_INFO).sort((a,b)=>b.createdAt - a.createdAt);
    container.innerHTML = items.length ? items.map(i=>`
        <div class="card">
            <h3>${escapeHtml(i.title)}</h3>
            <p>${escapeHtml(i.desc)}</p>
            <small>${new Date(i.createdAt).toLocaleString()}</small>
            <button onclick="deleteInfo(${i.id})">Delete</button>
        </div>`).join("") : "<p>No notices yet</p>";
}

function renderMembers(){
    const container = document.getElementById("adminMembers");
    if(!container) return;
    const mems = load<Member>(KEY_MEMBERS);
    container.innerHTML = mems.length ? mems.map(m=>`
        <div class="card">
            <h3>${escapeHtml(m.name)}</h3>
            <p>${escapeHtml(m.role)} - ${escapeHtml(m.contact)}</p>
            <button onclick="deleteMember(${m.id})">Delete</button>
        </div>`).join("") : "<p>No members yet</p>";
}

function renderSchemes(){
    const container = document.getElementById("adminSchemes");
    if(!container) return;
    const schs = load<Scheme>(KEY_SCHEMES);
    container.innerHTML = schs.length ? schs.map(s=>`
        <div class="card">
            <h3>${escapeHtml(s.title)}</h3>
            <p>${escapeHtml(s.desc)}</p>
            <small>${s.start} → ${s.end}</small>
            <button onclick="deleteScheme(${s.id})">Delete</button>
        </div>`).join("") : "<p>No schemes yet</p>";
}

function renderGallery(){
    const container = document.getElementById("adminGallery");
    if(!container) return;
    const imgs = load<GalleryImage>(KEY_IMAGES).sort((a,b)=>b.uploadedAt - a.uploadedAt);
    container.innerHTML = imgs.length ? imgs.map(img=>`
        <div>
            <img src="${img.dataUrl}" style="width:100%;max-width:300px;border-radius:8px"/>
            <button onclick="deleteImage(${img.id})">Delete</button>
        </div>`).join("") : "<p>No images yet</p>";
}

function renderAll(){ renderInfoList(); renderMembers(); renderSchemes(); renderGallery(); }

// ---------------- DELETE ----------------
(window as any).deleteInfo = (id:number)=>{
    const pwd = prompt("Admin password:"); if(pwd!==ADMIN_PASSWORD){alert("Incorrect"); return;}
    save(KEY_INFO, load<InfoItem>(KEY_INFO).filter(i=>i.id!==id)); renderInfoList();
};
(window as any).deleteMember = (id:number)=>{
    const pwd = prompt("Admin password:"); if(pwd!==ADMIN_PASSWORD){alert("Incorrect"); return;}
    save(KEY_MEMBERS, load<Member>(KEY_MEMBERS).filter(m=>m.id!==id)); renderMembers();
};
(window as any).deleteScheme = (id:number)=>{
    const pwd = prompt("Admin password:"); if(pwd!==ADMIN_PASSWORD){alert("Incorrect"); return;}
    save(KEY_SCHEMES, load<Scheme>(KEY_SCHEMES).filter(s=>s.id!==id)); renderSchemes();
};
(window as any).deleteImage = (id:number)=>{
    const pwd = prompt("Admin password:"); if(pwd!==ADMIN_PASSWORD){alert("Incorrect"); return;}
    save(KEY_IMAGES, load<GalleryImage>(KEY_IMAGES).filter(i=>i.id!==id)); renderGallery();
};

// ---------------- FORMS ----------------
function initForms(){
    // Info
    const infoForm = document.getElementById("infoForm") as HTMLFormElement|null;
    infoForm?.addEventListener("submit", e=>{
        e.preventDefault();
        const title = (document.getElementById("infoTitle") as HTMLInputElement).value.trim();
        const desc = (document.getElementById("infoDesc") as HTMLTextAreaElement).value.trim();
        const pwd = (document.getElementById("infoPassword") as HTMLInputElement).value;
        if(pwd!==ADMIN_PASSWORD){alert("Incorrect"); return;}
        const arr = load<InfoItem>(KEY_INFO);
        arr.push({id:uid(), title, desc, createdAt:Date.now()});
        save(KEY_INFO, arr);
        infoForm.reset(); renderInfoList();
    });

    // Member
    const memForm = document.getElementById("memberForm") as HTMLFormElement|null;
    memForm?.addEventListener("submit", e=>{
        e.preventDefault();
        const name = (document.getElementById("memberName") as HTMLInputElement).value.trim();
        const role = (document.getElementById("memberRole") as HTMLInputElement).value.trim();
        const contact = (document.getElementById("memberContact") as HTMLInputElement).value.trim();
        const pwd = (document.getElementById("memberPassword") as HTMLInputElement).value;
        if(pwd!==ADMIN_PASSWORD){alert("Incorrect"); return;}
        const arr = load<Member>(KEY_MEMBERS);
        arr.push({id:uid(), name, role, contact});
        save(KEY_MEMBERS, arr); memForm.reset(); renderMembers();
    });

    // Scheme
    const schForm = document.getElementById("schemeForm") as HTMLFormElement|null;
    schForm?.addEventListener("submit", e=>{
        e.preventDefault();
        const title = (document.getElementById("schemeTitle") as HTMLInputElement).value.trim();
        const desc = (document.getElementById("schemeDesc") as HTMLTextAreaElement).value.trim();
        const start = (document.getElementById("schemeStart") as HTMLInputElement).value;
        const end = (document.getElementById("schemeEnd") as HTMLInputElement).value;
        const pwd = (document.getElementById("schemePassword") as HTMLInputElement).value;
        if(pwd!==ADMIN_PASSWORD){alert("Incorrect"); return;}
        const arr = load<Scheme>(KEY_SCHEMES);
        arr.push({id:uid(), title, desc, start, end});
        save(KEY_SCHEMES, arr); schForm.reset(); renderSchemes();
    });

    // Image
    const imgForm = document.getElementById("imageForm") as HTMLFormElement|null;
    imgForm?.addEventListener("submit", e=>{
        e.preventDefault();
        const file = (document.getElementById("imageFile") as HTMLInputElement).files?.[0];
        const pwd = (document.getElementById("imagePassword") as HTMLInputElement).value;
        if(pwd!==ADMIN_PASSWORD){alert("Incorrect"); return;}
        if(!file){alert("Select image"); return;}
        const reader = new FileReader();
        reader.onload = ev=>{
            const dataUrl = ev.target?.result as string;
            const arr = load<GalleryImage>(KEY_IMAGES);
            arr.push({id:uid(), dataUrl, uploadedAt:Date.now()});
            save(KEY_IMAGES, arr); imgForm.reset(); renderGallery();
        };
        reader.readAsDataURL(file);
    });
}

// ---------------- NAV ----------------
function initNav(){
    document.querySelectorAll(".nav-toggle").forEach(btn=>{
        btn.addEventListener("click", ()=>{
            const nav = btn.nextElementSibling as HTMLElement;
            nav?.classList.toggle("show");
        });
    });
}

// ---------------- INIT ----------------
document.addEventListener("DOMContentLoaded", ()=>{
    renderAll();
    initForms();
    initNav();
});
