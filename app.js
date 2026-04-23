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

// --- YÖNETİCİ AYARI ---
const ADMIN_PHONE = "5324328072"; 

// GEÇERLİ ŞUBELER
const gecerliKarekodlar = {
    "qr_pendik": "Pendik Şube",
    "qr_atolye": "Atölye"
};

const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const adminDashboardScreen = document.getElementById('admin-dashboard-screen');
const detailScreen = document.getElementById('detail-screen');
const locationFilter = document.getElementById('location-filter');

let tumHareketlerCache = [];

// ================= SAĞA KAYDIRARAK GERİ ÇIKMA KORUMASI =================
// Telefonun kendi geri tuşunu veya kaydırma hareketini yakalıyoruz
window.addEventListener('popstate', (e) => {
    if (detailScreen.classList.contains('active')) {
        // Eğer detay ekranındayken geri kaydırılırsa, sadece detayı kapat ana sayfaya dön
        detailScreen.classList.remove('active');
        adminDashboardScreen.classList.add('active');
    }
});

// Eski manuel ok butonumuzu da tarayıcının geri butonuna bağlıyoruz
document.getElementById('back-to-admin-dash').addEventListener('click', () => {
    history.back(); // Bu komut yukarıdaki popstate'i tetikler ve ekranı kapatır
});
// =========================================================================

// 1. DURUM GÜNCELLEME (ADMIN)
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

const adminArayuzuGuncelle = async (phone) => {
    const q = query(collection(db, "hareketler"), where("personel_tel", "==", phone));
    const snapshot = await getDocs(q);
    let son = "Çıkış";
    if (!snapshot.empty) {
        let docs = []; snapshot.forEach(d => docs.push(d.data()));
        docs.sort((a,b) => (b.tarih_saat?.toMillis() || 0) - (a.tarih_saat?.toMillis() || 0));
        son = docs[0].islem_tipi;
    }
    const adminBtnGiris = document.getElementById('admin-btn-giris');
    const adminBtnCikis = document.getElementById('admin-btn-cikis');
    const adminBadge = document.getElementById('admin-status-badge');
    if(son === "Giriş") {
        adminBtnGiris.style.display="none"; adminBtnCikis.style.display="flex";
        adminBadge.innerText="MESAİDE"; adminBadge.style.background="#D1FAE5"; adminBadge.style.color="#065F46";
    } else {
        adminBtnGiris.style.display="flex"; adminBtnCikis.style.display="none";
        adminBadge.innerText="MESAİ DIŞI"; adminBadge.style.background="#FEE2E2"; adminBadge.style.color="#991B1B";
    }
};

const personelArayuzuGuncelle = async (phone) => {
    const q = query(collection(db, "hareketler"), where("personel_tel", "==", phone));
    const snapshot = await getDocs(q);
    let son = "Çıkış";
    if (!snapshot.empty) {
        let docs = []; snapshot.forEach(d => docs.push(d.data()));
        docs.sort((a,b) => (b.tarih_saat?.toMillis() || 0) - (a.tarih_saat?.toMillis() || 0));
        son = docs[0].islem_tipi;
    }
    const badge = document.getElementById('status-badge');
    if(son === "Giriş") {
        document.getElementById('btn-giris').style.display="none"; document.getElementById('btn-cikis').style.display="block";
        badge.innerText="MESAİDE"; badge.style.background="#D1FAE5"; badge.style.color="#065F46";
    } else {
        document.getElementById('btn-giris').style.display="block"; document.getElementById('btn-cikis').style.display="none";
        badge.innerText="MESAİ DIŞI"; badge.style.background="#FEE2E2"; badge.style.color="#991B1B";
    }
};

// 2. VERİTABANINA YAZMA VE UYARI MANTIĞI
const veritabaninaYaz = async (tip, gercekKonum) => {
    const user = auth.currentUser;
    const simdi = new Date();
    const phone = user.email.split('@')[0];
    
    let uyarimesaji = "";
    if (tip === "Giriş") {
        const suanSaat = simdi.getHours();
        const suanDakika = simdi.getMinutes();
        
        // 09:00'dan sonraysa (09:01 ve sonrası)
        if (suanSaat > 9 || (suanSaat === 9 && suanDakika > 0)) {
            const toplamGecikme = (suanSaat * 60 + suanDakika) - (9 * 60);
            uyarimesaji = `\n\n🚨 Dikkat: 09:00 mesai başlangıcından ${toplamGecikme} dakika sonra giriş yaptınız. Kaydınız 'Gecikmeli' olarak işaretlendi. Mesai saatlerine hassasiyet göstermenizi rica ederiz.`;
        }
    }

    try {
        await addDoc(collection(db, "hareketler"), {
            personel_tel: phone,
            islem_tipi: tip,
            tarih_saat: serverTimestamp(),
            lokasyon: gercekKonum
        });
        
        alert(`✅ ${gercekKonum} - ${tip} İşlemi Başarılı!${uyarimesaji}`);
        
        if(phone === ADMIN_PHONE) {
            adminArayuzuGuncelle(phone);
            adminVerileriniHesapla();
        } else {
            personelArayuzuGuncelle(phone); 
        }
    } catch (e) { alert("Hata: Kayıt yapılamadı!"); }
};

// 3. KAMERA VE DİĞER İŞLEMLER
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
            cameraScreen.style.display = "none";
            let loc = gecerliKarekodlar[code];
            veritabaninaYaz(tip, loc);
            html5QrCode.stop().catch(()=>{});
        } else if (!gecerliKarekodlar[code] && !islemDevamEdiyor) {
            alert("Geçersiz QR Kod! Lütfen şubenize ait kodu okutun.");
        }
    }, () => {}).catch(() => { alert("Kamera izni verin!"); cameraScreen.style.display = "none"; });
};

// Olay Dinleyicileri
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.classList.remove('active');
        const p = user.email.split('@')[0];
        if(p === ADMIN_PHONE) {
            document.getElementById('admin-welcome-text').innerText = `Hoş geldin, ${p}`;
            adminDashboardScreen.classList.add('active');
            adminVerileriniHesapla(); adminArayuzuGuncelle(p);
        } else {
            document.getElementById('welcome-text').innerText = `Hoş geldin, ${p}`;
            dashboardScreen.classList.add('active');
            personelArayuzuGuncelle(p);
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
    signInWithEmailAndPassword(auth, `${p}@ustapdks.com`, s).catch(() => alert("Hatalı Giriş!"));
});
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
document.getElementById('admin-logout-btn').addEventListener('click', () => signOut(auth));
document.getElementById('btn-giris').addEventListener('click', () => kamerayiAc("Giriş"));
document.getElementById('btn-cikis').addEventListener('click', () => kamerayiAc("Çıkış"));
document.getElementById('admin-btn-giris').addEventListener('click', () => kamerayiAc("Giriş"));
document.getElementById('admin-btn-cikis').addEventListener('click', () => kamerayiAc("Çıkış"));
document.getElementById('cancel-camera-btn').addEventListener('click', () => {
    islemDevamEdiyor = true;
    html5QrCode.stop().then(() => cameraScreen.style.display = "none");
});
locationFilter.addEventListener('change', adminVerileriniHesapla);

// Pano Kartlarına Tıklama Mantığı
window.detayAc = (kategori) => {
    document.getElementById('detail-title').innerText = kategori;
    adminDashboardScreen.classList.remove('active');
    detailScreen.classList.add('active');
    
    // YENİ: Tarayıcıya sahte bir geçmiş ekliyoruz ki geri kaydırdığında ana sayfaya dönebilsin
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
        if(tarih.toLocaleDateString('tr-TR') === bugun && veri.islem_tipi === "Giriş") {
            let isLate = (tarih.getHours() > 9 || (tarih.getHours() === 9 && tarih.getMinutes() > 0));
            if(kategori === "Geç Kalanlar" && !isLate) return;
            const saatStr = tarih.getHours().toString().padStart(2, '0') + ":" + tarih.getMinutes().toString().padStart(2, '0');
            html += `<div class="list-item ${isLate ? 'late' : 'on-time'}">
                    <strong>${veri.personel_tel}</strong> <span style="font-size:11px; color:#888;">(${veri.lokasyon})</span><br>
                    <small>Giriş: ${saatStr}</small>
                    <span style="float:right; color:${isLate ? '#ef4444':'#10b981'}; font-weight:bold;">${isLate?'Geç':'Zamanında'}</span>
                </div>`;
        }
    });
    container.innerHTML = html || "<p>Kayıt bulunamadı.</p>";
};
