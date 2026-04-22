// Firebase SDK'larını içe aktar
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Senin Firebase Anahtarların
const firebaseConfig = {
  apiKey: "AIzaSyAJ9Nv4Eru4yLor8fclYnV-Ln5bZQ9gwos",
  authDomain: "usta-cam-balkon-pdks.firebaseapp.com",
  projectId: "usta-cam-balkon-pdks",
  storageBucket: "usta-cam-balkon-pdks.firebasestorage.app",
  messagingSenderId: "284256934659",
  appId: "1:284256934659:web:c533c8aef97139cfbea736",
  measurementId: "G-T2366B5R1S"
};

// Firebase'i Başlat
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// HTML Elementlerini Seç
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const errorText = document.getElementById('login-error');
const welcomeText = document.getElementById('welcome-text');

// 1. OTURUM KONTROLÜ (Beni Hatırla)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Kullanıcı zaten giriş yapmış
        loginScreen.classList.remove('active');
        dashboardScreen.classList.add('active');
        welcomeText.innerText = `Hoş geldin, ${user.email.split('@')[0]}`;
        
        // Tarihi yazdır
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('date-text').innerText = new Date().toLocaleDateString('tr-TR', options);
    } else {
        // Giriş yapmamış
        dashboardScreen.classList.remove('active');
        loginScreen.classList.add('active');
    }
});

// 2. GİRİŞ YAPMA İŞLEMİ
loginBtn.addEventListener('click', () => {
    const phone = document.getElementById('phone-input').value;
    const password = document.getElementById('password-input').value;

    if(phone.length < 10 || password.length < 4) {
        errorText.innerText = "Lütfen bilgileri eksiksiz girin.";
        errorText.style.display = "block";
        return;
    }

    // Telefon numarasını arka planda e-postaya çeviriyoruz (Örn: 5321234567@ustapdks.com)
    const fakeEmail = `${phone}@ustapdks.com`;

    loginBtn.innerText = "Giriş Yapılıyor...";
    
    signInWithEmailAndPassword(auth, fakeEmail, password)
        .then((userCredential) => {
            // Başarılı giriş (Ekran değişimi onAuthStateChanged'de otomatik olacak)
            errorText.style.display = "none";
            loginBtn.innerText = "Giriş Yap";
        })
        .catch((error) => {
            loginBtn.innerText = "Giriş Yap";
            errorText.style.display = "block";
            errorText.innerText = "Hatalı telefon veya şifre!";
            console.error(error);
        });
});

// 3. ÇIKIŞ YAPMA İŞLEMİ
logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// 4. VERİTABANINA GİRİŞ/ÇIKIŞ KAYDI ATMA (Konum ve QR Şimdilik Simüle Edildi)
const kayitEkle = async (tip) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
        await addDoc(collection(db, "hareketler"), {
            personel_tel: user.email.split('@')[0],
            islem_tipi: tip, // "Giriş" veya "Çıkış"
            tarih_saat: serverTimestamp(),
            lokasyon: "Merkez Ofis (GPS simülasyonu)"
        });
        alert(`${tip} işleminiz başarıyla kaydedildi!`);
    } catch (e) {
        console.error("Kayıt hatası: ", e);
        alert("Bir hata oluştu, lütfen tekrar deneyin.");
    }
};

document.getElementById('btn-giris').addEventListener('click', () => kayitEkle("Giriş"));
document.getElementById('btn-cikis').addEventListener('click', () => kayitEkle("Çıkış"));