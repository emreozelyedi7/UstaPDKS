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

// HTML Elementleri
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const errorText = document.getElementById('login-error');
const welcomeText = document.getElementById('welcome-text');

// 1. OTURUM KONTROLÜ
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.classList.remove('active');
        dashboardScreen.classList.add('active');
        welcomeText.innerText = `Hoş geldin, ${user.email.split('@')[0]}`;
        
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('date-text').innerText = new Date().toLocaleDateString('tr-TR', options);
    } else {
        dashboardScreen.classList.remove('active');
        loginScreen.classList.add('active');
    }
});

// 2. GİRİŞ YAPMA
loginBtn.addEventListener('click', () => {
    const phone = document.getElementById('phone-input').value;
    const password = document.getElementById('password-input').value;

    if(phone.length < 10 || password.length < 4) {
        errorText.innerText = "Lütfen bilgileri eksiksiz girin.";
        errorText.style.display = "block";
        return;
    }

    const fakeEmail = `${phone}@ustapdks.com`;
    loginBtn.innerText = "Giriş Yapılıyor...";
    
    signInWithEmailAndPassword(auth, fakeEmail, password)
        .then((userCredential) => {
            errorText.style.display = "none";
            loginBtn.innerText = "Giriş Yap";
        })
        .catch((error) => {
            loginBtn.innerText = "Giriş Yap";
            errorText.style.display = "block";
            errorText.innerText = "Hatalı telefon veya şifre!";
        });
});

// 3. ÇIKIŞ YAPMA
logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// 4. TAM EKRAN KAMERA VE QR OKUMA MANTIĞI
let islemTipiBekleyen = ""; 
const cameraScreen = document.getElementById('camera-screen');
const html5QrCode = new Html5Qrcode("reader");

const kamerayiAc = (tip) => {
    islemTipiBekleyen = tip; 
    cameraScreen.style.display = "flex"; // Siyah tam ekran kamerayı göster

    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } }, 
        (decodedText, decodedResult) => {
            if(decodedText === "ofis_merkez_01") {
                kamerayiKapat();
                gercekKayitEkle(islemTipiBekleyen);
            } else {
                alert("Geçersiz QR Kod! Lütfen Usta Cam Balkon kodunu okutun.");
            }
        },
        (errorMessage) => {}
    ).catch((err) => {
        alert("Kamera açılamadı. Lütfen telefonunuzun ayarlarından tarayıcıya kamera izni verin.");
        kamerayiKapat();
    });
};

const gercekKayitEkle = async (tip) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
        await addDoc(collection(db, "hareketler"), {
            personel_tel: user.email.split('@')[0],
            islem_tipi: tip, 
            tarih_saat: serverTimestamp(),
            lokasyon: "Merkez Ofis (QR)"
        });
        alert(`✅ ${tip} işleminiz başarıyla kaydedildi!`);
    } catch (e) {
        console.error("Kayıt hatası: ", e);
        alert("Kayıt sırasında bir hata oluştu.");
    }
};

const kamerayiKapat = () => {
    html5QrCode.stop().then(() => {
        cameraScreen.style.display = "none";
    }).catch(err => {
        cameraScreen.style.display = "none";
    });
};

// Buton Tetikleyicileri
document.getElementById('btn-giris').addEventListener('click', () => kamerayiAc("Giriş"));
document.getElementById('btn-cikis').addEventListener('click', () => kamerayiAc("Çıkış"));
document.getElementById('cancel-camera-btn').addEventListener('click', kamerayiKapat);
