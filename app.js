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

// Ekranlar
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const adminDashboardScreen = document.getElementById('admin-dashboard-screen');
const detailScreen = document.getElementById('detail-screen');

// YÖNLENDİRİCİ: Kim girdi?
const ekranYonlendir = (userEmail) => {
    const phone = userEmail.split('@')[0];
    
    // YÖNETİCİ Mİ?
    if(phone === ADMIN_PHONE) {
        dashboardScreen.classList.remove('active');
        adminDashboardScreen.classList.add('active');
        adminVerileriniHesapla();
    } 
    // PERSONEL Mİ?
    else {
        adminDashboardScreen.classList.remove('active');
        dashboardScreen.classList.add('active');
        personelArayuzuGuncelle(phone);
    }
};

// ================= YÖNETİCİ BÖLÜMÜ =================
let tumHareketlerCache = [];

const adminVerileriniHesapla = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "hareketler"));
        tumHareketlerCache = [];
        querySnapshot.forEach(doc => tumHareketlerCache.push(doc.data()));
        
        // Bugünü bul
        const bugun = new Date().toLocaleDateString('tr-TR');
        
        let bugunGelenler = new Set();
        let bugunGecKalanlar = new Set();

        tumHareketlerCache.forEach(veri => {
            if(!veri.tarih_saat) return;
            const tarih = veri.tarih_saat.toDate();
            const gunStr = tarih.toLocaleDateString('tr-TR');
            
            if(gunStr === bugun && veri.islem_tipi === "Giriş") {
                bugunGelenler.add(veri.personel_tel);
                
                // Gecikme kuralı: Saat 09:00'ı geçtiyse (Örn: 09:01)
                if(tarih.getHours() > 9 || (tarih.getHours() === 9 && tarih.getMinutes() > 0)) {
                    bugunGecKalanlar.add(veri.personel_tel);
                }
            }
        });

        // Ekrana bas
        document.getElementById('count-gelenler').innerText = bugunGelenler.size;
        document.getElementById('count-geckalanlar').innerText = bugunGecKalanlar.size;
        // Not: "Gelmeyenler" hesabı için toplam personel sayısını bilmek gerekir, şimdilik statik 0.

    } catch (e) {
        console.log("Admin veri çekme hatası", e);
    }
};

// Kartlara Tıklama Olayı (Detay Sayfası Açma)
window.detayAc = (kategori) => {
    document.getElementById('detail-title').innerText = kategori;
    adminDashboardScreen.classList.remove('active');
    detailScreen.classList.add('active');
    
    const container = document.getElementById('detail-list-container');
    let html = "";
    const bugun = new Date().toLocaleDateString('tr-TR');

    if(kategori === "Bugün Gelenler" || kategori === "Geç Kalanlar") {
        tumHareketlerCache.sort((a, b) => (b.tarih_saat?.toMillis() || 0) - (a.tarih_saat?.toMillis() || 0));
        
        tumHareketlerCache.forEach(veri => {
            if(!veri.tarih_saat) return;
            const tarih = veri.tarih_saat.toDate();
            if(tarih.toLocaleDateString('tr-TR') === bugun && veri.islem_tipi === "Giriş") {
                
                let isLate = (tarih.getHours() > 9 || (tarih.getHours() === 9 && tarih.getMinutes() > 0));
                
                // Filtreleme
                if(kategori === "Geç Kalanlar" && !isLate) return;

                const saatStr = tarih.getHours().toString().padStart(2, '0') + ":" + tarih.getMinutes().toString().padStart(2, '0');
                html += `
                    <div class="list-item ${isLate ? 'late' : 'on-time'}">
                        <strong>${veri.personel_tel}</strong> <br>
                        <small>Giriş: ${saatStr}</small>
                        <span style="float:right; color: ${isLate ? '#ef4444' : '#10b981'}; font-weight:bold;">${isLate ? 'Geç' : 'Zamanında'}</span>
                    </div>
                `;
            }
        });
    } 
    else if (kategori === "Maaş Kesinti Raporu") {
        html = `<div style="text-align:center; padding: 20px; color: #666;">
                  <i class="fas fa-tools" style="font-size: 30px; margin-bottom: 10px;"></i><br>
                  Kesinti hesaplama modülü yakında eklenecek.
                </div>`;
    } 
    else {
        html = "<p style='color:#666;'>Bu kategori için veri bulunamadı.</p>";
    }
    
    container.innerHTML = html || "<p>Kayıt yok.</p>";
};

// Detaylardan geri dön
document.getElementById('back-to-admin-dash').addEventListener('click', () => {
    detailScreen.classList.remove('active');
    adminDashboardScreen.classList.add('active');
});

// Admin Çıkış
document.getElementById('admin-logout-btn').addEventListener('click', () => signOut(auth));


// ================= PERSONEL BÖLÜMÜ (Önceki Mantık) =================
const personelArayuzuGuncelle = async (phone) => {
    const q = query(collection(db, "hareketler"), where("personel_tel", "==", phone));
    const querySnapshot = await getDocs(q);
    let sonIslem = "Çıkış"; 
    
    const badge = document.getElementById('status-badge');
    const btnGiris = document.getElementById('btn-giris');
    const btnCikis = document.getElementById('btn-cikis');

    if (!querySnapshot.empty) {
        let kayitlar = [];
        querySnapshot.forEach(doc => kayitlar.push(doc.data()));
        kayitlar.sort((a, b) => (b.tarih_saat?.toMillis() || 0) - (a.tarih_saat?.toMillis() || 0));
        sonIslem = kayitlar[0].islem_tipi;
    }

    if (sonIslem === "Giriş") {
        btnGiris.style.display = "none"; btnCikis.style.display = "block";
        badge.innerText = "MESAİDE"; badge.style.background = "#D1FAE5"; badge.style.color = "#065F46";
    } else {
        btnGiris.style.display = "block"; btnCikis.style.display = "none";
        badge.innerText = "MESAİ DIŞI"; badge.style.background = "#FEE2E2"; badge.style.color = "#991B1B";
    }
};

// OTURUM YÖNETİMİ
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.classList.remove('active');
        document.getElementById('welcome-text').innerText = `Hoş geldin, ${user.email.split('@')[0]}`;
        ekranYonlendir(user.email);
    } else {
        loginScreen.classList.add('active');
        dashboardScreen.classList.remove('active');
        adminDashboardScreen.classList.remove('active');
        detailScreen.classList.remove('active');
    }
});

document.getElementById('login-btn').addEventListener('click', () => {
    const phone = document.getElementById('phone-input').value;
    const password = document.getElementById('password-input').value;
    if(!phone || !password) return alert("Bilgileri girin");
    signInWithEmailAndPassword(auth, `${phone}@ustapdks.com`, password).catch(() => alert("Hatalı giriş!"));
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// PERSONEL KAMERA (Sadece Personel kullanır)
const cameraScreen = document.getElementById('camera-screen');
const html5QrCode = new Html5Qrcode("reader");
let islemDevamEdiyor = false;

const kamerayiAc = (tip) => {
    islemDevamEdiyor = false; 
    cameraScreen.style.display = "flex";
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => {
        if(text === "ofis_merkez_01" && !islemDevamEdiyor) {
            islemDevamEdiyor = true;
            cameraScreen.style.display = "none";
            addDoc(collection(db, "hareketler"), {
                personel_tel: auth.currentUser.email.split('@')[0],
                islem_tipi: tip, tarih_saat: serverTimestamp(), lokasyon: "Merkez Ofis"
            }).then(() => { 
                alert("İşlem Başarılı!"); 
                personelArayuzuGuncelle(auth.currentUser.email.split('@')[0]); 
            });
            html5QrCode.stop().catch(()=>{});
        }
    }, () => {}).catch(() => { alert("Kamera izni verin!"); cameraScreen.style.display = "none"; });
};

document.getElementById('btn-giris').addEventListener('click', () => kamerayiAc("Giriş"));
document.getElementById('btn-cikis').addEventListener('click', () => kamerayiAc("Çıkış"));
document.getElementById('cancel-camera-btn').addEventListener('click', () => {
    islemDevamEdiyor = true;
    html5QrCode.stop().then(() => cameraScreen.style.display = "none");
});
