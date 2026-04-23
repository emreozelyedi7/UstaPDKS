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

// YÖNETİCİ NUMARASI
const ADMIN_PHONE = "5324328072"; 

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
window.addEventListener('popstate', (e) => {
    if (detailScreen.classList.contains('active')) {
        detailScreen.classList.remove('active');
        adminDashboardScreen.classList.add('active');
    }
});
document.getElementById('back-to-admin-dash').addEventListener('click', () => { history.back(); });

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
        let docs = []; snapshot.forEach(d => docs.push(d.data()));
        docs.sort((a,b) => (b.tarih_saat?.toMillis() || 0) - (a.tarih_saat?.toMillis() || 0));
        son = docs[0].islem_tipi;
    }
    
    const prefix = isAdmin ? 'admin-' : '';
    const btnGiris = document.getElementById(`${prefix}btn-giris`);
    const btnCikis = document.getElementById(`${prefix}btn-cikis`);
    const badge = document.getElementById(`${prefix}status-badge`);

    if(son === "Giriş") {
        btnGiris.style.display="none"; btnCikis.style.display= isAdmin ? "flex" : "block";
        badge.innerText="MESAİDE"; badge.style.background="#D1FAE5"; badge.style.color="#065F46";
    } else {
        btnGiris.style.display= isAdmin ? "flex" : "block"; btnCikis.style.display="none";
        badge.innerText="MESAİ DIŞI"; badge.style.background="#FEE2E2"; badge.style.color="#991B1B";
    }
};

// ================= KAMERA, GECİKME VE KAYIT SİSTEMİ =================
const cameraScreen = document.getElementById('camera-screen');
const html5QrCode = new Html5Qrcode("reader");
let islemDevamEdiyor = false;
let beklemedekiKayıt = null; // Gecikme ekranı için veriyi geçici tutar

const veritabaninaYaz = async (tip, gercekKonum, gecikmeSuresi, gecikmeNedeni) => {
    const user = auth.currentUser;
    const phone = user.email.split('@')[0];
    
    const kaydedilecekVeri = {
        personel_tel: phone,
        islem_tipi: tip,
        tarih_saat: serverTimestamp(),
        lokasyon: gercekKonum
    };

    let sonUyari = "";
    if (gecikmeSuresi > 0) {
        kaydedilecekVeri.gecikme_dakika = gecikmeSuresi;
        kaydedilecekVeri.gecikme_nedeni = gecikmeNedeni || "Nedeni belirtilmedi";
        sonUyari = `\n\n🚨 Kaydınız ${gecikmeSuresi} dakika gecikmeli olarak sisteme işlendi.`;
    }

    try {
        await addDoc(collection(db, "hareketler"), kaydedilecekVeri);
        alert(`✅ ${gercekKonum} - ${tip} İşlemi Başarılı!${sonUyari}`);
        
        if(phone === ADMIN_PHONE) {
            arayuzDurumuGuncelle(phone, true);
            adminVerileriniHesapla();
        } else {
            arayuzDurumuGuncelle(phone, false); 
        }
    } catch (e) { alert("Hata: Kayıt yapılamadı!"); }
};

// Gecikme Modalı Butonları
document.getElementById('late-submit-btn').addEventListener('click', () => {
    const reason = document.getElementById('late-reason-input').value.trim();
    document.getElementById('late-modal').style.display = "none";
    if(beklemedekiKayıt) {
        veritabaninaYaz(beklemedekiKayıt.tip, beklemedekiKayıt.loc, beklemedekiKayıt.gecikmeSuresi, reason);
        beklemedekiKayıt = null;
    }
});

document.getElementById('late-skip-btn').addEventListener('click', () => {
    document.getElementById('late-modal').style.display = "none";
    if(beklemedekiKayıt) {
        veritabaninaYaz(beklemedekiKayıt.tip, beklemedekiKayıt.loc, beklemedekiKayıt.gecikmeSuresi, "");
        beklemedekiKayıt = null;
    }
});

const kamerayiAc = (tip) => {
    islemDevamEdiyor = false;
    cameraScreen.style.display = "flex";
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => {
        let code = text.trim();
        if(gecerliKarekodlar[code] && !islemDevamEdiyor) {
            islemDevamEdiyor = true;
            cameraScreen.style.display = "none";
            let loc = gecerliKarekodlar[code];
            
            // Saat Kontrolü (Sadece Girişlerde)
            const simdi = new Date();
            const suanSaat = simdi.getHours();
            const suanDakika = simdi.getMinutes();
            let gecikmeSuresi = 0;

            if (tip === "Giriş" && (suanSaat > 9 || (suanSaat === 9 && suanDakika > 0))) {
                gecikmeSuresi = (suanSaat * 60 + suanDakika) - (9 * 60);
            }

            html5QrCode.stop().catch(()=>{});

            if (gecikmeSuresi > 0) {
                // Geç kaldıysa Modalı Aç
                beklemedekiKayıt = { tip, loc, gecikmeSuresi };
                document.getElementById('late-modal-text').innerText = `Dikkat: 09:00 mesai başlangıcından ${gecikmeSuresi} dakika sonra giriş yaptınız. Kaydınız 'Gecikmeli' olarak işaretlenecektir.`;
                document.getElementById('late-reason-input').value = ""; // Kutuyu temizle
                document.getElementById('late-modal').style.display = "flex";
            } else {
                // Zamanında geldiyse direkt kaydet
                veritabaninaYaz(tip, loc, 0, "");
            }

        } else if (!gecerliKarekodlar[code] && !islemDevamEdiyor) {
            alert("Geçersiz QR Kod! Lütfen şubenize ait kodu okutun.");
        }
    }, () => {}).catch(() => { alert("Kamera izni verin!"); cameraScreen.style.display = "none"; });
};

// ================= DİĞER OLAY DİNLEYİCİLERİ =================
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.classList.remove('active');
        const p = user.email.split('@')[0];
        if(p === ADMIN_PHONE) {
            document.getElementById('admin-welcome-text').innerText = `Hoş geldin, ${p}`;
            adminDashboardScreen.classList.add('active');
            adminVerileriniHesapla(); arayuzDurumuGuncelle(p, true);
        } else {
            document.getElementById('welcome-text').innerText = `Hoş geldin, ${p}`;
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
            
            // YENİ: Yönetici ekranında mazereti gösterme
            let nedenHtml = "";
            if (isLate && veri.gecikme_nedeni) {
                nedenHtml = `<div style="font-size: 12px; color: #555; margin-top: 8px; background: #fef2f2; padding: 8px; border-radius: 5px; border-left: 2px solid #ef4444;"><strong>Açıklama:</strong> ${veri.gecikme_nedeni}</div>`;
            }

            html += `<div class="list-item ${isLate ? 'late' : 'on-time'}">
                    <strong>${veri.personel_tel}</strong> <span style="font-size:11px; color:#888;">(${veri.lokasyon})</span><br>
                    <small>Giriş: ${saatStr}</small>
                    <span style="float:right; color:${isLate ? '#ef4444':'#10b981'}; font-weight:bold;">${isLate?'Geç':'Zamanında'}</span>
                    ${nedenHtml}
                </div>`;
        }
    });
    container.innerHTML = html || "<p>Kayıt bulunamadı.</p>";
};
