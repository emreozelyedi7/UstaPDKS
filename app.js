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
        let docs = []; 
        snapshot.forEach(d => docs.push(d.data())); 
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
let beklemedekiK = null; 
let aktifIslemTipi = "";

const islemBaslat = (tip) => {
    aktifIslemTipi = tip;
    document.getElementById('branch-modal')?.classList.remove('hidden');
};

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
                    if(isl === "Gecikme") { 
                        if(rI) rI.className="fas fa-clock text-red-500"; 
                        if(document.getElementById('reason-title')) document.getElementById('reason-title').innerText="Gecikme Bildirimi"; 
                        if(document.getElementById('reason-text')) document.getElementById('reason-text').innerText=`Sayın ${ismeCevir(auth.currentUser.email.split('@')[0])}, mesaiye ${frk} dk geç kaldınız. Nedeni nedir?`; 
                    } else { 
                        if(rI) rI.className="fas fa-door-open text-brand-orange"; 
                        if(document.getElementById('reason-title')) document.getElementById('reason-title').innerText="Erken Çıkış Bildirimi"; 
                        if(document.getElementById('reason-text')) document.getElementById('reason-text').innerText=`Sayın ${ismeCevir(auth.currentUser.email.split('@')[0])}, mesai bitişine ${frk} dk kala çıkış yapıyorsunuz. Nedeni nedir?`; 
                    }
                    document.getElementById('reason-modal')?.classList.remove('hidden');
                } else {
                    veritabaninaYaz(aktifIslemTipi, loc, "", 0, "");
                }
            } else {
                alert(`🚨 GÜVENLİK İHLALİ!\n\nSeçtiğiniz şubeden çok uzaktasınız.\nMevcut Mesafe: ${Math.round(dist)}m.\nİzin Verilen: ${MAKSIMUM_MESAFE_METRE}m.`);
            }
        }, () => {
            document.getElementById('loading-overlay')?.classList.add('hidden');
            alert("Konum alınamadı! Lütfen cihazınızın Konum (GPS) özelliğinin açık olduğundan emin olun.");
        }, { enableHighAccuracy: true, timeout: 10000 });
    } else {
        document.getElementById('loading-overlay')?.classList.add('hidden');
        alert("Cihazınız konum algılamayı desteklemiyor.");
    }
};

const veritabaninaYaz = async (tip, loc, islem, fark, not) => {
    const p = auth.currentUser.email.split('@')[0];
    const isim = ismeCevir(p);
    const v = { personel_tel: p, islem_tipi: tip, tarih_saat: serverTimestamp(), lokasyon: loc };
    let uyari = "";
    if (islem === "Gecikme") { v.islem_notu = not || "Mazeret yok"; v.durum_etiketi = "Geç Kaldı"; uyari = `\n\n🚨 ${isim}, ${fark} dk gecikme kaydedildi.`; }
    else if (islem === "Erken Cikis") { v.islem_notu = not || "Mazeret yok"; v.durum_etiketi = "Erken Çıktı"; uyari = `\n\n⚠️ ${isim}, ${fark} dk erken çıkış kaydedildi.`; }

    try {
        await addDoc(collection(db, "hareketler"), v);
        alert(`✅ ${loc} bölgesinde ${tip} İşlemi Başarılı!${uyari}`);
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

// ================= RAPOR MANTIĞI =================
window.raporVerileriniGetir = async () => {
    const dateStr = document.getElementById('report-date-input')?.value;
    const onlyLate = document.getElementById('only-late-checkbox')?.checked;
    if(!dateStr) return alert("Tarih seçin!");

    const container = document.getElementById('reports-list-container');
    if(container) container.innerHTML = '<div class="text-center py-10 text-slate-400 font-bold"><i class="fas fa-sync fa-spin mr-3 text-emerald-500"></i>Veriler Çekiliyor...</div>';

    const formattedDate = dateStr.split('-').reverse().join('.');

    try {
        const snap = await getDocs(collection(db, "hareketler"));
        let raporlar = [];
        snap.forEach(doc => {
            const d = doc.data();
            if(!d.tarih_saat) return;
            const tStr = d.tarih_saat.toDate().toLocaleDateString('tr-TR');
            if(tStr === formattedDate) {
                if(onlyLate && d.durum_etiketi !== "Geç Kaldı") return;
                raporlar.push(d);
            }
        });

        raporlar.sort((a,b) => b.tarih_saat.toMillis() - a.tarih_saat.toMillis());

        let html = "";
        if(raporlar.length === 0) {
            html = '<div class="text-center py-10 text-slate-400 font-bold italic">Bu tarihte kayıt bulunamadı.</div>';
        } else {
            raporlar.forEach(r => {
                const saat = r.tarih_saat.toDate().toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'});
                const isLate = r.durum_etiketi === "Geç Kaldı";
                const isEarly = r.durum_etiketi === "Erken Çıktı";
                const color = isLate ? "border-red-500" : (isEarly ? "border-orange-500" : "border-emerald-500");
                const bg = isLate ? "bg-red-50/50" : (isEarly ? "bg-orange-50/50" : "bg-white");
                
                html += `
                <div class="p-5 rounded-[2rem] shadow-sm border-l-8 ${color} ${bg} transition-all mb-4">
                    <div class="flex justify-between items-start mb-2">
                        <div><h4 class="font-black text-brand-navy text-sm">${ismeCevir(r.personel_tel)}</h4><span class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${r.lokasyon}</span></div>
                        <span class="text-[10px] font-black px-2 py-1 rounded bg-slate-100">${r.islem_tipi}</span>
                    </div>
                    <div class="flex justify-between items-center mt-3">
                        <div class="flex items-center gap-2"><i class="far fa-clock text-slate-400 text-xs"></i><span class="font-black text-slate-800 text-sm">${saat}</span></div>
                        <span class="text-[10px] font-black italic ${isLate ? 'text-red-500' : 'text-emerald-500'}">${r.durum_etiketi || 'Zamanında'}</span>
                    </div>
                    ${r.islem_notu ? `<div class="mt-3 p-3 bg-white/60 rounded-xl text-[10px] text-slate-500 border border-slate-100 leading-relaxed italic"><strong class="text-slate-700">Mazeret:</strong> ${r.islem_notu}</div>` : ''}
                </div>`;
            });
        }
        if(container) container.innerHTML = html;
    } catch(e) { if(container) container.innerHTML = '<div class="text-red-500 font-bold">Hata oluştu!</div>'; }
};

// ================= İZİN YÖNETİMİ =================
window.izinPlanlamaAc = () => { 
    document.getElementById('sidebar')?.classList.add('-translate-x-full'); 
    document.getElementById('sidebar-overlay')?.classList.add('hidden'); 
    document.getElementById('leave-modal')?.classList.remove('hidden'); 
    const ps = document.getElementById('leave-person-select'); 
    if(ps) {
        ps.innerHTML = ""; 
        for(let t in personelRehberi) ps.innerHTML += `<option value="${t}">${personelRehberi[t]}</option>`; 
    }
};

window.togglePersonSelect = () => { 
    document.getElementById('leave-person-container')?.classList.toggle('hidden', document.getElementById('leave-target-type')?.value === "Tümü"); 
};

document.getElementById('save-leave-btn')?.addEventListener('click', async () => { 
    const baslangic = document.getElementById('leave-start-date')?.value;
    const bitis = document.getElementById('leave-end-date')?.value;
    const tur = document.getElementById('leave-target-type')?.value;
    
    if (!baslangic || !bitis) return alert("Lütfen tarihleri seçin!");
    if (new Date(baslangic) > new Date(bitis)) return alert("Bitiş, başlangıçtan önce olamaz!");

    let hedef = tur === "Kişi Seç" ? document.getElementById('leave-person-select')?.value : "Tümü";
    const btn = document.getElementById('save-leave-btn');
    const oldText = btn ? btn.innerText : ''; 
    if(btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        await addDoc(collection(db, "izinler"), {
            baslangic_tarihi: baslangic, bitis_tarihi: bitis, izin_hedefi: hedef, isleyen_yonetici: auth.currentUser.email.split('@')[0], olusturulma: serverTimestamp()
        });
        if(btn) btn.innerHTML = oldText; 
        alert(`✅ İzin başarıyla oluşturuldu!`);
        document.getElementById('leave-modal')?.classList.add('hidden');
        if(leavesScreen?.classList.contains('active')) window.planlananIzinleriAc(); 
    } catch (e) { if(btn) btn.innerHTML = oldText; alert("Hata: İzin kaydedilemedi."); }
});

window.raporEkraniAc = () => {
    document.getElementById('sidebar')?.classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay')?.classList.add('hidden');
    adminDashboardScreen?.classList.remove('active');
    reportsScreen?.classList.add('active');
    if(document.getElementById('report-date-input')) document.getElementById('report-date-input').valueAsDate = new Date();
    history.pushState({ ekran: 'raporlar' }, '', '#raporlar');
};

window.planlananIzinleriAc = async () => {
    document.getElementById('sidebar')?.classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay')?.classList.add('hidden');
    adminDashboardScreen?.classList.remove('active');
    leavesScreen?.classList.add('active');
    history.pushState({ ekran: 'izinler' }, '', '#izinler');

    const container = document.getElementById('leaves-list-container');
    if(container) container.innerHTML = '<div class="text-center py-10 text-slate-400"><i class="fas fa-spinner fa-spin text-3xl mb-3"></i><br>Yükleniyor...</div>';

    try {
        const snap = await getDocs(query(collection(db, "izinler")));
        let izinler = [];
        snap.forEach(doc => izinler.push({id: doc.id, ...doc.data()}));
        izinler.sort((a,b) => new Date(b.baslangic_tarihi) - new Date(a.baslangic_tarihi));

        let html = "";
        if(izinler.length === 0) {
            html = `<div class="text-center py-10 text-slate-400 font-medium"><i class="fas fa-calendar-times text-3xl mb-3 opacity-50 block"></i>Planlanmış izin bulunmuyor.</div>`;
        } else {
            izinler.forEach(izin => {
                let isTumu = izin.izin_hedefi === "Tümü";
                let hedefMetin = isTumu ? "🏢 Tüm Şirket Tatili" : `👤 ${ismeCevir(izin.izin_hedefi)}`;
                let bgColor = isTumu ? "bg-blue-50 border-blue-500" : "bg-white border-brand-orange";
                const trTarihFormat = (t) => t.split('-').reverse().join('.');

                html += `
                <div class="p-5 rounded-[2rem] shadow-sm border-l-4 ${bgColor} relative overflow-hidden mb-3">
                    <div class="flex justify-between items-start mb-2"><h4 class="font-bold text-brand-navy text-base leading-tight">${hedefMetin}</h4></div>
                    <div class="flex items-center text-sm text-slate-600 font-medium mt-3 bg-white/60 p-2 rounded-lg border border-slate-100">
                        <i class="far fa-calendar-alt text-blue-500 mr-2"></i> ${trTarihFormat(izin.baslangic_tarihi)} - ${trTarihFormat(izin.bitis_tarihi)}
                    </div>
                </div>`;
            });
        }
        if(container) container.innerHTML = html;
    } catch(e) { if(container) container.innerHTML = `<p class="text-red-500 text-center font-bold">Veriler çekilemedi.</p>`; }
};

window.detayAc = (k) => {
    document.getElementById('sidebar')?.classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay')?.classList.add('hidden');
    if(document.getElementById('detail-title')) document.getElementById('detail-title').innerText = k;
    adminDashboardScreen?.classList.remove('active');
    detailScreen?.classList.add('active');
    history.pushState({ ekran: 'detay' }, '', '#detay');
    
    const container = document.getElementById('detail-list-container');
    const filter = locationFilter?.value || "Tümü";
    let html = "";
    const bugun = new Date().toLocaleDateString('tr-TR');
    
    tumHareketlerCache.sort((a,b) => b.tarih_saat?.toMillis() - a.tarih_saat?.toMillis());
    tumHareketlerCache.forEach(v => {
        if(!v.tarih_saat) return;
        const tStr = v.tarih_saat.toDate().toLocaleDateString('tr-TR');
        if(tStr === bugun) {
            if(filter !== "Tümü" && v.lokasyon !== filter) return;
            if(k === "Geç Kalanlar" && v.durum_etiketi !== "Geç Kaldı") return;
            
            const saat = v.tarih_saat.toDate().toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'});
            let durumYazisi = "Zamanında"; let txtColor = "text-emerald-600"; let borderColor = "border-emerald-500";
            let isLate = v.durum_etiketi === "Geç Kaldı"; let isEarly = v.durum_etiketi === "Erken Çıktı";
            
            if (isLate) { durumYazisi = "Geç Kaldı"; txtColor = "text-red-500"; borderColor = "border-red-500"; }
            if (isEarly) { durumYazisi = "Erken Çıktı"; txtColor = "text-orange-500"; borderColor = "border-orange-500"; }

            let nedenHtml = "";
            if ((isLate || isEarly) && v.islem_notu) {
                let bgRenk = isLate ? "bg-red-50" : "bg-orange-50";
                nedenHtml = `<div class="mt-3 p-3 rounded-xl border-l-2 ${borderColor} ${bgRenk} text-xs text-slate-600 font-medium"><strong class="text-slate-800">Açıklama:</strong> ${v.islem_notu}</div>`;
            }

            html += `<div class="bg-white p-5 rounded-2xl shadow-sm border-l-4 ${borderColor} relative overflow-hidden mb-3">
                        <div class="flex justify-between items-start mb-2">
                            <div><h4 class="font-bold text-brand-navy text-base leading-tight">${ismeCevir(v.personel_tel)}</h4><span class="text-xs text-slate-400 font-medium">${v.lokasyon}</span></div>
                            <span class="font-bold text-sm ${txtColor}">${durumYazisi}</span>
                        </div>
                        <div class="flex justify-between items-end mt-1">
                            <div class="text-[11px] text-slate-400 font-medium">Tel: ${v.personel_tel}</div>
                            <div class="px-2 py-1 bg-slate-50 rounded-lg text-xs font-bold text-slate-600 border border-slate-100">${v.islem_tipi} <i class="fas fa-chevron-right text-[8px] mx-1 text-slate-400"></i> ${saat}</div>
                        </div>
                        ${nedenHtml}
                    </div>`;
        }
    });
    if(container) container.innerHTML = html || `<div class="text-center py-10 text-slate-400 font-medium"><i class="fas fa-folder-open text-3xl mb-3 opacity-50 block"></i>Kayıt bulunamadı.</div>`;
};

// ================= OTURUM VE EVENT BAĞLAMALARI =================
onAuthStateChanged(auth, (u) => {
    if (u) {
        loginScreen?.classList.remove('active');
        const p = u.email.split('@')[0];
        const isAdmin = ADMIN_PHONES.includes(p); 
        
        if(isAdmin) {
            if(document.getElementById('admin-welcome-text')) document.getElementById('admin-welcome-text').innerText = `Hoş geldin, ${ismeCevir(p)}`;
            adminDashboardScreen?.classList.add('active'); adminVerileriniHesapla(); arayuzDurumuGuncelle(p, true);
        } else {
            if(document.getElementById('welcome-text')) document.getElementById('welcome-text').innerText = `Hoş geldin, ${ismeCevir(p)}`;
            dashboardScreen?.classList.add('active'); arayuzDurumuGuncelle(p, false);
        }
    } else { 
        loginScreen?.classList.add('active'); 
        [adminDashboardScreen, dashboardScreen, reportsScreen, leavesScreen, detailScreen].forEach(s => s?.classList.remove('active')); 
    }
});

// Güvenli Tıklama Atamaları (Optional Chaining)
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
