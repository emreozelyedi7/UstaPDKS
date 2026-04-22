import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// Arayüz Elemanları
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const welcomeText = document.getElementById('welcome-text');
const statusBadge = document.getElementById('status-badge');
const btnGiris = document.getElementById('btn-giris');
const btnCikis = document.getElementById('btn-cikis');

// DURUM GÜNCELLEME (Giriş mi Çıkış mı Butonu Görünecek?)
const arayuzuGuncelle = async (userEmail) => {
    try {
        const q = query(
            collection(db, "hareketler"),
            where("personel_tel", "==", userEmail.split('@')[0]),
            orderBy("tarih_saat", "desc"),
            limit(1)
        );

        const querySnapshot = await getDocs(q);
        let sonIslem = "Çıkış"; 

        if (!querySnapshot.empty) {
            sonIslem = querySnapshot.docs[0].data().islem_tipi;
        }

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
        console.log("Durum alınamadı, varsayılan gösteriliyor.");
        btnGiris.style.display = "block";
        btnCikis.style.display = "none";
    }
};

// OTURUM TAKİBİ
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

// GİRİŞ YAPMA BUTONU
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

// ÇIKIŞ YAPMA (OTURUMU KAPAT)
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// KAMERA VE QR OKUMA
const cameraScreen = document.getElementById('camera-screen');
const html5QrCode = new Html5Qrcode("reader");
let aktifIslem = "";

const kamerayiAc = (tip) => {
    aktifIslem = tip;
    cameraScreen.style.display = "flex";
    
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 15, qrbox: 250 }, 
        (text) => {
            if(text === "ofis_merkez_01") {
                html5QrCode.stop().then(() => {
                    cameraScreen.style.display = "none";
                    veritabaninaYaz(aktifIslem);
                });
            }
        }, 
        () => {}
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
        
        // BAŞARI BİLDİRİMİ
        alert(`✅ ${tip} İşlemi Başarıyla Tamamlandı!`);
        
        // Arayüzü Hemen Güncelle
        arayuzuGuncelle(user.email);
    } catch (e) {
        alert("Hata: Kayıt yapılamadı!");
    }
};

btnGiris.addEventListener('click', () => kamerayiAc("Giriş"));
btnCikis.addEventListener('click', () => kamerayiAc("Çıkış"));
document.getElementById('cancel-camera-btn').addEventListener('click', () => {
    html5QrCode.stop().then(() => {
        cameraScreen.style.display = "none";
    }).catch(() => cameraScreen.style.display = "none");
});
