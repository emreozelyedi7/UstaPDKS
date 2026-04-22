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

const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const welcomeText = document.getElementById('welcome-text');
const statusBadge = document.getElementById('status-badge');
const btnGiris = document.getElementById('btn-giris');
const btnCikis = document.getElementById('btn-cikis');

// 1. DURUM KONTROLÜ (En Son Ne Yapıldı?)
const durumlariGuncelle = async (userEmail) => {
    const q = query(
        collection(db, "hareketler"),
        where("personel_tel", "==", userEmail.split('@')[0]),
        orderBy("tarih_saat", "desc"),
        limit(1)
    );

    const querySnapshot = await getDocs(q);
    let sonIslem = "Çıkış"; // Varsayılan

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
        statusBadge.innerText = "Şu an: ÇALIŞMIYOR";
        statusBadge.style.background = "#FEE2E2";
        statusBadge.style.color = "#991B1B";
    }
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.classList.remove('active');
        dashboardScreen.classList.add('active');
        welcomeText.innerText = `Hoş geldin, ${user.email.split('@')[0]}`;
        durumlariGuncelle(user.email);
    } else {
        dashboardScreen.classList.remove('active');
        loginScreen.classList.add('active');
    }
});

// 2. GİRİŞ İŞLEMİ
document.getElementById('login-btn').addEventListener('click', () => {
    const phone = document.getElementById('phone-input').value;
    const password = document.getElementById('password-input').value;
    signInWithEmailAndPassword(auth, `${phone}@ustapdks.com`, password).catch(() => alert("Hata!"));
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// 3. KAMERA VE QR
const cameraScreen = document.getElementById('camera-screen');
const html5QrCode = new Html5Qrcode("reader");
let aktifIslem = "";

const kamerayiAc = (tip) => {
    aktifIslem = tip;
    cameraScreen.style.display = "flex";
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, 
        (text) => {
            if(text === "ofis_merkez_01") {
                html5QrCode.stop().then(() => {
                    cameraScreen.style.display = "none";
                    kayitAt(aktifIslem);
                });
            }
        }, () => {}
    );
};

const kayitAt = async (tip) => {
    const user = auth.currentUser;
    try {
        await addDoc(collection(db, "hareketler"), {
            personel_tel: user.email.split('@')[0],
            islem_tipi: tip,
            tarih_saat: serverTimestamp()
        });
        // ÖNEMLİ: Onay mesajı göster ve sonra arayüzü tazele
        alert(`✅ ${tip} İşlemi Başarılı!`);
        durumlariGuncelle(user.email);
    } catch (e) { alert("Hata oluştu!"); }
};

btnGiris.addEventListener('click', () => kamerayiAc("Giriş"));
btnCikis.addEventListener('click', () => kamerayiAc("Çıkış"));
document.getElementById('cancel-camera-btn').addEventListener('click', () => {
    html5QrCode.stop().then(() => cameraScreen.style.display = "none");
});
