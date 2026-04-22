// 4. GERÇEK KAMERA VE QR OKUMA MANTIĞI
let islemTipiBekleyen = ""; // Kullanıcının Giriş'e mi yoksa Çıkış'a mı bastığını tutarız
const cameraModal = document.getElementById('camera-modal');
const html5QrCode = new Html5Qrcode("reader");

const kamerayiAc = (tip) => {
    islemTipiBekleyen = tip; // "Giriş" veya "Çıkış"
    cameraModal.style.display = "flex"; // Kamera penceresini göster

    // Kamerayı başlat
    html5QrCode.start(
        { facingMode: "environment" }, // Arka kamerayı kullan
        { fps: 10, qrbox: { width: 250, height: 250 } }, // Tarama kutusu ayarları
        (decodedText, decodedResult) => {
            // QR KOD BAŞARIYLA OKUNDUĞUNDA BURASI ÇALIŞIR
            
            // Bizim belirlediğimiz ofis şifresi "ofis_merkez_01" olmalı
            if(decodedText === "ofis_merkez_01") {
                // Şifre doğruysa kamerayı kapat ve veritabanına yaz
                html5QrCode.stop().then(() => {
                    cameraModal.style.display = "none";
                    gercekKayitEkle(islemTipiBekleyen);
                });
            } else {
                alert("Geçersiz QR Kod! Lütfen sadece Usta Cam Balkon kodunu okutun.");
            }
        },
        (errorMessage) => {
            // Tarama sırasında sürekli çalışan hata yakalayıcı (sessizce geçiyoruz)
        }
    ).catch((err) => {
        alert("Kamera açılamadı. Lütfen tarayıcınızın kamera izni verdiğinden emin olun.");
        cameraModal.style.display = "none";
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
            lokasyon: "Merkez Ofis (QR ile Onaylandı)"
        });
        alert(`✅ ${tip} işleminiz başarıyla kaydedildi!`);
    } catch (e) {
        console.error("Kayıt hatası: ", e);
        alert("Bir hata oluştu, lütfen tekrar deneyin.");
    }
};

// Butonlara tıklanınca kamerayı tetikle
document.getElementById('btn-giris').addEventListener('click', () => kamerayiAc("Giriş"));
document.getElementById('btn-cikis').addEventListener('click', () => kamerayiAc("Çıkış"));

// İptal Butonu ve Çarpı İşareti ile Kamerayı Kapatma
const kamerayiKapat = () => {
    html5QrCode.stop().then(() => {
        cameraModal.style.display = "none";
    }).catch(err => console.log(err));
};
document.getElementById('close-camera').addEventListener('click', kamerayiKapat);
document.getElementById('cancel-camera').addEventListener('click', kamerayiKapat);
