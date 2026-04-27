import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAJ9Nv4Eru4yLor8fclYnV-Ln5bZQ9gwos",
  authDomain: "usta-cam-balkon-pdks.firebaseapp.com",
  projectId: "usta-cam-balkon-pdks",
  storageBucket: "usta-cam-balkon-pdks.firebasestorage.app",
  messagingSenderId: "284256934659",
  appId: "1:284256934659:web:c533c8aef97139cfbea736",
  measurementId: "G-T2366B5R1S"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ================= AYARLAR VE REHBER =================
const ADMIN_PHONES = ["5324328072", "5327097461"]; 

const personelRehberi = { 
    "5324328072": "Emre Özel İş", 
    "5419604133": "Emre Özel",
    "5327097461": "Volkan Usta",
    "5304901758": "Barış Eren",
    "5445995434": "Burak Albayrak",
    "5453470226": "Cem Arslan",
    "5462825561": "Ferhat",
    "5303835099": "Okan",
    "5398506894": "Hakan",
    "5453265703": "Barış",
    "5536424994": "Semra Polat",
    "5545841092": "Can",
    "5521240307": "Faruk",
    "5433315441": "Seydi",
    "5538876637": "Soner Güleç"
};

const personelSubeleri = {
    "5324328072": "Pendik Şube",
    "5419604133": "Atölye",
    "5327097461": "Pendik Şube",
    "5304901758": "Atölye",
    "5445995434": "Atölye",
    "5453470226": "Pendik Şube",
    "5462825561": "Atölye",
    "5303835099": "Atölye",
    "5398506894": "Atölye",
    "5453265703": "Atölye",
    "5536424994": "Pendik Şube",
    "5545841092": "Atölye",
    "5521240307": "Atölye",
    "5433315441": "Atölye",
    "5538876637": "Pendik Şube"
};

// YENİ: ÖZEL ÇALIŞMA SAATLERİ (Varsayılan 09:00 - 18:00)
const mesaiKurallari = {
    "5538876637": { baslangic: 12, bitis: 18 } // Soner için 12:00 - 18:00
};

const ismeCevir = (tel) => personelRehberi[tel] || tel;

const subeKonumlari = {
    "Pendik Şube": { lat: 40.899520532909584, lng: 29.258524165071616 }, 
    "Atölye": { lat: 40.899520532909584, lng: 29.258524165071616 }      
};
const MAKSIMUM_MESAFE_METRE = 150; 

const mesafeHesapla = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; 
    const p1 = lat1 * Math.PI/180; const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180; const dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
};

// ================= EKRAN YÖNETİMİ =================
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const adminDashboardScreen = document.getElementById('admin-dashboard-screen');
const detailScreen = document.getElementById('detail-screen');
const reportsScreen = document.getElementById('reports-screen');
const leavesScreen = document.getElementById('leaves-screen');
const locationFilter = document.getElementById('location-filter');

let tumHareketlerCache = [];
let sonFiltrelenmisRapor = []; 

const tumEkranlariKapat = () => {
    [dashboardScreen, adminDashboardScreen, detailScreen, reportsScreen, leavesScreen].forEach(s => s?.classList.remove('active'));
};

window.toggleSidebar = () => {
    document.getElementById('sidebar')?.classList.toggle('-translate-x-full');
    document.getElementById('sidebar-overlay')?.classList.toggle('hidden');
};

window.anaEkranaDon = () => {
    document.getElementById('sidebar')?.classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay')?.classList.add('hidden');
    tumEkranlariKapat();
    const p = auth.currentUser?.email.split('@')[0];
    if(p && ADMIN_PHONES.includes(p)) adminDashboardScreen?.classList.add('active');
    else dashboardScreen?.classList.add('active');
};
window.addEventListener('popstate', anaEkranaDon);

window.sistemiGuncelle = () => {
    document.getElementById('sidebar')?.classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay')?.classList.add('hidden');
    const overlay = document.getElementById('loading-overlay');
    if(overlay) {
        overlay.classList.remove('hidden');
        document.getElementById('loading-icon').className = "fas fa-sync fa-spin text-5xl mb-4 text-emerald-400";
        document.getElementById('loading-text-1').innerText = "Sistem Yenileniyor...";
    }
    setTimeout(() => {
        const yeniUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?v=' + new Date().getTime();
        window.location.href = yeniUrl;
    }, 1000);
};

// ================= YÖNETİCİ VE PERSONEL GÖRÜNÜMÜ =================
const adminVerileriniHesapla = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "hareketler"));
        tumHareketlerCache = [];
        querySnapshot.forEach(doc => tumHareketlerCache.push(doc.data()));
        const bugun = new Date().toLocaleDateString('tr-TR');
        const seciliSube = locationFilter?.value || "Tümü";
        let gelenler = new Set();
        
        tumHareketlerCache.forEach(v => {
            if(!v.tarih_saat) return;
            if(seciliSube !== "Tümü" && v.lokasyon !== seciliSube) return;
            const t = v.tarih_saat.toDate();
            if(t.toLocaleDateString('tr-TR') === bugun && v.islem_tipi === "Giriş") gelenler.add(v.personel_tel);
        });
        
        if(document.getElementById('count-gelenler')) document.getElementById('count-gelenler').innerText = gelenler.size;
        
        let beklenenSayi = 0; let gelenKendiSubesinde = 0;
        for (let tel in personelSubeleri) {
            if (seciliSube === "Tümü" || personelSubeleri[tel] === seciliSube) {
                beklenenSayi++;
                if (gelenler.has(tel)) gelenKendiSubesinde++;
            }
        }
        if(document.getElementById('count-gelmeyenler')) document.getElementById('count-gelmeyenler').innerText = Math.max(0, beklenenSayi - gelenKendiSubesinde);

        // Geç Kalan Sayacı (Özel Kurallara Göre)
        let gecKalanlarBugun = 0;
        tumHareketlerCache.forEach(v => {
            if(!v.tarih_saat || v.islem_tipi !== "Giriş") return;
            const t = v.tarih_saat.toDate();
            if(t.toLocaleDateString('tr-TR') === bugun) {
                const kural = mesaiKurallari[v.personel_tel] || { baslangic: 9 };
                if(t.getHours() > kural.baslangic || (t.getHours() === kural.baslangic && t.getMinutes() > 0)) gecKalanlarBugun++;
            }
        });
        if(document.getElementById('count-geckalanlar')) document.getElementById('count-geckalanlar').innerText = gecKalanlarBugun;

    } catch (e) { console.log(e); }
};

const arayuzDurumuGuncelle = async (phone, isAdmin) => {
    const q = query(collection(db, "hareketler"), where("personel_tel", "==", phone));
    const snapshot = await getDocs(q);
    let son = "Çıkış";
    if (!snapshot.empty) {
        let docs = []; snapshot.forEach(d => docs.push(d.data())); 
        docs.sort((a,b) => (b.tarih_saat?.toMillis() || 0) - (a.tarih_saat?.toMillis() || 0));
        const sonK = docs[0];
        const bugunT = new Date().toLocaleDateString('tr-TR');
        const kayitT = sonK.tarih_saat ? sonK.tarih_saat.toDate().toLocaleDateString('tr-TR') : bugunT;
        if (sonK.islem_tipi === "Giriş" && kayitT === bugunT) son = "Giriş";
    }
    const pref = isAdmin ? 'admin-' : '';
    const bG = document.getElementById(`${pref}btn-giris`);
    const bC = document.getElementById(`${pref}btn-cikis`);
    const badge = document.getElementById(`${pref}status-badge`);
    if (bG && bC && badge) {
        if(son === "Giriş") { bG.style.display="none"; bC.style.display="flex"; badge.innerText="MESAİDE"; badge.className="inline-block mt-2 px-4 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-widest"; }
        else { bG.style.display="flex"; bC.style.display="none"; badge.innerText="MESAİ DIŞI"; badge.className="inline-block mt-2 px-4 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-600 border border-red-200 uppercase tracking-widest"; }
    }
};

// ================= GPS VE ÖZGÜR ÇIKIŞ ZEKASI =================
let beklemedekiK = null; let aktifIslemTipi = "";

const islemBaslat = (tip) => { 
    aktifIslemTipi = tip; 
    document.getElementById('branch-modal')?.classList.remove('hidden'); 
};

window.gpsKonumDogrula = (loc) => {
    document.getElementById('branch-modal')?.classList.add('hidden');
    const overlay = document.getElementById('loading-overlay');
    if(overlay) overlay.classList.remove('hidden');

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            const dist = mesafeHesapla(pos.coords.latitude, pos.coords.longitude, subeKonumlari[loc].lat, subeKonumlari[loc].lng);
            document.getElementById('loading-overlay')?.classList.add('hidden');
            
            const userPhone = auth.currentUser?.email.split('@')[0];
            const kural = mesaiKurallari[userPhone] || { baslangic: 9, bitis: 18 };

            // KURAL: Giriş ise konum şart, Çıkış ise konum farketmez
            if (aktifIslemTipi === "Çıkış" || dist <= MAKSIMUM_MESAFE_METRE) {
                const d = new Date(); const h = d.getHours(); const m = d.getMinutes();
                let isl = ""; let frk = 0;
                
                if (aktifIslemTipi === "Giriş" && (h > kural.baslangic || (h === kural.baslangic && m > 0))) { 
                    isl = "Gecikme"; frk = (h * 60 + m) - (kural.baslangic * 60); 
                } else if (aktifIslemTipi === "Çıkış" && h < kural.bitis) { 
                    isl = "Erken Cikis"; frk = (kural.bitis * 60) - (h * 60 + m); 
                }
                
                if (isl !== "") {
                    beklemedekiK = { tip: aktifIslemTipi, loc, islem: isl, fark: frk };
                    if(document.getElementById('reason-input')) document.getElementById('reason-input').value = "";
                    const rI = document.getElementById('reason-icon');
                    if(isl === "Gecikme") { if(rI) rI.className="fas fa-clock text-red-500"; if(document.getElementById('reason-title')) document.getElementById('reason-title').innerText="Gecikme Bildirimi"; }
                    else { if(rI) rI.className="fas fa-door-open text-brand-orange"; if(document.getElementById('reason-title')) document.getElementById('reason-title').innerText="Erken Çıkış Bildirimi"; }
                    document.getElementById('reason-text').innerText = `Sayın ${ismeCevir(userPhone)}, mesai saatiniz dışında işlem yapıyorsunuz (${frk} dk fark). Lütfen nedenini belirtin.`;
                    document.getElementById('reason-modal')?.classList.remove('hidden');
                } else veritabaninaYaz(aktifIslemTipi, loc, "", 0, "");
            } else alert(`🚨 GÜVENLİK İHLALİ!\n\nŞubeden uzaktasınız (${Math.round(dist)}m).\nGiriş işlemi sadece şube konumundan yapılabilir.`);
        }, () => { 
            document.getElementById('loading-overlay')?.classList.add('hidden'); 
            if (aktifIslemTipi === "Çıkış") veritabaninaYaz("Çıkış", loc, "", 0, ""); 
            else alert("Konum alınamadı! Giriş için GPS gereklidir.");
        }, { enableHighAccuracy: true, timeout: 10000 });
    }
};

const veritabaninaYaz = async (tip, loc, islem, fark, not) => {
    const p = auth.currentUser.email.split('@')[0];
    const v = { personel_tel: p, islem_tipi: tip, tarih_saat: serverTimestamp(), lokasyon: loc };
    if (islem === "Gecikme") { v.islem_notu = not || "Mazeret yok"; v.durum_etiketi = "Geç Kaldı"; }
    else if (islem === "Erken Cikis") { v.islem_notu = not || "Mazeret yok"; v.durum_etiketi = "Erken Çıktı"; }
    try {
        await addDoc(collection(db, "hareketler"), v);
        alert(`✅ ${tip} Başarılı!`);
        const isAdmin = ADMIN_PHONES.includes(p);
        if(isAdmin) { arayuzDurumuGuncelle(p, true); adminVerileriniHesapla(); } 
        else arayuzDurumuGuncelle(p, false);
    } catch (e) { alert("Hata!"); }
};

document.getElementById('reason-submit-btn')?.addEventListener('click', () => {
    const r = document.getElementById('reason-input')?.value.trim();
    document.getElementById('reason-modal')?.classList.add('hidden');
    if(beklemedekiK) { veritabaninaYaz(beklemedekiK.tip, beklemedekiK.loc, beklemedekiK.islem, beklemedekiK.fark, r); beklemedekiK = null; }
});

document.getElementById('reason-skip-btn')?.addEventListener('click', () => {
    document.getElementById('reason-modal')?.classList.add('hidden');
    if(beklemedekiK) { veritabaninaYaz(beklemedekiK.tip, beklemedekiK.loc, beklemedekiK.islem, beklemedekiK.fark, ""); beklemedekiK = null; }
});

// ================= AKORDEON RAPOR VE EXCEL =================
window.raporVerileriniGetir = async () => {
    const startStr = document.getElementById('report-start-date')?.value;
    const endStr = document.getElementById('report-end-date')?.value;
    const onlyLate = document.getElementById('only-late-checkbox')?.checked;
    if(!startStr || !endStr) return alert("Tarih seçin!");
    const startD = new Date(startStr); startD.setHours(0,0,0,0);
    const endD = new Date(endStr); endD.setHours(23,59,59,999);
    const container = document.getElementById('reports-list-container');
    container.innerHTML = '<div class="text-center py-10 text-slate-400 font-bold"><i class="fas fa-sync fa-spin mr-3 text-emerald-500"></i>Yükleniyor...</div>';

    try {
        const snap = await getDocs(collection(db, "hareketler"));
        let gruplanmis = {}; sonFiltrelenmisRapor = []; 
        snap.forEach(doc => {
            const d = doc.data(); if(!d.tarih_saat) return;
            const docD = d.tarih_saat.toDate();
            if(docD >= startD && docD <= endD) {
                if(onlyLate && (d.durum_etiketi !== "Geç Kaldı" && d.durum_etiketi !== "Erken Çıktı")) return;
                const gun = docD.toLocaleDateString('tr-TR');
                if(!gruplanmis[gun]) gruplanmis[gun] = [];
                gruplanmis[gun].push(d); sonFiltrelenmisRapor.push(d);
            }
        });
        const tarihler = Object.keys(gruplanmis).sort((a,b) => {
            const [d1,m1,y1]=a.split('.'); const [d2,m2,y2]=b.split('.');
            return new Date(y2,m2-1,d2) - new Date(y1,m1-1,d1);
        });
        let html = "";
        if(tarihler.length === 0) { html = '<p class="text-center py-10 text-slate-300 italic">Kayıt yok.</p>'; document.getElementById('excel-btn')?.classList.add('hidden'); }
        else {
            document.getElementById('excel-btn')?.classList.remove('hidden');
            tarihler.forEach(t => {
                const kayitlar = gruplanmis[t];
                kayitlar.sort((a,b) => b.tarih_saat.toMillis() - a.tarih_saat.toMillis());
                html += `<div class="mb-4"><button onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('i.fa-chevron-down').classList.toggle('rotate-180');" class="w-full bg-white border border-slate-200 p-5 rounded-2xl flex justify-between items-center active:scale-95 shadow-sm"><div class="flex items-center gap-4 text-left"><div class="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-emerald-600 border border-slate-100"><i class="far fa-calendar-alt"></i></div><div><h4 class="font-black text-brand-navy text-sm">${t}</h4><span class="text-[10px] font-bold text-slate-400 uppercase">${kayitlar.length} İşlem</span></div></div><i class="fas fa-chevron-down text-slate-300 transition-transform"></i></button><div class="hidden flex flex-col gap-3 mt-3 px-2 border-l-2 border-emerald-100 ml-5">`;
                kayitlar.forEach(r => {
                    const saat = r.tarih_saat.toDate().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
                    const isL = r.durum_etiketi === "Geç Kaldı"; const isE = r.durum_etiketi === "Erken Çıktı";
                    const col = isL ? "border-red-500" : (isE ? "border-orange-500" : "border-emerald-500");
                    const bg = isL ? "bg-red-50/50" : (isE ? "bg-orange-50/50" : "bg-white");
                    html += `<div class="p-4 rounded-2xl shadow-sm border-l-8 ${col} ${bg} transition-all"><div class="flex justify-between items-start mb-2"><div><h4 class="font-black text-brand-navy text-xs">${ismeCevir(r.personel_tel)}</h4><span class="text-[9px] text-slate-400 font-bold uppercase">${r.lokasyon}</span></div><span class="text-[9px] font-black px-2 py-1 rounded bg-slate-100 uppercase">${r.islem_tipi}</span></div><div class="flex justify-between items-center mt-2"><div class="flex items-center gap-2 font-black text-slate-800 text-xs"><i class="far fa-clock text-slate-400"></i>${saat}</div><span class="text-[10px] font-black italic ${isL ? 'text-red-500' : 'text-emerald-500'}">${r.durum_etiketi || 'Zamanında'}</span></div>${r.islem_notu ? `<div class="mt-2 p-3 bg-white/60 rounded-xl text-[9px] text-slate-500 border border-slate-100 italic"><strong>Mazeret:</strong> ${r.islem_notu}</div>` : ''}</div>`;
                });
                html += `</div></div>`;
            });
        }
        container.innerHTML = html;
    } catch(e) { console.log(e); }
};

window.excelIndir = () => {
    const excelVerisi = sonFiltrelenmisRapor.map(r => {
        const dObj = r.tarih_saat.toDate();
        return { "Tarih": dObj.toLocaleDateString('tr-TR'), "Personel": ismeCevir(r.personel_tel), "Şube": r.lokasyon, "İşlem": r.islem_tipi, "Saat": dObj.toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'}), "Durum": r.durum_etiketi || "Zamanında", "Mazeret": r.islem_notu || "-" };
    });
    const worksheet = XLSX.utils.json_to_sheet(excelVerisi);
    worksheet['!cols'] = [{wch: 12}, {wch: 20}, {wch: 15}, {wch: 12}, {wch: 10}, {wch: 15}, {wch: 35}];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rapor");
    XLSX.writeFile(workbook, `PDKS_Rapor.xlsx`);
};

// ================= AKILLI ANALİZLER =================
window.detayAc = (k) => {
    document.getElementById('sidebar')?.classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay')?.classList.add('hidden');
    if(document.getElementById('detail-title')) document.getElementById('detail-title').innerText = k;
    tumEkranlariKapat(); detailScreen?.classList.add('active');
    history.pushState({ ekran: 'detay' }, '', '#detay');
    const container = document.getElementById('detail-list-container');
    const filter = locationFilter?.value || "Tümü";
    let html = ""; const bugun = new Date().toLocaleDateString('tr-TR');
    
    if (k === 'Bugün Gelmeyenler') {
        let gelenlerSet = new Set();
        tumHareketlerCache.forEach(v => {
            if(v.tarih_saat && v.tarih_saat.toDate().toLocaleDateString('tr-TR') === bugun && v.islem_tipi === "Giriş") gelenlerSet.add(v.personel_tel);
        });
        let gelmeyenler = [];
        for (let tel in personelSubeleri) {
            if ((filter === "Tümü" || filter === personelSubeleri[tel]) && !gelenlerSet.has(tel)) gelmeyenler.push(tel);
        }
        if (gelmeyenler.length === 0) html = `<div class="text-center py-12"><i class="fas fa-check-circle text-5xl text-emerald-400 mb-4 block"></i><p class="font-bold text-brand-navy">Herkes tam kadro çalışıyor!</p></div>`;
        else gelmeyenler.forEach(tel => { html += `<div class="p-5 bg-white rounded-2xl shadow-sm border-l-4 border-slate-300 mb-3"><div class="flex justify-between items-start mb-2"><div><h4 class="font-bold text-brand-navy text-sm">${ismeCevir(tel)}</h4><span class="text-[10px] text-slate-400 font-bold uppercase">${personelSubeleri[tel]}</span></div><span class="text-[10px] font-black px-2 py-1 rounded bg-red-50 text-red-500 uppercase border border-red-100">GELMEDİ</span></div></div>`; });
        if(container) container.innerHTML = html; return;
    }

    tumHareketlerCache.sort((a,b) => b.tarih_saat?.toMillis() - a.tarih_saat?.toMillis());
    tumHareketlerCache.forEach(v => {
        if(!v.tarih_saat || v.tarih_saat.toDate().toLocaleDateString('tr-TR') !== bugun) return;
        if(filter !== "Tümü" && v.lokasyon !== filter) return;
        if(k === "Geç Kalanlar") {
            const kural = mesaiKurallari[v.personel_tel] || { baslangic: 9 };
            const t = v.tarih_saat.toDate();
            if(!(t.getHours() > kural.baslangic || (t.getHours() === kural.baslangic && t.getMinutes() > 0)) || v.islem_tipi !== "Giriş") return;
        }
        const saat = v.tarih_saat.toDate().toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'});
        html += `<div class="p-5 bg-white rounded-2xl shadow-sm border-l-4 border-slate-200 mb-3"><div class="flex justify-between items-start mb-2"><div><h4 class="font-bold text-brand-navy text-xs">${ismeCevir(v.personel_tel)}</h4><span class="text-[9px] text-slate-400 uppercase font-bold">${v.lokasyon}</span></div><span class="text-[9px] font-black px-2 py-1 rounded bg-slate-50 uppercase">${v.islem_tipi}</span></div><div class="font-black text-slate-800 text-xs"><i class="far fa-clock mr-2 text-slate-400"></i>${saat}</div></div>`;
    });
    if(container) container.innerHTML = html || `<p class="text-center py-10 text-slate-400 italic">Kayıt bulunamadı.</p>`;
};

// ================= DİĞER FONKSİYONLAR =================
window.raporEkraniAc = () => { document.getElementById('sidebar')?.classList.add('-translate-x-full'); document.getElementById('sidebar-overlay')?.classList.add('hidden'); tumEkranlariKapat(); reportsScreen?.classList.add('active'); const iso = new Date().toISOString().split('T')[0]; if(document.getElementById('report-start-date')) document.getElementById('report-start-date').value = iso; if(document.getElementById('report-end-date')) document.getElementById('report-end-date').value = iso; history.pushState({ ekran: 'raporlar' }, '', '#raporlar'); };
window.izinPlanlamaAc = () => { document.getElementById('sidebar')?.classList.add('-translate-x-full'); document.getElementById('sidebar-overlay')?.classList.add('hidden'); document.getElementById('leave-modal')?.classList.remove('hidden'); const ps = document.getElementById('leave-person-select'); if(ps) { ps.innerHTML = ""; for(let t in personelRehberi) ps.innerHTML += `<option value="${t}">${personelRehberi[t]}</option>`; } };
window.togglePersonSelect = () => { document.getElementById('leave-person-container')?.classList.toggle('hidden', document.getElementById('leave-target-type')?.value === "Tümü"); };
document.getElementById('save-leave-btn')?.addEventListener('click', async () => { const bas = document.getElementById('leave-start-date')?.value; const bit = document.getElementById('leave-end-date')?.value; const tur = document.getElementById('leave-target-type')?.value; if (!bas || !bit) return alert("Tarih seçin!"); let hedef = tur === "Kişi Seç" ? document.getElementById('leave-person-select')?.value : "Tümü"; try { await addDoc(collection(db, "izinler"), { baslangic_tarihi: bas, bitis_tarihi: bit, izin_hedefi: hedef, isleyen_yonetici: auth.currentUser.email.split('@')[0], olusturulma: serverTimestamp() }); alert(`✅ Kaydedildi!`); document.getElementById('leave-modal')?.classList.add('hidden'); } catch (e) { alert("Hata!"); } });
window.planlananIzinleriAc = async () => { document.getElementById('sidebar')?.classList.add('-translate-x-full'); document.getElementById('sidebar-overlay')?.classList.add('hidden'); tumEkranlariKapat(); leavesScreen?.classList.add('active'); history.pushState({ ekran: 'izinler' }, '', '#izinler'); const container = document.getElementById('leaves-list-container'); if(container) container.innerHTML = '<p class="text-center">Yükleniyor...</p>'; try { const snap = await getDocs(query(collection(db, "izinler"))); let html = ""; let izinler = []; snap.forEach(doc => izinler.push(doc.data())); izinler.sort((a,b) => new Date(b.baslangic_tarihi) - new Date(a.baslangic_tarihi)); izinler.forEach(izin => { const isT = izin.izin_hedefi === "Tümü"; html += `<div class="p-5 rounded-2xl shadow-sm border-l-4 ${isT?'bg-blue-50 border-blue-500':'bg-white border-brand-orange'} mb-3"><h4 class="font-bold text-brand-navy text-sm">${isT ? "🏢 Tüm Şirket" : `👤 ${ismeCevir(izin.izin_hedefi)}`}</h4><div class="text-xs text-slate-600 mt-2"><i class="far fa-calendar-alt text-blue-500 mr-2"></i> ${izin.baslangic_tarihi.split('-').reverse().join('.')} - ${izin.bitis_tarihi.split('-').reverse().join('.')}</div></div>`; }); if(container) container.innerHTML = html || "İzin bulunmuyor."; } catch(e) { } };

onAuthStateChanged(auth, (u) => {
    if (u) {
        loginScreen?.classList.remove('active'); const p = u.email.split('@')[0];
        const isAdmin = ADMIN_PHONES.includes(p); 
        if(isAdmin) { if(document.getElementById('admin-welcome-text')) document.getElementById('admin-welcome-text').innerText = `Hoş geldin, ${ismeCevir(p)}`; tumEkranlariKapat(); adminDashboardScreen?.classList.add('active'); adminVerileriniHesapla(); arayuzDurumuGuncelle(p, true); }
        else { if(document.getElementById('welcome-text')) document.getElementById('welcome-text').innerText = `Hoş geldin, ${ismeCevir(p)}`; tumEkranlariKapat(); dashboardScreen?.classList.add('active'); arayuzDurumuGuncelle(p, false); }
    } else { tumEkranlariKapat(); loginScreen?.classList.add('active'); }
});

document.getElementById('login-btn')?.addEventListener('click', () => { const p = document.getElementById('phone-input')?.value; const s = document.getElementById('password-input')?.value; if(!p || !s) return alert("Eksik bilgi!"); signInWithEmailAndPassword(auth, `${p}@ustapdks.com`, s).catch(() => alert("Hata!")); });
document.getElementById('logout-btn')?.addEventListener('click', () => signOut(auth));
document.getElementById('sidebar-logout-btn')?.addEventListener('click', () => signOut(auth));
document.getElementById('admin-btn-giris')?.addEventListener('click', () => islemBaslat("Giriş"));
document.getElementById('admin-btn-cikis')?.addEventListener('click', () => islemBaslat("Çıkış"));
document.getElementById('btn-giris')?.addEventListener('click', () => islemBaslat("Giriş"));
document.getElementById('btn-cikis')?.addEventListener('click', () => islemBaslat("Çıkış"));
if(locationFilter) locationFilter.addEventListener('change', adminVerileriniHesapla);
