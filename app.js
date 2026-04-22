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
const ADMIN_PHONE = "5324328072"; // Kendi numaranı buraya yaz!

const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const managerScreen = document.getElementById('manager-screen');
const statusBadge = document.getElementById('status-badge');

// 1. DURUM VE YETKİ KONTROLÜ
const arayuzuGuncelle = async (userEmail) => {
    const phone = userEmail.split('@')[0];
    
    // Yönetici butonu kontrolü
    if(phone === ADMIN_PHONE) {
        document.getElementById('admin-entry-btn').style.display = "block";
    }

    const q = query(collection(db, "hareketler"), where("personel_tel", "==", phone));
    const querySnapshot = await getDocs(q);
    let sonIslem = "Çıkış"; 

    if (!querySnapshot.empty) {
        let kayitlar = [];
        querySnapshot.forEach(doc => kayitlar.push(doc.data()));
        kayitlar.sort((a, b) => (b.tarih_saat?.toMillis() || 0) - (a.tarih_saat?.toMillis() || 0));
        sonIslem = kayitlar[0].islem_tipi;
    }

    if (sonIslem === "Giriş") {
        document.getElementById('btn-giris').style.display = "none";
        document.getElementById('btn-cikis').style.display = "block";
        statusBadge.innerText = "Şu an: MESAİDE";
        statusBadge.style.background = "#D1FAE5";
        statusBadge.style.color = "#065F46";
    } else {
        document.getElementById('btn-giris').style.display = "block";
        document.getElementById('btn-cikis').style.display = "none";
        statusBadge.innerText = "Şu an: MESAİ DIŞI";
        statusBadge.style.background = "#FEE2E2";
        statusBadge.style.color = "#991B1B";
    }
};

// 2. YÖNETİCİ RAPORU OLUŞTURMA
const raporlariGetir = async () => {
    const reportList = document.getElementById('report-list');
    reportList.innerHTML = "Veriler işleniyor...";
    
    const querySnapshot = await getDocs(collection(db, "hareketler"));
    let html = "";
    
    let kayitlar = [];
    querySnapshot.forEach(doc => kayitlar.push(doc.data()));
    kayitlar.sort((a, b) => (b.tarih_saat?.toMillis() || 0) - (a.tarih_saat?.toMillis() || 0));

    kayitlar.forEach(veri => {
        const tarih = veri.tarih_saat ? veri.tarih_saat.toDate() : new Date();
        const saatStr = tarih.getHours().toString().padStart(2, '0') + ":" + tarih.getMinutes().toString().padStart(2, '0');
        const gunStr = tarih.toLocaleDateString('tr-TR');
        
        // GECİKME KONTROLÜ (09:00 KRİTERİ)
        let gecikmeDurumu = "";
        let classLabel = "on-time";
        
        if(veri.islem_tipi === "Giriş") {
            const girisSaati = tarih.getHours();
            const girisDakikası = tarih.getMinutes();
            if(girisSaati > 9 || (girisSaati === 9 && girisDakikası > 0)) {
                gecikmeDurumu = "🚨 GEÇ KALDI";
                classLabel = "late";
            } else {
                gecikmeDurumu = "✅ Zamanında";
            }
        }

        html += `
            <div class="report-card ${classLabel}">
                <strong>${veri.personel_tel}</strong> - ${veri.islem_tipi}<br>
                <small>${gunStr} | ${saatStr}</small> 
                <span style="float:right; font-weight:bold;">${gecikmeDurumu}</span>
            </div>
        `;
    });
    reportList.innerHTML = html || "Henüz kayıt yok.";
};

// OTURUM VE NAVİGASYON
onAuthStateChanged(auth, (user) => {
    if (user) {
        dashboardScreen.classList.add('active');
        loginScreen.classList.remove('active');
        document.getElementById('welcome-text').innerText = `Hoş geldin, ${user.email.split('@')[0]}`;
        arayuzuGuncelle(user.email);
    } else {
        loginScreen.classList.add('active');
        dashboardScreen.classList.remove('active');
        managerScreen.classList.remove('active');
    }
});

document.getElementById('login-btn').addEventListener('click', () => {
    const phone = document.getElementById('phone-input').value;
    const password = document.getElementById('password-input').value;
    signInWithEmailAndPassword(auth, `${phone}@ustapdks.com`, password).catch(() => alert("Hata!"));
});

document.getElementById('admin-entry-btn').addEventListener('click', () => {
    dashboardScreen.classList.remove('active');
    managerScreen.classList.add('active');
    raporlariGetir();
});

document.getElementById('back-to-dash').addEventListener('click', () => {
    managerScreen.classList.remove('active');
    dashboardScreen.classList.add('active');
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// KAMERA İŞLEMLERİ (Öncekiyle aynı)
const cameraScreen = document.getElementById('camera-screen');
const html5QrCode = new Html5Qrcode("reader");
const kamerayiAc = (tip) => {
    cameraScreen.style.display = "flex";
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => {
        if(text === "ofis_merkez_01") {
            html5QrCode.stop().then(() => {
                cameraScreen.style.display = "none";
                addDoc(collection(db, "hareketler"), {
                    personel_tel: auth.currentUser.email.split('@')[0],
                    islem_tipi: tip,
                    tarih_saat: serverTimestamp()
                }).then(() => { alert("İşlem Başarılı!"); arayuzuGuncelle(auth.currentUser.email); });
            });
        }
    }, () => {});
};
document.getElementById('btn-giris').addEventListener('click', () => kamerayiAc("Giriş"));
document.getElementById('btn-cikis').addEventListener('click', () => kamerayiAc("Çıkış"));
document.getElementById('cancel-camera-btn').addEventListener('click', () => {
    html5QrCode.stop().then(() => cameraScreen.style.display = "none");
});
