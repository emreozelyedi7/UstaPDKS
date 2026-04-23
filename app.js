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

// YÖNETİCİ NUMARASI BURAYA (Kendi numaranı yaz)
const ADMIN_PHONE = "5324328072"; 

// SADECE BU ŞUBELER GEÇERLİ OLACAK (Merkez İptal)
const gecerliKarekodlar = {
    "qr_pendik": "Pendik Şube",
    "qr_atolye": "Atölye"
};

// Ekranlar
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const adminDashboardScreen = document.getElementById('admin-dashboard-screen');
const detailScreen = document.getElementById('detail-screen');
const locationFilter = document.getElementById('location-filter');

let tumHareketlerCache = [];

// ================= YÖNETİCİ BÖLÜMÜ =================

// Yöneticinin kendi butonlarını kontrol eden fonksiyon
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

// Pano Rakamlarını Hesaplama
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

locationFilter.addEventListener('change', adminVerileriniHesapla);

window.detayAc = (kategori) => {
    document.getElementById('detail-title').innerText = kategori;
    adminDashboardScreen.classList.remove('active');
    detailScreen.classList.add('active');
    
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
            html += `
                <div class="list-item ${isLate ? 'late' : 'on-time'}">
                    <strong>${veri.personel_tel}</strong> <span style="font-size:11px; color:#888;">(${veri.lokasyon})</span><br>
                    <small>Giriş: ${saatStr}</small>
                    <span style="float:right; color:${isLate ? '#ef4444':'#10b981'}; font-weight:bold;">${isLate?'Geç':'Zamanında'}</span>
                </div>`;
        }
    });
    container.innerHTML = html || "<p>Kayıt bulunamadı.</p>";
};

document.getElementById('back-to-admin-dash').addEventListener('click', () => {
    detailScreen.classList.remove('active'); adminDashboardScreen.classList.add('active');
});

// ================= PERSONEL BÖLÜMÜ =================
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
    const btnGiris = document.getElementById('btn-giris');
    const btnCikis = document.getElementById('btn-cikis');

    if(son === "Giriş") {
        btnGiris.style.display="none"; btnCikis.style.display="block";
        badge.innerText="MESAİDE"; badge.style.background="#D1FAE5"; badge.style.color="#065F46";
    } else {
        btnGiris.style.display="block"; btnCikis.style.display="none";
        badge.innerText="MESAİ DIŞI"; badge.style.background="#FEE2E2"; badge.style.color="#991B1B";
    }
};

// ================= ORTAK İŞLEMLER VE KAMERA =================
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.classList.remove('active');
        const phone = user.email.split('@')[0];
        
        // Kim Girdi? Yönetici mi Personel mi?
        if(phone === ADMIN_PHONE) {
            document.getElementById('admin-welcome-text').innerText = `Hoş geldin, ${phone}`;
            adminDashboardScreen.classList.add('active');
            adminVerileriniHesapla();
            adminArayuzuGuncelle(phone); // Yöneticinin butonlarını güncelle
        } else {
            document.getElementById('welcome-text').innerText = `Hoş geldin, ${phone}`;
            dashboardScreen.classList.add('active');
            personelArayuzuGuncelle(phone);
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

// KAMERA & ŞUBE ALGILAMA
const cameraScreen = document.getElementById('camera-screen');
const html5QrCode = new Html5Qrcode("reader");
let islemDevamEdiyor = false;

const kamerayiAc = (tip) => {
    islemDevamEdiyor = false; 
    cameraScreen.style.display = "flex";
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => {
        let okunanSifre = text.trim();
        
        if(gecerliKarekodlar[okunanSifre] && !islemDevamEdiyor) {
            islemDevamEdiyor = true;
            cameraScreen.style.display = "none";
            
            let gercekKonum = gecerliKarekodlar[okunanSifre];
            const currentUserPhone = auth.currentUser.email.split('@')[0];
            
            addDoc(collection(db, "hareketler"), {
                personel_tel: currentUserPhone,
                islem_tipi: tip, 
                tarih_saat: serverTimestamp(), 
                lokasyon: gercekKonum 
            }).then(() => { 
                alert(`✅ ${gercekKonum} - ${tip} İşlemi Başarılı!`); 
                
                // İşlem bitince kimin arayüzü güncellenecek kontrol et
                if(currentUserPhone === ADMIN_PHONE) {
                    adminArayuzuGuncelle(currentUserPhone);
                    adminVerileriniHesapla(); // Grafikleri/Sayıları güncelle
                } else {
                    personelArayuzuGuncelle(currentUserPhone); 
                }
            });
            html5QrCode.stop().catch(()=>{});
            
        } else if (!gecerliKarekodlar[okunanSifre] && !islemDevamEdiyor) {
            alert("Geçersiz QR Kod! Lütfen geçerli bir şube kodu okutun.");
        }
    }, () => {}).catch(() => { alert("Kamera izni verin!"); cameraScreen.style.display = "none"; });
};

// Personel Butonları
document.getElementById('btn-giris').addEventListener('click', () => kamerayiAc("Giriş"));
document.getElementById('btn-cikis').addEventListener('click', () => kamerayiAc("Çıkış"));

// Yönetici Butonları
document.getElementById('admin-btn-giris').addEventListener('click', () => kamerayiAc("Giriş"));
document.getElementById('admin-btn-cikis').addEventListener('click', () => kamerayiAc("Çıkış"));

// Kamera İptal
document.getElementById('cancel-camera-btn').addEventListener('click', () => {
    islemDevamEdiyor = true;
    html5QrCode.stop().then(() => cameraScreen.style.display = "none");
});
