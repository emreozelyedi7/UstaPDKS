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
const ADMIN_PHONE = "5324328072"; 

const personelRehberi = {
    "5324328072": "Emre Özel İş",
    "5419604133": "Emre Özel"
};

const ismeCevir = (telefonNumarasi) => { return personelRehberi[telefonNumarasi] || telefonNumarasi; };

const gecerliKarekodlar = { "qr_pendik": "Pendik Şube", "qr_atolye": "Atölye" };
const subeKonumlari = {
    "Pendik Şube": { lat: 40.899520532909584, lng: 29.258524165071616 }, 
    "Atölye": { lat: 40.899520532909584, lng: 29.258524165071616 }      
};
const MAKSIMUM_MESAFE_METRE = 150; 

const mesafeHesapla = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; 
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
};

// ================= EKRAN YÖNETİMİ & SIDEBAR =================
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const adminDashboardScreen = document.getElementById('admin-dashboard-screen');
const detailScreen = document.getElementById('detail-screen');
const leavesScreen = document.getElementById('leaves-screen');
const locationFilter = document.getElementById('location-filter');
let tumHareketlerCache = [];

window.toggleSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    }
};

window.anaEkranaDon = () => {
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.add('hidden');
    detailScreen.classList.remove('active');
    leavesScreen.classList.remove('active');
    adminDashboardScreen.classList.add('active');
};

window.addEventListener('popstate', (e) => {
    anaEkranaDon();
});

// ================= YÖNETİCİ VE PERSONEL GÖRÜNÜMÜ =================
const adminVerileriniHesapla = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "hareketler"));
        tumHareketlerCache = [];
        querySnapshot.forEach(doc => tumHareketlerCache.push(doc.data()));
        const bugun = new Date().toLocaleDateString('tr-TR');
        const seciliSube = locationFilter.value;
        let bugunGelenler = new Set();
        let bugunGecKalanlar = new Set();
        
        tumHareketlerCache.forEach(veri => {
            if(!veri.tarih_saat) return;
            if(seciliSube !== "Tümü" && veri.lokasyon !== seciliSube) return;
            const tarih = veri.tarih_saat.toDate();
            if(tarih.toLocaleDateString('tr-TR') === bugun && veri.islem_tipi === "Giriş") {
                bugunGelenler.add(veri.personel_tel);
                if(tarih.getHours() > 9 || (tarih.getHours() === 9 && tarih.getMinutes() > 0)) {
                    bugunGecKalanlar.add(veri.personel_tel);
                }
            }
        });
        document.getElementById('count-gelenler').innerText = bugunGelenler.size;
        document.getElementById('count-geckalanlar').innerText = bugunGecKalanlar.size;
    } catch (e) { console.log(e); }
};

const arayuzDurumuGuncelle = async (phone, isAdmin) => {
    const q = query(collection(db, "hareketler"), where("personel_tel", "==", phone));
    const snapshot = await getDocs(q);
    let son = "Çıkış";
    
    if (!snapshot.empty) {
        let docs = []; snapshot.forEach(d => push(d.data()));
        docs.sort((a,b) => (b.tarih_saat?.toMillis() || 0) - (a.tarih_saat?.toMillis() || 0));
        
        const sonKayit = docs[0];
        const bugunTarihStr = new Date().toLocaleDateString('tr-TR');
        const kayitTarihiStr = sonKayit.tarih_saat ? sonKayit.tarih_saat.toDate().toLocaleDateString('tr-TR') : bugunTarihStr;

        if (sonKayit.islem_tipi === "Giriş") {
            if (kayitTarihiStr === bugunTarihStr) { son = "Giriş"; } else { son = "Çıkış"; }
        } else { son = "Çıkış"; }
    }
    
    const prefix = isAdmin ? 'admin-' : '';
    const btnGiris = document.getElementById(`${prefix}btn-giris`);
    const btnCikis = document.getElementById(`${prefix}btn-cikis`);
    const badge = document.getElementById(`${prefix}status-badge`);

    if(son === "Giriş") {
        btnGiris.style.display="none"; btnCikis.style.display= isAdmin ? "flex" : "flex";
        badge.innerText="MESAİDE"; 
        badge.className="inline-block mt-2 px-4 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200";
    } else {
        btnGiris.style.display= isAdmin ? "flex" : "flex"; btnCikis.style.display="none";
        badge.innerText="MESAİ DIŞI"; 
        badge.className="inline-block mt-2 px-4 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-600 border border-red-200";
    }
};

// ================= KAYIT İŞLEMİ =================
let beklemedekiKayıt = null; 

const veritabaninaYaz = async (tip, gercekKonum, islemTuru, farkDakika, islemNotu) => {
    const user = auth.currentUser;
    const phone = user.email.split('@')[0];
    const isim = ismeCevir(phone); 
    
    const kaydedilecekVeri = {
        personel_tel: phone, islem_tipi: tip, tarih_saat: serverTimestamp(), lokasyon: gercekKonum
    };

    let sonUyari = "";
    if (islemTuru === "Gecikme") {
        kaydedilecekVeri.islem_notu = islemNotu || "Nedeni belirtilmedi";
        kaydedilecekVeri.durum_etiketi = "Geç Kaldı";
        sonUyari = `\n\n🚨 Sayın ${isim}, kaydınız ${farkDakika} dakika gecikmeli olarak işlendi.`;
    } else if (islemTuru === "Erken Cikis") {
        kaydedilecekVeri.islem_notu = islemNotu || "Nedeni belirtilmedi";
        kaydedilecekVeri.durum_etiketi = "Erken Çıktı";
        sonUyari = `\n\n⚠️ Sayın ${isim}, kaydınız ${farkDakika} dakika erken çıkış olarak işlendi.`;
    }

    try {
        await addDoc(collection(db, "hareketler"), kaydedilecekVeri);
        alert(`✅ ${gercekKonum} - ${tip} İşlemi Başarılı!${sonUyari}`);
        if(phone === ADMIN_PHONE) { arayuzDurumuGuncelle(phone, true); adminVerileriniHesapla(); } 
        else { arayuzDurumuGuncelle(phone, false); }
    } catch (e) { alert("Hata: Kayıt yapılamadı!"); }
};

document.getElementById('reason-submit-btn').addEventListener('click', () => {
    const reason = document.getElementById('reason-input').value.trim();
    document.getElementById('reason-modal').style.display = "none";
    if(beklemedekiKayıt) {
        veritabaninaYaz(beklemedekiKayıt.tip, beklemedekiKayıt.loc, beklemedekiKayıt.islemTuru, beklemedekiKayıt.farkDakika, reason);
        beklemedekiKayıt = null;
    }
});

document.getElementById('reason-skip-btn').addEventListener('click', () => {
    document.getElementById('reason-modal').style.display = "none";
    if(beklemedekiKayıt) {
        veritabaninaYaz(beklemedekiKayıt.tip, beklemedekiKayıt.loc, beklemedekiKayıt.islemTuru, beklemedekiKayıt.farkDakika, "");
        beklemedekiKayıt = null;
    }
});

// ================= KAMERA VE GPS KONTROLÜ =================
const cameraScreen = document.getElementById('camera-screen');
const html5QrCode = new Html5Qrcode("reader");
let islemDevamEdiyor = false;

const kamerayiAc = (tip) => {
    islemDevamEdiyor = false;
    cameraScreen.style.display = "flex";
    
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => {
        let code = text.trim();
        if(gecerliKarekodlar[code] && !islemDevamEdiyor) {
            islemDevamEdiyor = true;
            html5QrCode.stop().catch(()=>{}); 
            cameraScreen.style.display = "none";
            let loc = gecerliKarekodlar[code];

            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const aradakiMesafe = mesafeHesapla(position.coords.latitude, position.coords.longitude, subeKonumlari[loc].lat, subeKonumlari[loc].lng);
                        if (aradakiMesafe <= MAKSIMUM_MESAFE_METRE) {
                            const simdi = new Date();
                            const suanSaat = simdi.getHours(); const suanDakika = simdi.getMinutes();
                            let islemTuru = ""; let farkDakika = 0;

                            if (tip === "Giriş" && (suanSaat > 9 || (suanSaat === 9 && suanDakika > 0))) {
                                islemTuru = "Gecikme"; farkDakika = (suanSaat * 60 + suanDakika) - (9 * 60);
                            } else if (tip === "Çıkış" && suanSaat < 18) {
                                islemTuru = "Erken Cikis"; farkDakika = (18 * 60) - (suanSaat * 60 + suanDakika);
                            }

                            const phone = auth.currentUser.email.split('@')[0];
                            const isim = ismeCevir(phone);

                            if (islemTuru !== "") {
                                beklemedekiKayıt = { tip, loc, islemTuru, farkDakika };
                                document.getElementById('reason-input').value = ""; 
                                if (islemTuru === "Gecikme") {
                                    document.getElementById('reason-icon').className = "fas fa-clock text-red-500";
                                    document.getElementById('reason-title').innerText = "Gecikme Bildirimi";
                                    document.getElementById('reason-text').innerText = `Sayın ${isim}, mesaiye ${farkDakika} dakika geç kaldınız. Lütfen geç kalma nedeninizi belirtiniz.`;
                                } else {
                                    document.getElementById('reason-icon').className = "fas fa-door-open text-brand-orange";
                                    document.getElementById('reason-title').innerText = "Erken Çıkış Bildirimi";
                                    document.getElementById('reason-text').innerText = `Sayın ${isim}, mesai bitişinden ${farkDakika} dakika önce çıkış yapıyorsunuz. Lütfen nedenini belirtin.`;
                                }
                                document.getElementById('reason-modal').style.display = "flex";
                            } else {
                                veritabaninaYaz(tip, loc, "", 0, "");
                            }
                        } else {
                            alert(`🚨 GÜVENLİK İHLALİ!\n\nŞubeden çok uzaktasınız.\nMevcut Mesafe: ${Math.round(aradakiMesafe)} m.\nİzin Verilen: ${MAKSIMUM_MESAFE_METRE} m.`);
                        }
                    },
                    (error) => { alert("Konum alınamadı! GPS özelliğinin açık olduğundan emin olun."); },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            } else { alert("Telefonunuz konum özelliğini desteklemiyor."); }
        } else if (!gecerliKarekodlar[code] && !islemDevamEdiyor) { alert("Geçersiz QR Kod!"); }
    }, () => {}).catch(() => { alert("Kamera izni verin!"); cameraScreen.style.display = "none"; });
};

// ================= EVENT LISTENER'LAR =================
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.classList.remove('active');
        const p = user.email.split('@')[0];
        const isim = ismeCevir(p); 
        if(p === ADMIN_PHONE) {
            document.getElementById('admin-welcome-text').innerText = `Hoş geldin, ${isim}`;
            adminDashboardScreen.classList.add('active');
            adminVerileriniHesapla(); arayuzDurumuGuncelle(p, true);
        } else {
            document.getElementById('welcome-text').innerText = `Hoş geldin, ${isim}`;
            dashboardScreen.classList.add('active');
            arayuzDurumuGuncelle(p, false);
        }
    } else {
        loginScreen.classList.add('active');
        adminDashboardScreen.classList.remove('active');
        dashboardScreen.classList.remove('active');
    }
});

document.getElementById('login-btn').addEventListener('click', () => {
    const p = document.getElementById('phone-input').value;
    const s = document.getElementById('password-input').value;
    if(!p || !s) return alert("Lütfen bilgileri girin!");
    const btn = document.getElementById('login-btn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; 
    signInWithEmailAndPassword(auth, `${p}@ustapdks.com`, s).catch(() => {
        btn.innerHTML = 'Giriş Yap'; alert("Hatalı Giriş!");
    });
});

const cikisYap = () => signOut(auth);
document.getElementById('logout-btn').addEventListener('click', cikisYap);
document.getElementById('sidebar-logout-btn').addEventListener('click', cikisYap);
document.getElementById('btn-giris').addEventListener('click', () => kamerayiAc("Giriş"));
document.getElementById('btn-cikis').addEventListener('click', () => kamerayiAc("Çıkış"));
document.getElementById('admin-btn-giris').addEventListener('click', () => kamerayiAc("Giriş"));
document.getElementById('admin-btn-cikis').addEventListener('click', () => kamerayiAc("Çıkış"));
document.getElementById('cancel-camera-btn').addEventListener('click', () => { islemDevamEdiyor = true; html5QrCode.stop().then(() => cameraScreen.style.display = "none"); });
locationFilter.addEventListener('change', adminVerileriniHesapla);

window.detayAc = (kategori) => {
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.add('hidden');
    document.getElementById('detail-title').innerText = kategori;
    adminDashboardScreen.classList.remove('active');
    leavesScreen.classList.remove('active');
    detailScreen.classList.add('active');
    history.pushState({ ekran: 'detay' }, '', '#detay');
    
    const container = document.getElementById('detail-list-container');
    const seciliSube = locationFilter.value;
    let html = "";
    const bugun = new Date().toLocaleDateString('tr-TR');
    
    tumHareketlerCache.sort((a, b) => (b.tarih_saat?.toMillis() || 0) - (a.tarih_saat?.toMillis() || 0));
    tumHareketlerCache.forEach(veri => {
        if(!veri.tarih_saat) return;
        if(seciliSube !== "Tümü" && veri.lokasyon !== seciliSube) return;
        const tarih = veri.tarih_saat.toDate();
        if(tarih.toLocaleDateString('tr-TR') === bugun) {
            let isLate = (veri.durum_etiketi === "Geç Kaldı");
            let isEarly = (veri.durum_etiketi === "Erken Çıktı");
            if(kategori === "Geç Kalanlar" && !isLate) return;
            const saatStr = tarih.getHours().toString().padStart(2, '0') + ":" + tarih.getMinutes().toString().padStart(2, '0');
            
            let durumYazisi = "Zamanında"; let txtColor = "text-emerald-600"; let borderColor = "border-emerald-500";
            if (isLate) { durumYazisi = "Geç Kaldı"; txtColor = "text-red-500"; borderColor = "border-red-500"; }
            if (isEarly) { durumYazisi = "Erken Çıktı"; txtColor = "text-orange-500"; borderColor = "border-orange-500"; }

            let nedenHtml = "";
            if ((isLate || isEarly) && veri.islem_notu) {
                let bgRenk = isLate ? "bg-red-50" : "bg-orange-50";
                nedenHtml = `<div class="mt-3 p-3 rounded-xl border-l-2 ${borderColor} ${bgRenk} text-xs text-slate-600 font-medium"><strong class="text-slate-800">Açıklama:</strong> ${veri.islem_notu}</div>`;
            }

            let gosterilecekIsim = ismeCevir(veri.personel_tel);
            html += `<div class="bg-white p-5 rounded-2xl shadow-sm border-l-4 ${borderColor} relative overflow-hidden">
                        <div class="flex justify-between items-start mb-2">
                            <div><h4 class="font-bold text-brand-navy text-base leading-tight">${gosterilecekIsim}</h4><span class="text-xs text-slate-400 font-medium">${veri.lokasyon}</span></div>
                            <span class="font-bold text-sm ${txtColor}">${durumYazisi}</span>
                        </div>
                        <div class="flex justify-between items-end mt-1">
                            <div class="text-[11px] text-slate-400 font-medium">Tel: ${veri.personel_tel}</div>
                            <div class="px-2 py-1 bg-slate-50 rounded-lg text-xs font-bold text-slate-600 border border-slate-100">${veri.islem_tipi} <i class="fas fa-chevron-right text-[8px] mx-1 text-slate-400"></i> ${saatStr}</div>
                        </div>
                        ${nedenHtml}
                    </div>`;
        }
    });
    container.innerHTML = html || `<div class="text-center py-10 text-slate-400 font-medium"><i class="fas fa-folder-open text-3xl mb-3 opacity-50 block"></i>Kayıt bulunamadı.</div>`;
};

// ================= İZİN PLANLAMA VE LİSTELEME =================
window.izinPlanlamaAc = () => {
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.add('hidden');
    document.getElementById('leave-modal').style.display = 'flex';
    document.getElementById('leave-start-date').value = "";
    document.getElementById('leave-end-date').value = "";
    document.getElementById('leave-target-type').value = "Tümü";
    document.getElementById('leave-person-container').style.display = 'none';

    const personSelect = document.getElementById('leave-person-select');
    personSelect.innerHTML = "";
    for (let tel in personelRehberi) { personSelect.innerHTML += `<option value="${tel}">${personelRehberi[tel]} (${tel})</option>`; }
};

window.togglePersonSelect = () => {
    document.getElementById('leave-person-container').style.display = document.getElementById('leave-target-type').value === "Kişi Seç" ? "block" : "none";
};

document.getElementById('save-leave-btn').addEventListener('click', async () => {
    const baslangic = document.getElementById('leave-start-date').value;
    const bitis = document.getElementById('leave-end-date').value;
    const tur = document.getElementById('leave-target-type').value;
    
    if (!baslangic || !bitis) return alert("Lütfen tarihleri seçin!");
    if (new Date(baslangic) > new Date(bitis)) return alert("Bitiş, başlangıçtan önce olamaz!");

    let hedef = tur === "Kişi Seç" ? document.getElementById('leave-person-select').value : "Tümü";
    const btn = document.getElementById('save-leave-btn');
    const oldText = btn.innerText; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        await addDoc(collection(db, "izinler"), {
            baslangic_tarihi: baslangic, bitis_tarihi: bitis, izin_hedefi: hedef, isleyen_yonetici: auth.currentUser.email.split('@')[0], olusturulma: serverTimestamp()
        });
        btn.innerHTML = oldText; alert(`✅ İzin başarıyla oluşturuldu!`);
        document.getElementById('leave-modal').style.display = 'none';
        if(leavesScreen.classList.contains('active')) window.planlananIzinleriAc(); // Eğer liste ekranındaysa yenile
    } catch (e) { btn.innerHTML = oldText; alert("Hata: İzin kaydedilemedi."); }
});

// YENİ: Firebase'den izinleri çekip ekrana basma
window.planlananIzinleriAc = async () => {
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.add('hidden');
    adminDashboardScreen.classList.remove('active');
    detailScreen.classList.remove('active');
    leavesScreen.classList.add('active');
    history.pushState({ ekran: 'izinler' }, '', '#izinler');

    const container = document.getElementById('leaves-list-container');
    container.innerHTML = '<div class="text-center py-10 text-slate-400"><i class="fas fa-spinner fa-spin text-3xl mb-3"></i><br>Yükleniyor...</div>';

    try {
        const snap = await getDocs(query(collection(db, "izinler")));
        let izinler = [];
        snap.forEach(doc => izinler.push({id: doc.id, ...doc.data()}));
        
        // Yeniden eskiye sırala
        izinler.sort((a,b) => new Date(b.baslangic_tarihi) - new Date(a.baslangic_tarihi));

        let html = "";
        if(izinler.length === 0) {
            html = `<div class="text-center py-10 text-slate-400 font-medium"><i class="fas fa-calendar-times text-3xl mb-3 opacity-50 block"></i>Planlanmış izin bulunmuyor.</div>`;
        } else {
            izinler.forEach(izin => {
                let isTumu = izin.izin_hedefi === "Tümü";
                let hedefMetin = isTumu ? "🏢 Tüm Şirket Tatili" : `👤 ${ismeCevir(izin.izin_hedefi)}`;
                let bgColor = isTumu ? "bg-blue-50 border-blue-500" : "bg-white border-brand-orange";
                
                // Tarih formatını güzelleştirme (YYYY-MM-DD -> DD.MM.YYYY)
                const trTarihFormat = (t) => t.split('-').reverse().join('.');

                html += `
                <div class="p-5 rounded-2xl shadow-sm border-l-4 ${bgColor} relative overflow-hidden">
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="font-bold text-brand-navy text-base leading-tight">${hedefMetin}</h4>
                    </div>
                    <div class="flex items-center text-sm text-slate-600 font-medium mt-3 bg-white/60 p-2 rounded-lg border border-slate-100">
                        <i class="far fa-calendar-alt text-blue-500 mr-2"></i> ${trTarihFormat(izin.baslangic_tarihi)} - ${trTarihFormat(izin.bitis_tarihi)}
                    </div>
                </div>`;
            });
        }
        container.innerHTML = html;
    } catch(e) {
        container.innerHTML = `<p class="text-red-500 text-center font-bold">Veriler çekilemedi.</p>`;
    }
};
