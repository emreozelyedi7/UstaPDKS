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

const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const welcomeText = document.getElementById('welcome-text');
const statusBadge = document.getElementById('status-badge');
const btnGiris = document.getElementById('btn-giris');
const btnCikis = document.getElementById('btn-cikis');

// 1. DURUM GÜNCELLEME (Firebase Index Sorununu Çözen Yeni Mantık)
const arayuzuGuncelle = async (userEmail) => {
    try {
        statusBadge.innerText = "Kayıtlar Taranıyor...";
        
        // Sadece bu personelin kayıtlarını getir (Sıralama kısıtlaması kaldırıldı)
        const q = query(
            collection(db, "hareketler"),
            where("personel_tel", "==", userEmail.split('@')[0])
        );

        const querySnapshot = await getDocs(q);
        let sonIslem = "Çıkış"; 

        if (!querySnapshot.empty) {
            // Verileri Javascript ile manuel sıralıyoruz (Firebase engeline takılmamak için)
            let kayitlar = [];
            querySnapshot.forEach(doc => kayitlar.push(doc.data()));
            
            kayitlar.sort((a, b) => {
                let zamanA = a.tarih_saat ? a.tarih_saat.toMillis() : 0;
                let zamanB = b.tarih_saat ? b.tarih_saat.toMillis() : 0;
                return zamanB - zamanA; // En yeniden eskiye
            });
            
            sonIslem = kayitlar[0].islem_tipi;
        }

        // Arayüzü duruma göre boya ve butonları ayarla
        if (sonIslem === "Giriş") {
            btnGiris.style.display = "none";
            btnCikis.style.display = "block";
            statusBadge.innerText = "Şu an: MESAİDE";
            statusBadge.style.background = "#D1FAE5";
            statusBadge.style.color = "#065F46";
        } else {
            btnGiris.style.display = "block";
            btnCikis.style.display = "none";
            statusBadge.innerText = "Şu an: MESAİ DIŞI";
            statusBadge.style.background = "#FEE2E2";
            statusBadge.style.color = "#991B1B";
        }
    } catch (e) {
        console.log("Veri çekme hatası:", e);
        statusBadge.innerText = "Bağlantı Hatası!";
        btnGiris.style.display = "block";
        btnCikis.style.display = "none";
    }
};

// 2. OTURUM TAKİBİ
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.classList.remove('active');
        dashboardScreen.classList.add('active');
        welcomeText.innerText = `Hoş geldin, ${user.email.split('@')[0]}`;
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        document.getElementById('date-text').innerText = new Date().toLocaleDateString('tr-TR', options);
        arayuzuGuncelle(user.email);
    } else {
        dashboardScreen.classList.remove('active');
        loginScreen.classList.add('active');
    }
});

// 3. GİRİŞ YAP BUTONU
document.getElementById('login-btn').addEventListener('click', () => {
    const phone = document.getElementById('phone-input').value;
    const password = document.getElementById('password-input').value;
    const btn = document.getElementById('login-btn');
    
    if(!phone || !password) return alert("Bilgileri girin");
    
    btn.innerText = "Giriş Yapılıyor...";
    signInWithEmailAndPassword(auth, `${phone}@ustapdks.com`, password)
        .catch(err => {
            alert("Hatalı bilgiler!");
            btn.innerText = "SİSTEME GİRİŞ";
        });
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// 4. KAMERA VE QR OKUMA (Çift Tıklama/Kilitlenme Korumalı)
const cameraScreen = document.getElementById('camera-screen');
const html5QrCode = new Html5Qrcode("reader");
let aktifIslem = "";
let islemDevamEdiyor = false; // Çift okumayı engelleyecek kilit

const kamerayiAc = (tip) => {
    aktifIslem = tip;
    islemDevamEdiyor = false; 
    cameraScreen.style.display = "flex";
    
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 }, 
        (text) => {
            // Kod doğruysa ve henüz işlem başlamadıysa çalıştır
            if(text.trim() === "ofis_merkez_01" && !islemDevamEdiyor) {
                islemDevamEdiyor = true; // Kilitledik (Birden fazla uyarı vermesin diye)
                cameraScreen.style.display = "none"; // Arayüzü anında kapat
                veritabaninaYaz(aktifIslem); // Veriyi gönder
                html5QrCode.stop().catch(err => console.log("Kamera durdurulamadı", err)); // Arka planda sessizce kamerayı kapat
            }
        }, 
        () => {} // Hataları sessiz geç
    ).catch(err => {
        alert("Kamera izni gerekiyor!");
        cameraScreen.style.display = "none";
    });
};

const veritabaninaYaz = async (tip) => {
    const user = auth.currentUser;
    try {
        await addDoc(collection(db, "hareketler"), {
            personel_tel: user.email.split('@')[0],
            islem_tipi: tip,
            tarih_saat: serverTimestamp(),
            lokasyon: "Merkez Ofis"
        });
        
        // BAŞARI BİLDİRİMİ EKRANA BASILIR
        alert(`✅ ${tip} İşlemi Başarıyla Tamamlandı!`);
        
        // Arayüz yeniden hesaplanıp boyanır (Butonlar değişir)
        arayuzuGuncelle(user.email);
    } catch (e) {
        alert("Hata: Kayıt yapılamadı! İnternet bağlantınızı kontrol edin.");
        islemDevamEdiyor = false;
    }
};

btnGiris.addEventListener('click', () => kamerayiAc("Giriş"));
btnCikis.addEventListener('click', () => kamerayiAc("Çıkış"));
document.getElementById('cancel-camera-btn').addEventListener('click', () => {
    islemDevamEdiyor = true;
    html5QrCode.stop().then(() => {
        cameraScreen.style.display = "none";
    }).catch(() => cameraScreen.style.display = "none");
});
