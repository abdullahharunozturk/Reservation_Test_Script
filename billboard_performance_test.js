require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'ReservationTestScript';
const BILLBOARD_COLLECTION = 'advertising_spaces';
const BOOKING_COLLECTION = 'advertising_space_bookings';

class BillboardPerformanceTest {
    constructor() {
        this.client = null;
        this.db = null;
        this.results = [];
        this.advertisingTypes = [];
        this.subTypes = [];
    }

    async connect() {
        console.log('Connecting to MongoDB...');
        this.client = new MongoClient(MONGODB_URI);
        await this.client.connect();
        this.db = this.client.db(DB_NAME);
        console.log('Connected to MongoDB');
    }

    async disconnect() {
        if (this.client) {
            await this.client.close();
            console.log('Disconnected from MongoDB');
        }
    }

    generateObjectIds(count) {
        return Array.from({ length: count }, () => new ObjectId());
    }

    getRandomCoordinates() {
        const lat = (Math.random() * 180 - 90).toFixed(6);
        const lng = (Math.random() * 360 - 180).toFixed(6);
        return [parseFloat(lng), parseFloat(lat)];
    }

    getRandomDate(start, end) {
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    }

    async setupReferenceData() {
        console.log('Setting up reference data...');
        this.advertisingTypes = this.generateObjectIds(3);
        this.subTypes = this.generateObjectIds(12);
    }

    async clearCollections() {
        console.log('Clearing existing collections...');
        try {
            // Drop collections completely - much faster than deleteMany
            await this.db.collection(BILLBOARD_COLLECTION).drop();
            console.log('Dropped advertising_spaces collection');
        } catch (error) {
            // Collection might not exist, ignore error
            if (!error.message.includes('ns not found')) {
                console.log('Error dropping advertising_spaces:', error.message);
            }
        }
        
        try {
            await this.db.collection(BOOKING_COLLECTION).drop();
            console.log('Dropped advertising_space_bookings collection');
        } catch (error) {
            // Collection might not exist, ignore error
            if (!error.message.includes('ns not found')) {
                console.log('Error dropping advertising_space_bookings:', error.message);
            }
        }
    }

    async generateBillboards(count) {
        console.log(`Generating ${count.toLocaleString()} billboards...`);
        const startTime = Date.now();
        
        const billboards = [];
        const companyIds = this.generateObjectIds(Math.min(100, Math.floor(count / 10)));
        
        for (let i = 0; i < count; i++) {
            billboards.push({
                _id: new ObjectId(),
                companyId: companyIds[Math.floor(Math.random() * companyIds.length)],
                advertisingTypeId: this.advertisingTypes[Math.floor(Math.random() * this.advertisingTypes.length)],
                subTypeId: this.subTypes[Math.floor(Math.random() * this.subTypes.length)],
                location: {
                    type: "Point",
                    coordinates: this.getRandomCoordinates()
                },
                status: "active"
            });
        }

        const batchSize = 1000;
        for (let i = 0; i < billboards.length; i += batchSize) {
            const batch = billboards.slice(i, i + batchSize);
            await this.db.collection(BILLBOARD_COLLECTION).insertMany(batch, { ordered: false });
            if (i % 10000 === 0) {
                console.log(`Inserted ${i + batch.length} billboards...`);
            }
        }

        const endTime = Date.now();
        console.log(`Generated ${count.toLocaleString()} billboards in ${(endTime - startTime) / 1000}s`);
        return billboards.map(b => b._id);
    }

    async generateBookings(billboardIds) {
        console.log(`Generating bookings for ${billboardIds.length.toLocaleString()} billboards...`);
        const startTime = Date.now();
        
        const bookings = [];
        const statuses = ["reserved", "hold", "maintenance"];
        const yearStart = new Date('2025-07-01');
        const yearEnd = new Date('2025-12-31');

        for (const billboardId of billboardIds) {
            const bookingCount = Math.floor(Math.random() * 5) + 2; // 2-6 bookings per billboard
            const shouldHaveBookings = Math.random() < 0.5; // 50% chance of having bookings
            
            if (shouldHaveBookings) {
                for (let i = 0; i < bookingCount; i++) {
                    const startDate = this.getRandomDate(yearStart, yearEnd);
                    const endDate = new Date(startDate.getTime() + (Math.random() * 30 + 1) * 24 * 60 * 60 * 1000); // 1-30 days
                    
                    if (endDate <= yearEnd) {
                        bookings.push({
                            advertisingSpaceId: billboardId,
                            startDate: startDate,
                            endDate: endDate,
                            status: statuses[Math.floor(Math.random() * statuses.length)]
                        });
                    }
                }
            }
        }

        const batchSize = 1000;
        for (let i = 0; i < bookings.length; i += batchSize) {
            const batch = bookings.slice(i, i + batchSize);
            await this.db.collection(BOOKING_COLLECTION).insertMany(batch, { ordered: false });
            if (i % 10000 === 0) {
                console.log(`Inserted ${i + batch.length} bookings...`);
            }
        }

        const endTime = Date.now();
        console.log(`Generated ${bookings.length.toLocaleString()} bookings in ${(endTime - startTime) / 1000}s`);
    }

    async createIndexes() {
        console.log('Creating indexes...');
        const startTime = Date.now();

        // Billboards indexes
        await this.db.collection(BILLBOARD_COLLECTION).createIndex({ status: 1 });
        await this.db.collection(BILLBOARD_COLLECTION).createIndex({ advertisingTypeId: 1 });
        await this.db.collection(BILLBOARD_COLLECTION).createIndex({ subTypeId: 1 });
        await this.db.collection(BILLBOARD_COLLECTION).createIndex({ location: "2dsphere" });
        await this.db.collection(BILLBOARD_COLLECTION).createIndex({ 
            status: 1, 
            advertisingTypeId: 1 
        });

        // Bookings indexes
        await this.db.collection(BOOKING_COLLECTION).createIndex({ advertisingSpaceId: 1 });
        await this.db.collection(BOOKING_COLLECTION).createIndex({ startDate: 1, endDate: 1 });
        await this.db.collection(BOOKING_COLLECTION).createIndex({ 
            advertisingSpaceId: 1, 
            startDate: 1, 
            endDate: 1 
        });

        const endTime = Date.now();
        console.log(`Created indexes in ${(endTime - startTime) / 1000}s`);
    }

    async runQuery1(datasetSize) {
        console.log('\n=== Query 1: Available billboards Aug 14-28, 2025 ===');
        const startDate = new Date('2025-08-14');
        const endDate = new Date('2025-08-28');
        const targetAdType = this.advertisingTypes[0];

        const query = {
            status: "active",
            advertisingTypeId: targetAdType,
            _id: {
                $nin: await this.db.collection(BOOKING_COLLECTION).distinct("advertisingSpaceId", {
                    $or: [
                        {
                            startDate: { $lte: endDate },
                            endDate: { $gte: startDate }
                        }
                    ]
                })
            }
        };

        const startTime = Date.now();
        const results = await this.db.collection(BILLBOARD_COLLECTION).find(query).toArray();
        const endTime = Date.now();

        const executionTime = endTime - startTime;
        console.log(`Found ${results.length} available billboards`);
        console.log(`Execution time: ${executionTime}ms`);

        // Get explain stats
        const explainResult = await this.db.collection(BILLBOARD_COLLECTION)
            .find(query)
            .explain("executionStats");

        // Get collection stats using admin command
        const totalSpaces = await this.db.collection(BILLBOARD_COLLECTION).estimatedDocumentCount();
        const totalBookings = await this.db.collection(BOOKING_COLLECTION).estimatedDocumentCount();
        
        // Get collection sizes using aggregation pipeline
        let spacesCollectionSizeMB = 0;
        let bookingsCollectionSizeMB = 0;
        
        try {
            const spacesStats = await this.client.db(DB_NAME).command({collStats: BILLBOARD_COLLECTION});
            spacesCollectionSizeMB = Math.round(spacesStats.size / (1024 * 1024) * 100) / 100;
        } catch (error) {
            // Fallback: estimate based on document count (rough estimate)
            spacesCollectionSizeMB = Math.round(totalSpaces * 0.5 / 1024 * 100) / 100; // ~0.5KB per document estimate
        }
        
        try {
            const bookingsStats = await this.client.db(DB_NAME).command({collStats: BOOKING_COLLECTION});
            bookingsCollectionSizeMB = Math.round(bookingsStats.size / (1024 * 1024) * 100) / 100;
        } catch (error) {
            // Fallback: estimate based on document count
            bookingsCollectionSizeMB = Math.round(totalBookings * 0.2 / 1024 * 100) / 100; // ~0.2KB per document estimate
        }

        return {
            queryName: 'Available Aug 14-28, 2025',
            datasetSize,
            resultCount: results.length,
            executionTime,
            explainStats: explainResult.executionStats,
            totalSpaces,
            totalBookings,
            spacesCollectionSizeMB,
            bookingsCollectionSizeMB
        };
    }

    async runQuery2(datasetSize) {
        console.log('\n=== Query 2: Available for any 7-day period in Aug 2025 ===');
        const testStartDate = new Date('2025-08-15');
        const testEndDate = new Date('2025-08-22'); // 7 days
        
        const query = {
            status: "active",
            _id: {
                $nin: await this.db.collection(BOOKING_COLLECTION).distinct("advertisingSpaceId", {
                    $or: [
                        {
                            startDate: { $lte: testEndDate },
                            endDate: { $gte: testStartDate }
                        }
                    ]
                })
            }
        };

        const startTime = Date.now();
        const results = await this.db.collection(BILLBOARD_COLLECTION).find(query).toArray();
        const endTime = Date.now();

        const executionTime = endTime - startTime;
        console.log(`Found ${results.length} available billboards for 7-day period`);
        console.log(`Execution time: ${executionTime}ms`);

        // Get explain stats
        const explainResult = await this.db.collection(BILLBOARD_COLLECTION)
            .find(query)
            .explain("executionStats");

        // Get collection stats using admin command
        const totalSpaces = await this.db.collection(BILLBOARD_COLLECTION).estimatedDocumentCount();
        const totalBookings = await this.db.collection(BOOKING_COLLECTION).estimatedDocumentCount();
        
        // Get collection sizes using aggregation pipeline
        let spacesCollectionSizeMB = 0;
        let bookingsCollectionSizeMB = 0;
        
        try {
            const spacesStats = await this.client.db(DB_NAME).command({collStats: BILLBOARD_COLLECTION});
            spacesCollectionSizeMB = Math.round(spacesStats.size / (1024 * 1024) * 100) / 100;
        } catch (error) {
            // Fallback: estimate based on document count (rough estimate)
            spacesCollectionSizeMB = Math.round(totalSpaces * 0.5 / 1024 * 100) / 100; // ~0.5KB per document estimate
        }
        
        try {
            const bookingsStats = await this.client.db(DB_NAME).command({collStats: BOOKING_COLLECTION});
            bookingsCollectionSizeMB = Math.round(bookingsStats.size / (1024 * 1024) * 100) / 100;
        } catch (error) {
            // Fallback: estimate based on document count
            bookingsCollectionSizeMB = Math.round(totalBookings * 0.2 / 1024 * 100) / 100; // ~0.2KB per document estimate
        }

        return {
            queryName: 'Available for 7-day period in Aug 2025',
            datasetSize,
            resultCount: results.length,
            executionTime,
            explainStats: explainResult.executionStats,
            totalSpaces,
            totalBookings,
            spacesCollectionSizeMB,
            bookingsCollectionSizeMB
        };
    }

    async runTestForDataset(size, isIncremental = false) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`TESTING WITH ${size.toLocaleString()} BILLBOARDS`);
        console.log(`${'='.repeat(60)}`);

        if (!isIncremental) {
            await this.clearCollections();
        }

        const currentCount = await this.db.collection(BILLBOARD_COLLECTION).countDocuments();
        const billboardsToAdd = size - currentCount;
        
        if (billboardsToAdd > 0) {
            const billboardIds = await this.generateBillboards(billboardsToAdd);
            await this.generateBookings(billboardIds);
        }

        await this.createIndexes();

        // Run queries
        const query1Result = await this.runQuery1(size);
        const query2Result = await this.runQuery2(size);

        this.results.push(query1Result, query2Result);

        // Print summary
        console.log('\n--- Dataset Summary ---');
        console.log(`Total billboards: ${(await this.db.collection(BILLBOARD_COLLECTION).countDocuments()).toLocaleString()}`);
        console.log(`Total bookings: ${(await this.db.collection(BOOKING_COLLECTION).countDocuments()).toLocaleString()}`);
    }

    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('PERFORMANCE TEST REPORT');
        console.log('='.repeat(80));

        let csvContent = 'Dataset Size,Query Name,Result Count,Execution Time (ms),Total Spaces,Total Bookings,Spaces Collection Size (MB),Bookings Collection Size (MB),Documents Examined,Keys Examined\n';
        let txtReport = 'MONGODB BILLBOARD PERFORMANCE TEST REPORT\n';
        txtReport += '='.repeat(50) + '\n\n';

        for (const result of this.results) {
            console.log(`\nDataset: ${result.datasetSize.toLocaleString()} billboards`);
            console.log(`Query: ${result.queryName}`);
            console.log(`Results: ${result.resultCount.toLocaleString()}`);
            console.log(`Time: ${result.executionTime}ms`);
            console.log(`Total Spaces: ${result.totalSpaces?.toLocaleString() || 'N/A'}`);
            console.log(`Total Bookings: ${result.totalBookings?.toLocaleString() || 'N/A'}`);
            console.log(`Spaces Collection Size: ${result.spacesCollectionSizeMB || 'N/A'} MB`);
            console.log(`Bookings Collection Size: ${result.bookingsCollectionSizeMB || 'N/A'} MB`);
            console.log(`Documents Examined: ${result.explainStats.totalDocsExamined?.toLocaleString() || 'N/A'}`);
            console.log(`Index Keys Examined: ${result.explainStats.totalKeysExamined?.toLocaleString() || 'N/A'}`);

            csvContent += `${result.datasetSize},"${result.queryName}",${result.resultCount},${result.executionTime},${result.totalSpaces || 0},${result.totalBookings || 0},${result.spacesCollectionSizeMB || 0},${result.bookingsCollectionSizeMB || 0},${result.explainStats.totalDocsExamined || 0},${result.explainStats.totalKeysExamined || 0}\n`;
            
            txtReport += `Dataset Size: ${result.datasetSize.toLocaleString()} billboards\n`;
            txtReport += `Query: ${result.queryName}\n`;
            txtReport += `Result Count: ${result.resultCount.toLocaleString()}\n`;
            txtReport += `Execution Time: ${result.executionTime}ms\n`;
            txtReport += `Total Spaces: ${result.totalSpaces?.toLocaleString() || 'N/A'}\n`;
            txtReport += `Total Bookings: ${result.totalBookings?.toLocaleString() || 'N/A'}\n`;
            txtReport += `Spaces Collection Size: ${result.spacesCollectionSizeMB || 'N/A'} MB\n`;
            txtReport += `Bookings Collection Size: ${result.bookingsCollectionSizeMB || 'N/A'} MB\n`;
            txtReport += `Documents Examined: ${result.explainStats.totalDocsExamined?.toLocaleString() || 'N/A'}\n`;
            txtReport += `Keys Examined: ${result.explainStats.totalKeysExamined?.toLocaleString() || 'N/A'}\n`;
            txtReport += '-'.repeat(50) + '\n\n';
        }

        // Create reports directory if it doesn't exist
        const reportsDir = path.join(process.cwd(), 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
            console.log('Created reports directory');
        }

        // Save reports
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const csvPath = path.join(reportsDir, `performance_report_${timestamp}.csv`);
        const txtPath = path.join(reportsDir, `performance_report_${timestamp}.txt`);
        
        fs.writeFileSync(csvPath, csvContent);
        fs.writeFileSync(txtPath, txtReport);
        
        console.log(`\nReports saved:`);
        console.log(`- ${csvPath}`);
        console.log(`- ${txtPath}`);
    }

    async runFullTest() {
        try {
            await this.connect();
            await this.setupReferenceData();

            // Test with 2k billboards
            await this.runTestForDataset(2000);
            
            // Test with 10k billboards (incremental)
            await this.runTestForDataset(10000, true);
            
            // Test with 100k billboards (incremental)
            await this.runTestForDataset(100000, true);

            this.generateReport();
            
        } catch (error) {
            console.error('Test failed:', error);
        } finally {
            await this.disconnect();
        }
    }
}

// Run the test
const test = new BillboardPerformanceTest();
test.runFullTest().then(() => {
    console.log('\nPerformance test completed!');
    process.exit(0);
}).catch(error => {
    console.error('Test error:', error);
    process.exit(1);
});