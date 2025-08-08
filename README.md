# MongoDB Billboard Reservation Performance Test

Bu proje MongoDB üzerinde billboard rezervasyon sisteminin performans testlerini gerçekleştiren bir Node.js uygulamasıdır.

## 📋 Genel Bakış

Script, farklı veri boyutlarında (2K, 10K, 100K billboard) MongoDB performansını test eder ve rezervasyon sorgularının çalışma sürelerini analiz eder.

### Test Senaryoları
- **2.000 billboard** ile başlangıç testi
- **10.000 billboard** ile orta ölçek testi 
- **100.000 billboard** ile büyük ölçek testi

## 🚀 Kurulum

### Gereksinimler
- Node.js (v14 veya üstü)
- MongoDB Atlas hesabı veya local MongoDB instance
- NPM veya Yarn

### Adımlar

1. **Projeyi klonlayın:**
```bash
git clone <repo-url>
cd Reservation_Test_Script
```

2. **Dependencies yükleyin:**
```bash
npm install
```

3. **Environment değişkenlerini yapılandırın:**
`.env` dosyasında MongoDB connection string'ini ayarlayın:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ReservationTestScript
```

## 🏃‍♂️ Çalıştırma

```bash
npm start
# veya
node billboard_performance_test.js
```

## 📊 Veri Yapısı

### Billboard Collection (advertising_spaces)
```javascript
{
  _id: ObjectId,
  companyId: ObjectId,           // Rastgele şirket ID
  advertisingTypeId: ObjectId,   // 3 ana tip (rastgele)
  subTypeId: ObjectId,          // 12 alt tip (rastgele)
  location: {
    type: "Point",
    coordinates: [lng, lat]      // Rastgele koordinatlar
  },
  status: "active"
}
```

### Booking Collection (advertising_space_bookings)
```javascript
{
  advertisingSpaceId: ObjectId,  // Billboard referansı
  startDate: Date,              // 2025-07-01 - 2025-12-31 arası
  endDate: Date,                // Başlangıçtan 1-30 gün sonra
  status: String                // "reserved", "hold", "maintenance"
}
```

## 🔍 Test Sorguları

### Sorgu 1: Belirli Tarih Aralığı
**14-28 Ağustos 2025 arası müsait billboard'ları bul (advertising type filter ile)**

```javascript
{
  status: "active",
  advertisingTypeId: targetAdType,
  _id: { $nin: [conflicting_billboard_ids] }
}
```

### Sorgu 2: 7 Günlük Dönem
**Ağustos 2025'te herhangi bir 7 günlük süre için müsait billboard'ları bul**

```javascript
{
  status: "active", 
  _id: { $nin: [conflicting_billboard_ids] }
}
```

## 📈 Performans Metrikleri

Script aşağıdaki metrikleri toplar:

- **Execution Time**: Sorgu çalışma süresi (ms)
- **Result Count**: Bulunan sonuç sayısı
- **Total Spaces**: Toplam billboard/space sayısı
- **Total Bookings**: Toplam rezervasyon sayısı
- **Spaces Collection Size**: Billboard collection boyutu (MB)
- **Bookings Collection Size**: Booking collection boyutu (MB)
- **Documents Examined**: İncelenen doküman sayısı
- **Keys Examined**: İncelenen index key sayısı
- **Execution Stats**: MongoDB explain() çıktısı

## 📄 Çıktı Raporları

Test tamamlandıktan sonra iki rapor oluşturulur:

### CSV Raporu (`performance_report_TIMESTAMP.csv`)
Tabuler format, Excel'de analiz için uygun:
```csv
Dataset Size,Query Name,Result Count,Execution Time (ms),Total Spaces,Total Bookings,Spaces Collection Size (MB),Bookings Collection Size (MB),Documents Examined,Keys Examined
2000,"Available Aug 14-28, 2025",450,120,2000,5230,0.8,2.1,2000,850
```

### TXT Raporu (`performance_report_TIMESTAMP.txt`)
Detaylı metin raporu:
```
Dataset Size: 2,000 billboards
Query: Available Aug 14-28, 2025
Result Count: 450
Execution Time: 120ms
Total Spaces: 2,000
Total Bookings: 5,230
Spaces Collection Size: 0.8 MB
Bookings Collection Size: 2.1 MB
Documents Examined: 2,000
Keys Examined: 850
```

## 🗂️ MongoDB İndeksler

Script otomatik olarak aşağıdaki indeksleri oluşturur:

### Billboard Collection
- `{ status: 1 }`
- `{ advertisingTypeId: 1 }`
- `{ subTypeId: 1 }`
- `{ location: "2dsphere" }`
- `{ status: 1, advertisingTypeId: 1 }` (compound)

### Booking Collection
- `{ advertisingSpaceId: 1 }`
- `{ startDate: 1, endDate: 1 }`
- `{ advertisingSpaceId: 1, startDate: 1, endDate: 1 }` (compound)

## 🔧 Konfigürasyon

### Test Parametreleri
Script içinde değiştirilebilir parametreler:

```javascript
// Test veri boyutları
const TEST_SIZES = [2000, 10000, 100000];

// Booking yoğunluğu (her billboard için)
const BOOKING_PROBABILITY = 0.5; // %50 şansla booking

// Tarih aralığı
const YEAR_START = new Date('2025-07-01');
const YEAR_END = new Date('2025-12-31');
```

## 🚨 Dikkat Edilmesi Gerekenler

- **Veri Silme**: Script mevcut `advertising_spaces` ve `advertising_space_bookings` collection'larını temizler
- **Bellek Kullanımı**: 100K veri testi için yeterli RAM gereklidir
- **Network**: Atlas kullanıyorsanız stabil internet bağlantısı gereklidir
- **Zaman**: Tam test yaklaşık 10-30 dakika sürebilir

## 🛠️ Geliştirme

### Script Yapısı
```
billboard_performance_test.js
├── BillboardPerformanceTest class
├── Data Generation Methods
├── Query Execution Methods
├── Performance Measurement
└── Report Generation
```

### Yeni Sorgu Ekleme
Yeni test sorgusu eklemek için:

1. `async runQueryX(datasetSize)` metodu oluşturun
2. `runTestForDataset()` metodunda sorguyu çağırın
3. `generateReport()` metodunda sonuçları ekleyin

## 📞 Destek

Sorun bildirimi veya öneriniz için issue oluşturun.

## 📜 Lisans

MIT License