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

// AYARLAR
const ADMIN_PHONE = "5324328072"; 
const personelRehberi = { "5324328072": "Emre Özel İş", "5419604133": "Emre Özel" };
const ismeCevir = (tel) => personelRehberi[tel] || tel;
const gecerliKarekodlar = { "qr_pendik": "Pendik Şube", "qr_atolye": "Atölye" };
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

// EKRAN VE SIDEBAR YÖNETİMİ
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const adminDashboardScreen = document.getElementById('admin-dashboard-screen');
const detailScreen = document.getElementById('detail-screen');
const reportsScreen = document.getElementById('reports-screen');
const leavesScreen = document.getElementById('leaves-screen');
const locationFilter = document.getElementById('location-filter');
let tumHareketlerCache = [];

window.toggleSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
};

window.anaEkranaDon = () => {
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.add('hidden');
    [detailScreen, leavesScreen, reportsScreen].forEach(s => s.classList.remove('active'));
    adminDashboardScreen.classList.add('active');
};

window.raporEkraniAc = () => {
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.add('hidden');
    adminDashboardScreen.classList.remove('active');
    reportsScreen.classList.add('active');
    document.getElementById('report-date-input').valueAsDate = new Date();
};

window.addEventListener('popstate', anaEkranaDon);

// VERİ HESAPLAMA (GÜNCEL DURUM)
const adminVerileriniHesapla = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "hareketler"));
        tumHareketlerCache = [];
        querySnapshot.forEach(doc => tumHareketlerCache.push(doc.data()));
        const bugun = new Date().toLocaleDateString('tr-TR');
        const seciliSube = locationFilter.value;
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
        document.getElementById('count-gelenler').innerText = gelenler.size;
        document.getElementById('count-geckalanlar').innerText = gecenler.size;
    } catch (e) { console.log(e); }
};

const arayuzDurumuGuncelle = async (phone, isAdmin) => {
    const q = query(collection(db, "hareketler"), where("personel_tel", "==", phone));
    const snapshot = await getDocs(q);
    let son = "Çıkış";
    
    if (!snapshot.empty) {
        let docs = []; 
        snapshot.forEach(d => docs.push(d.data())); // DÜZELTİLDİ: docs.push
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

    if(son === "Giriş") {
        bG.style.display="none"; bC.style.display="flex";
        badge.innerText="MESAİDE"; badge.className="inline-block mt-2 px-4 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-widest";
    } else {
        bG.style.display="flex"; bC.style.display="none";
        badge.innerText="MESAİ DIŞI"; badge.className="inline-block mt-2 px-4 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-600 border border-red-200 uppercase tracking-widest";
    }
};

// KAYIT VE KAMERA
let beklemedekiK = null; 
const veritabaninaYaz = async (tip, loc, islem, fark, not) => {
    const p = auth.currentUser.email.split('@')[0];
    const isim = ismeCevir(p);
    const v = { personel_tel: p, islem_tipi: tip, tarih_saat: serverTimestamp(), lokasyon: loc };
    let uyari = "";
    if (islem === "Gecikme") { v.islem_notu = not || "Mazeret yok"; v.durum_etiketi = "Geç Kaldı"; uyari = `\n\n🚨 ${isim}, ${fark} dk gecikme kaydedildi.`; }
    else if (islem === "Erken Cikis") { v.islem_notu = not || "Mazeret yok"; v.durum_etiketi = "Erken Çıktı"; uyari = `\n\n⚠️ ${isim}, ${fark} dk erken çıkış kaydedildi.`; }

    try {
        await addDoc(collection(db, "hareketler"), v);
        alert(`✅ ${loc} - ${tip} Başarılı!${uyari}`);
        if(p === ADMIN_PHONE) { arayuzDurumuGuncelle(p, true); adminVerileriniHesapla(); } 
        else arayuzDurumuGuncelle(p, false);
    } catch (e) { alert("Kayıt hatası!"); }
};

document.getElementById('reason-submit-btn').addEventListener('click', () => {
    const r = document.getElementById('reason-input').value.trim();
    document.getElementById('reason-modal').classList.add('hidden');
    if(beklemedekiK) { veritabaninaYaz(beklemedekiK.tip, beklemedekiK.loc, beklemedekiK.islem, beklemedekiK.fark, r); beklemedekiK = null; }
});

document.getElementById('reason-skip-btn').addEventListener('click', () => {
    document.getElementById('reason-modal').classList.add('hidden');
    if(beklemedekiK) { veritabaninaYaz(beklemedekiK.tip, beklemedekiK.loc, beklemedekiK.islem, beklemedekiK.fark, ""); beklemedekiK = null; }
});

const kamerayiAc = (tip) => {
    const camS = document.getElementById('camera-screen'); camS.classList.remove('hidden');
    const scanner = new Html5Qrcode("reader");
    scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => {
        let code = text.trim();
        if(gecerliKarekodlar[code]) {
            scanner.stop(); camS.classList.add('hidden');
            let loc = gecerliKarekodlar[code];
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                    const dist = mesafeHesapla(pos.coords.latitude, pos.coords.longitude, subeKonumlari[loc].lat, subeKonumlari[loc].lng);
                    if (dist <= MAKSIMUM_MESAFE_METRE) {
                        const d = new Date(); const h = d.getHours(); const m = d.getMinutes();
                        let isl = ""; let frk = 0;
                        if (tip === "Giriş" && (h > 9 || (h === 9 && m > 0))) { isl = "Gecikme"; frk = (h * 60 + m) - 540; }
                        else if (tip === "Çıkış" && h < 18) { isl = "Erken Cikis"; frk = 1080 - (h * 60 + m); }
                        
                        if (isl !== "") {
                            beklemedekiK = { tip, loc, islem: isl, fark: frk };
                            document.getElementById('reason-input').value = "";
                            const rI = document.getElementById('reason-icon');
                            if(isl === "Gecikme") { rI.className="fas fa-clock text-red-500"; document.getElementById('reason-title').innerText="Gecikme Bildirimi"; document.getElementById('reason-text').innerText=`Sayın ${ismeCevir(auth.currentUser.email.split('@')[0])}, mesaiye ${frk} dk geç kaldınız. Nedeni nedir?`; }
                            else { rI.className="fas fa-door-open text-brand-orange"; document.getElementById('reason-title').innerText="Erken Çıkış Bildirimi"; document.getElementById('reason-text').innerText=`Sayın ${ismeCevir(auth.currentUser.email.split('@')[0])}, mesai bitişine ${frk} dk kala çıkış yapıyorsunuz. Nedeni nedir?`; }
                            document.getElementById('reason-modal').classList.remove('hidden');
                        } else veritabaninaYaz(tip, loc, "", 0, "");
                    } else alert(`Şubeden uzaktasınız: ${Math.round(dist)}m`);
                }, () => alert("Konum izni verin!"), { enableHighAccuracy: true });
            }
        }
    });
    document.getElementById('cancel-camera-btn').onclick = () => { scanner.stop(); camS.classList.add('hidden'); };
};

// RAPOR MANTIĞI (YENİ)
window.raporVerileriniGetir = async () => {
    const dateStr = document.getElementById('report-date-input').value;
    const onlyLate = document.getElementById('only-late-checkbox').checked;
    if(!dateStr) return alert("Tarih seçin!");

    const container = document.getElementById('reports-list-container');
    container.innerHTML = '<div class="text-center py-10 text-slate-400 font-bold"><i class="fas fa-sync fa-spin mr-3 text-emerald-500"></i>Veriler Çekiliyor...</div>';

    // HTML tarihini (YYYY-MM-DD) Firebase formatına (DD.MM.YYYY) çeviriyoruz
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
                <div class="p-5 rounded-[2rem] shadow-sm border-l-8 ${color} ${bg} transition-all">
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
        container.innerHTML = html;
    } catch(e) { container.innerHTML = '<div class="text-red-500 font-bold">Hata oluştu!</div>'; }
};

// OTURUM
onAuthStateChanged(auth, (u) => {
    if (u) {
        loginScreen.classList.remove('active');
        const p = u.email.split('@')[0];
        if(p === ADMIN_PHONE) {
            document.getElementById('admin-welcome-text').innerText = `Hoş geldin, ${ismeCevir(p)}`;
            adminDashboardScreen.classList.add('active'); adminVerileriniHesapla(); arayuzDurumuGuncelle(p, true);
        } else {
            document.getElementById('welcome-text').innerText = `Hoş geldin, ${ismeCevir(p)}`;
            dashboardScreen.classList.add('active'); arayuzDurumuGuncelle(p, false);
        }
    } else { loginScreen.classList.add('active'); [adminDashboardScreen, dashboardScreen, reportsScreen].forEach(s => s.classList.remove('active')); }
});

document.getElementById('login-btn').onclick = () => {
    const p = document.getElementById('phone-input').value; const s = document.getElementById('password-input').value;
    if(!p || !s) return alert("Bilgileri girin!");
    const b = document.getElementById('login-btn'); b.innerHTML='<i class="fas fa-spinner fa-spin"></i>';
    signInWithEmailAndPassword(auth, `${p}@ustapdks.com`, s).catch(() => { b.innerHTML='Giriş Yap'; alert("Hata!"); });
};

document.getElementById('logout-btn').onclick = () => signOut(auth);
document.getElementById('sidebar-logout-btn').onclick = () => signOut(auth);
document.getElementById('admin-logout-btn').onclick = () => signOut(auth);
document.getElementById('btn-giris').onclick = () => kamerayiAc("Giriş");
document.getElementById('btn-cikis').onclick = () => kamerayiAc("Çıkış");
document.getElementById('admin-btn-giris').onclick = () => kamerayiAc("Giriş");
document.getElementById('admin-btn-cikis').onclick = () => kamerayiAc("Çıkış");
locationFilter.onchange = adminVerileriniHesapla;

// İZİN VE DİĞER (Önceki mantık korundu)
window.izinPlanlamaAc = () => { document.getElementById('sidebar').classList.add('-translate-x-full'); document.getElementById('sidebar-overlay').classList.add('hidden'); document.getElementById('leave-modal').classList.remove('hidden'); const ps = document.getElementById('leave-person-select'); ps.innerHTML = ""; for(let t in personelRehberi) ps.innerHTML += `<option value="${t}">${personelRehberi[t]}</option>`; };
window.togglePersonSelect = () => { document.getElementById('leave-person-container').classList.toggle('hidden', document.getElementById('leave-target-type').value === "Tümü"); };
document.getElementById('save-leave-btn').onclick = async () => { /* İzin kaydetme kodun buraya */ };
window.planlananIzinleriAc = async () => { /* İzin listeleme kodun buraya */ };

// DETAY AÇMA
window.detayAc = (k) => {
    document.getElementById('detail-title').innerText = k;
    adminDashboardScreen.classList.remove('active');
    detailScreen.classList.add('active');
    const container = document.getElementById('detail-list-container');
    const filter = locationFilter.value;
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
            html += `<div class="p-5 bg-white rounded-2xl shadow-sm border-l-4 border-slate-200">
                <div class="flex justify-between items-center mb-1"><h4 class="font-black text-sm">${ismeCevir(v.personel_tel)}</h4><span class="text-[9px] font-bold px-2 py-1 bg-slate-50 rounded">${v.islem_tipi}</span></div>
                <div class="flex justify-between items-end"><span class="text-[10px] text-slate-400">${v.lokasyon}</span><span class="font-black text-xs">${saat}</span></div>
            </div>`;
        }
    });
    container.innerHTML = html || "Kayıt yok.";
};
