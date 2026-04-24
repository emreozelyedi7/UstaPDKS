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

// ================= AYARLAR =================
const ADMIN_PHONES = ["5324328072", "5327097461"]; 
const personelRehberi = { 
    "5324328072": "Emre Özel İş", 
    "5419604133": "Emre Özel",
    "5327097461": "Volkan Usta" 
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
let sonFiltrelenmisRapor = []; // Excel indirmek için kullanılacak global veri

window.toggleSidebar = () => {
    document.getElementById('sidebar')?.classList.toggle('-translate-x-full');
    document.getElementById('sidebar-overlay')?.classList.toggle('hidden');
};

window.anaEkranaDon = () => {
    document.getElementById('sidebar')?.classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay')?.classList.add('hidden');
    [detailScreen, leavesScreen, reportsScreen].forEach(s => s?.classList.remove('active'));
    adminDashboardScreen?.classList.add('active');
};
window.addEventListener('popstate', anaEkranaDon);

// ================= YÖNETİCİ VE PERSONEL GÖRÜNÜMÜ =================
const adminVerileriniHesapla = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "hareketler"));
        tumHareketlerCache = [];
        querySnapshot.forEach(doc => tumHareketlerCache.push(doc.data()));
        const bugun = new Date().toLocaleDateString('tr-TR');
        const seciliSube = locationFilter?.value || "Tümü";
        let gelenler = new Set(); let gecenler = new Set();
        
        tumHareketlerCache.forEach(v => {
            if(!v.tarih_saat) return;
            if(seciliSube !== "Tümü" && v.lokasyon !== seciliSube) return;
            const t = v.tarih_saat.toDate();
            if(t.toLocaleDateString('tr-TR') === bugun && v.islem_tipi === "Giriş") {
                gelenler.add(v.personel_tel);
                if(t.getHours() > 9 || (t.getHours() === 9 && t.getMinutes() > 0)) gecenler.add(v.personel_tel);
            }
        });
        if(document.getElementById('count-gelenler')) document.getElementById('count-gelenler').innerText = gelenler.size;
        if(document.getElementById('count-geckalanlar')) document.getElementById('count-geckalanlar').innerText = gecenler.size;
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
        else son = "Çıkış";
    }
    const pref = isAdmin ? 'admin-' : '';
    const bG = document.getElementById(`${pref}btn-giris`);
    const bC = document.getElementById(`${pref}btn-cikis`);
    const badge = document.getElementById(`${pref}status-badge`);
    if (bG && bC && badge) {
        if(son === "Giriş") {
            bG.style.display="none"; bC.style.display="flex";
            badge.innerText="MESAİDE"; badge.className="inline-block mt-2 px-4 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-widest";
        } else {
            bG.style.display="flex"; bC.style.display="none";
            badge.innerText="MESAİ DIŞI"; badge.className="inline-block mt-2 px-4 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-600 border border-red-200 uppercase tracking-widest";
        }
    }
};

// ================= GPS VE İŞLEM MANTIĞI =================
let beklemedekiK = null; let aktifIslemTipi = "";
const islemBaslat = (tip) => { aktifIslemTipi = tip; document.getElementById('branch-modal')?.classList.remove('hidden'); };

window.gpsKonumDogrula = (loc) => {
    document.getElementById('branch-modal')?.classList.add('hidden');
    document.getElementById('loading-overlay')?.classList.remove('hidden');
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            const dist = mesafeHesapla(pos.coords.latitude, pos.coords.longitude, subeKonumlari[loc].lat, subeKonumlari[loc].lng);
            document.getElementById('loading-overlay')?.classList.add('hidden');
            if (dist <= MAKSIMUM_MESAFE_METRE) {
                const d = new Date(); const h = d.getHours(); const m = d.getMinutes();
                let isl = ""; let frk = 0;
                if (aktifIslemTipi === "Giriş" && (h > 9 || (h === 9 && m > 0))) { isl = "Gecikme"; frk = (h * 60 + m) - 540; }
                else if (aktifIslemTipi === "Çıkış" && h < 18) { isl = "Erken Cikis"; frk = 1080 - (h * 60 + m); }
                if (isl !== "") {
                    beklemedekiK = { tip: aktifIslemTipi, loc, islem: isl, fark: frk };
                    if(document.getElementById('reason-input')) document.getElementById('reason-input').value = "";
                    const rI = document.getElementById('reason-icon');
                    if(isl === "Gecikme") { if(rI) rI.className="fas fa-clock text-red-500"; if(document.getElementById('reason-title')) document.getElementById('reason-title').innerText="Gecikme Bildirimi"; if(document.getElementById('reason-text')) document.getElementById('reason-text').innerText=`Sayın ${ismeCevir(auth.currentUser.email.split('@')[0])}, mesaiye ${frk} dk geç kaldınız. Nedeni nedir?`; }
                    else { if(rI) rI.className="fas fa-door-open text-brand-orange"; if(document.getElementById('reason-title')) document.getElementById('reason-title').innerText="Erken Çıkış Bildirimi"; if(document.getElementById('reason-text')) document.getElementById('reason-text').innerText=`Sayın ${ismeCevir(auth.currentUser.email.split('@')[0])}, mesai bitişine ${frk} dk kala çıkış yapıyorsunuz. Nedeni nedir?`; }
                    document.getElementById('reason-modal')?.classList.remove('hidden');
                } else veritabaninaYaz(aktifIslemTipi, loc, "", 0, "");
            } else alert(`🚨 GÜVENLİK İHLALİ!\n\nŞubeden uzaktasınız: ${Math.round(dist)}m.`);
        }, () => { document.getElementById('loading-overlay')?.classList.add('hidden'); alert("Konum alınamadı!"); }, { enableHighAccuracy: true, timeout: 10000 });
    }
};

const veritabaninaYaz = async (tip, loc, islem, fark, not) => {
    const p = auth.currentUser.email.split('@')[0];
    const v = { personel_tel: p, islem_tipi: tip, tarih_saat: serverTimestamp(), lokasyon: loc };
    if (islem === "Gecikme") { v.islem_notu = not || "Mazeret yok"; v.durum_etiketi = "Geç Kaldı"; }
    else if (islem === "Erken Cikis") { v.islem_notu = not || "Mazeret yok"; v.durum_etiketi = "Erken Çıktı"; }
    try {
        await addDoc(collection(db, "hareketler"), v);
        alert(`✅ ${loc} - ${tip} Başarılı!`);
        const isAdmin = ADMIN_PHONES.includes(p);
        if(isAdmin) { arayuzDurumuGuncelle(p, true); adminVerileriniHesapla(); } 
        else arayuzDurumuGuncelle(p, false);
    } catch (e) { alert("Kayıt hatası!"); }
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

// ================= AKORDEON RAPOR MANTIĞI =================
window.raporVerileriniGetir = async () => {
    const startStr = document.getElementById('report-start-date')?.value;
    const endStr = document.getElementById('report-end-date')?.value;
    const onlyLate = document.getElementById('only-late-checkbox')?.checked;
    if(!startStr || !endStr) return alert("Tarihleri seçin!");

    const startD = new Date(startStr); startD.setHours(0,0,0,0);
    const endD = new Date(endStr); endD.setHours(23,59,59,999);

    const container = document.getElementById('reports-list-container');
    container.innerHTML = '<div class="text-center py-10 text-slate-400 font-bold"><i class="fas fa-sync fa-spin mr-3 text-emerald-500"></i>Veriler Çekiliyor...</div>';

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
        if(tarihler.length === 0) {
            html = '<div class="text-center py-10 text-slate-400 font-bold italic">Kayıt bulunamadı.</div>';
            document.getElementById('excel-btn')?.classList.add('hidden');
        } else {
            document.getElementById('excel-btn')?.classList.remove('hidden');
            tarihler.forEach(t => {
                const kayitlar = gruplanmis[t];
                kayitlar.sort((a,b) => b.tarih_saat.toMillis() - a.tarih_saat.toMillis());
                html += `
                <div class="mb-4">
                    <button onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('i.fa-chevron-down').classList.toggle('rotate-180');" class="w-full bg-white border border-slate-200 p-5 rounded-2xl flex justify-between items-center active:scale-95 transition-all shadow-sm">
                        <div class="flex items-center gap-4 text-left">
                            <div class="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-emerald-600 border border-slate-100"><i class="far fa-calendar-alt"></i></div>
                            <div><h4 class="font-black text-brand-navy text-sm">${t}</h4><span class="text-[10px] font-bold text-slate-400 uppercase">${kayitlar.length} İşlem</span></div>
                        </div>
                        <i class="fas fa-chevron-down text-slate-300 transition-transform"></i>
                    </button>
                    <div class="hidden flex flex-col gap-3 mt-3 px-2 border-l-2 border-emerald-100 ml-5">
                `;
                kayitlar.forEach(r => {
                    const saat = r.tarih_saat.toDate().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
                    const isL = r.durum_etiketi === "Geç Kaldı"; const isE = r.durum_etiketi === "Erken Çıktı";
                    const col = isL ? "border-red-500" : (isE ? "border-orange-500" : "border-emerald-500");
                    const bg = isL ? "bg-red-50/50" : (isE ? "bg-orange-50/50" : "bg-white");
                    html += `
                    <div class="p-4 rounded-2xl shadow-sm border-l-8 ${col} ${bg} transition-all">
                        <div class="flex justify-between items-start mb-2">
                            <div><h4 class="font-black text-brand-navy text-xs">${ismeCevir(r.personel_tel)}</h4><span class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">${r.lokasyon}</span></div>
                            <span class="text-[9px] font-black px-2 py-1 rounded bg-slate-100 uppercase">${r.islem_tipi}</span>
                        </div>
                        <div class="flex justify-between items-center mt-2">
                            <div class="flex items-center gap-2 font-black text-slate-800 text-xs"><i class="far fa-clock text-slate-400"></i>${saat}</div>
                            <span class="text-[10px] font-black italic ${isL ? 'text-red-500' : 'text-emerald-500'}">${r.durum_etiketi || 'Zamanında'}</span>
                        </div>
                        ${r.islem_notu ? `<div class="mt-2 p-3 bg-white/60 rounded-xl text-[9px] text-slate-500 border border-slate-100 leading-relaxed italic"><strong>Mazeret:</strong> ${r.islem_notu}</div>` : ''}
                    </div>`;
                });
                html += `</div></div>`;
            });
        }
        container.innerHTML = html;
    } catch(e) { console.log(e); }
};

// ================= EXCEL İNDİRME FONKSİYONU (YENİ) =================
window.excelIndir = () => {
    if (sonFiltrelenmisRapor.length === 0) return alert("Önce sorgulama yapın!");

    // Verileri Excel formatına hazırlıyoruz
    const excelVerisi = sonFiltrelenmisRapor.map(r => {
        const dObj = r.tarih_saat.toDate();
        return {
            "Tarih": dObj.toLocaleDateString('tr-TR'),
            "Personel": ismeCevir(r.personel_tel),
            "Şube": r.lokasyon,
            "İşlem Tipi": r.islem_tipi,
            "Saat": dObj.toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'}),
            "Durum": r.durum_etiketi || "Zamanında",
            "Mazeret Notu": r.islem_notu || "-"
        };
    });

    // Sayfa oluştur
    const worksheet = XLSX.utils.json_to_sheet(excelVerisi);
    
    // Sütun genişliklerini ayarla (Daha düzgün görünüm için)
    const wscols = [
        {wch: 12}, {wch: 20}, {wch: 15}, {wch: 12}, {wch: 10}, {wch: 15}, {wch: 35}
    ];
    worksheet['!cols'] = wscols;

    // Kitap oluştur ve indir
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "PDKS Raporu");
    
    // Dosya adını tarih aralığına göre yapalım
    const dosyaAdi = `PDKS_Rapor_${new Date().toLocaleDateString('tr-TR')}.xlsx`;
    XLSX.writeFile(workbook, dosyaAdi);
};

// ================= OTURUM VE DİĞERLERİ =================
onAuthStateChanged(auth, (u) => {
    if (u) {
        loginScreen?.classList.remove('active'); const p = u.email.split('@')[0];
        const isAdmin = ADMIN_PHONES.includes(p); 
        if(isAdmin) {
            if(document.getElementById('admin-welcome-text')) document.getElementById('admin-welcome-text').innerText = `Hoş geldin, ${ismeCevir(p)}`;
            adminDashboardScreen?.classList.add('active'); adminVerileriniHesapla(); arayuzDurumuGuncelle(p, true);
        } else {
            if(document.getElementById('welcome-text')) document.getElementById('welcome-text').innerText = `Hoş geldin, ${ismeCevir(p)}`;
            dashboardScreen?.classList.add('active'); arayuzDurumuGuncelle(p, false);
        }
    } else { loginScreen?.classList.add('active'); [adminDashboardScreen, dashboardScreen, reportsScreen, leavesScreen, detailScreen].forEach(s => s?.classList.remove('active')); }
});

document.getElementById('login-btn')?.addEventListener('click', () => {
    const p = document.getElementById('phone-input')?.value; const s = document.getElementById('password-input')?.value;
    if(!p || !s) return alert("Bilgileri girin!");
    const b = document.getElementById('login-btn'); if(b) b.innerHTML='<i class="fas fa-spinner fa-spin"></i>';
    signInWithEmailAndPassword(auth, `${p}@ustapdks.com`, s).catch(() => { if(b) b.innerHTML='Giriş Yap'; alert("Hata!"); });
});

document.getElementById('logout-btn')?.addEventListener('click', () => signOut(auth));
document.getElementById('sidebar-logout-btn')?.addEventListener('click', () => signOut(auth));
document.getElementById('btn-giris')?.addEventListener('click', () => islemBaslat("Giriş"));
document.getElementById('btn-cikis')?.addEventListener('click', () => islemBaslat("Çıkış"));
document.getElementById('admin-btn-giris')?.addEventListener('click', () => islemBaslat("Giriş"));
document.getElementById('admin-btn-cikis')?.addEventListener('click', () => islemBaslat("Çıkış"));
if(locationFilter) locationFilter.addEventListener('change', adminVerileriniHesapla);

// İZİN VE DİĞER EKRANLAR (Önceki fonksiyonlar korundu)
window.izinPlanlamaAc = () => { document.getElementById('sidebar')?.classList.add('-translate-x-full'); document.getElementById('sidebar-overlay')?.classList.add('hidden'); document.getElementById('leave-modal')?.classList.remove('hidden'); const ps = document.getElementById('leave-person-select'); if(ps) { ps.innerHTML = ""; for(let t in personelRehberi) ps.innerHTML += `<option value="${t}">${personelRehberi[t]}</option>`; } };
window.togglePersonSelect = () => { document.getElementById('leave-person-container')?.classList.toggle('hidden', document.getElementById('leave-target-type')?.value === "Tümü"); };
document.getElementById('save-leave-btn')?.addEventListener('click', async () => { 
    const baslangic = document.getElementById('leave-start-date')?.value;
    const bitis = document.getElementById('leave-end-date')?.value;
    const tur = document.getElementById('leave-target-type')?.value;
    if (!baslangic || !bitis) return alert("Tarih seçin!");
    let hedef = tur === "Kişi Seç" ? document.getElementById('leave-person-select')?.value : "Tümü";
    const btn = document.getElementById('save-leave-btn');
    try {
        await addDoc(collection(db, "izinler"), { baslangic_tarihi: baslangic, bitis_tarihi: bitis, izin_hedefi: hedef, isleyen_yonetici: auth.currentUser.email.split('@')[0], olusturulma: serverTimestamp() });
        alert(`✅ İzin oluşturuldu!`); document.getElementById('leave-modal')?.classList.add('hidden');
    } catch (e) { alert("Hata!"); }
});

window.raporEkraniAc = () => {
    document.getElementById('sidebar')?.classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay')?.classList.add('hidden');
    adminDashboardScreen?.classList.remove('active'); reportsScreen?.classList.add('active');
    if(document.getElementById('report-start-date')) document.getElementById('report-start-date').valueAsDate = new Date();
    if(document.getElementById('report-end-date')) document.getElementById('report-end-date').valueAsDate = new Date();
    history.pushState({ ekran: 'raporlar' }, '', '#raporlar');
};

window.planlananIzinleriAc = async () => {
    document.getElementById('sidebar')?.classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay')?.classList.add('hidden');
    adminDashboardScreen?.classList.remove('active'); leavesScreen?.classList.add('active');
    history.pushState({ ekran: 'izinler' }, '', '#izinler');
    const container = document.getElementById('leaves-list-container');
    if(container) container.innerHTML = '<div class="text-center py-10 text-slate-400 font-bold"><i class="fas fa-spinner fa-spin mr-3"></i>Yükleniyor...</div>';
    try {
        const snap = await getDocs(query(collection(db, "izinler")));
        let html = "";
        snap.forEach(doc => {
            const izin = doc.data(); const isT = izin.izin_hedefi === "Tümü";
            html += `
            <div class="p-5 rounded-2xl shadow-sm border-l-4 ${isT?'bg-blue-50 border-blue-500':'bg-white border-brand-orange'} relative overflow-hidden mb-3">
                <h4 class="font-bold text-brand-navy text-sm">${isT ? "🏢 Tüm Şirket" : `👤 ${ismeCevir(izin.izin_hedefi)}`}</h4>
                <div class="flex items-center text-xs text-slate-600 font-medium mt-2 bg-white/60 p-2 rounded-lg border border-slate-100">
                    <i class="far fa-calendar-alt text-blue-500 mr-2"></i> ${izin.baslangic_tarihi.split('-').reverse().join('.')} - ${izin.bitis_tarihi.split('-').reverse().join('.')}
                </div>
            </div>`;
        });
        if(container) container.innerHTML = html || "İzin bulunmuyor.";
    } catch(e) { }
};

window.detayAc = (k) => {
    document.getElementById('sidebar')?.classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay')?.classList.add('hidden');
    if(document.getElementById('detail-title')) document.getElementById('detail-title').innerText = k;
    adminDashboardScreen?.classList.remove('active'); detailScreen?.classList.add('active');
    history.pushState({ ekran: 'detay' }, '', '#detay');
    const container = document.getElementById('detail-list-container');
    const filter = locationFilter?.value || "Tümü";
    let html = ""; const bugun = new Date().toLocaleDateString('tr-TR');
    tumHareketlerCache.forEach(v => {
        if(!v.tarih_saat) return;
        const tStr = v.tarih_saat.toDate().toLocaleDateString('tr-TR');
        if(tStr === bugun) {
            if(filter !== "Tümü" && v.lokasyon !== filter) return;
            if(k === "Geç Kalanlar" && v.durum_etiketi !== "Geç Kaldı") return;
            const saat = v.tarih_saat.toDate().toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'});
            html += `<div class="p-5 bg-white rounded-2xl shadow-sm border-l-4 border-slate-200 mb-3">
                        <div class="flex justify-between items-start mb-2">
                            <div><h4 class="font-bold text-brand-navy text-xs">${ismeCevir(v.personel_tel)}</h4><span class="text-[9px] text-slate-400 uppercase font-bold">${v.lokasyon}</span></div>
                            <span class="text-[9px] font-black px-2 py-1 rounded bg-slate-50 uppercase">${v.islem_tipi}</span>
                        </div>
                        <div class="font-black text-slate-800 text-xs"><i class="far fa-clock mr-2 text-slate-400"></i>${saat}</div>
                    </div>`;
        }
    });
    if(container) container.innerHTML = html || "Kayıt yok.";
};
