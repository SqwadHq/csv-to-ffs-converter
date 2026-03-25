// upload-handler2.js
const csv = require('csv-parser');
const fs = require('fs');
const Papa = require('papaparse');
const archiver = require('archiver');

const sqwadVendorId = process.env.SQWAD_VENDOR_ID;

// ---------------- helpers ----------------
function getCurrentDateTimeFormatted(date) {
    const now = date ? new Date(date) : new Date();
    const month = ("0" + (now.getMonth() + 1)).slice(-2);
    const day = ("0" + now.getDate()).slice(-2);
    const year = now.getFullYear();
    const hours = ("0" + now.getHours()).slice(-2);
    const minutes = ("0" + now.getMinutes()).slice(-2);
    return `${month}/${day}/${year} ${hours}:${minutes}`;
}
function sanitizeAscii(text) {
    return (text || "").toString().replace(/[^\x00-\x7F]/g, "");
}
function pad(text, length) {
    const clean = sanitizeAscii(text);
    if (clean.length > length) return clean.slice(0, length);
    return clean.padEnd(length, " ");
}
function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}
function isYesValue(value) {
    if (!value) return false;
    const val = value.toString().trim().toLowerCase();
    return (
        val === "yes" || val === "y" || val === "true" || val === "checked" ||
        val === "1" || val === "yes!" || val === "yep"
    );
}
function matchCheckboxColumnName(columnName) {
    const name = columnName.toLowerCase();

    if (name.includes("18") && (name.includes("older") || name.includes("of age"))) {
        return { question: "0985", answer: "A" };
    }
    if (name.includes("please email me communications") || name.includes("opt-in") || name.includes("ford motor company and the local dealer")) {
        return { question: "0799", answer: "A" };
    }
    if ((name.includes("official rules") && name.includes("privacy policy")) || name.includes("read and agree")) {
        return { question: "1430", answer: "A" };
    }
    if (name.includes("21") && (name.includes("older") || name.includes("of age"))) {
        return { question: "0985", answer: "A" };
    }
    if (name.toLowerCase() === ('Are you a current Ford owner?').toLowerCase() ||
        name.includes(('Are you a current Ford owner?').toLowerCase())) {
        return { question: "0026", answer: "A" };
    }
    return null;
}
function parseZip(input) {
    if (typeof input !== 'string') {
        return { zip: null, extension: null };
    }
    const regex = /\b(\d{5})(?:[-\s]?(\d{4}))?\b/;
    const match = input.trim().match(regex);
    if (!match) return { zip: null, extension: null };
    return { zip: match[1], extension: match[2] || null };
}
function parseRowsPerFile(input) {
    const n = parseInt(input, 10);
    return Number.isInteger(n) && n > 0 ? n : null;
}

// 1458 - Annual household income
function map1458(val) {
    const s = String(val || '').trim().toLowerCase();
    if (s.includes('under') && s.includes('50,000')) return 'A';
    if (s.includes('50,001') && s.includes('74,999')) return 'B';
    if (s.includes('75,000') && s.includes('99,999')) return 'C';
    if (s.includes('100,000') && s.includes('150,000')) return 'D';
    if (s.includes('over') && s.includes('150,000')) return 'E';
    if (s.includes('prefer not')) return 'F';
    return '';
}

// 1669 - Time spent in exhibition
function map1669(val) {
    const s = String(val || '').trim().toLowerCase();
    if (s.includes('less than 15')) return 'A';
    if (s.includes('15') && s.includes('30')) return 'B';
    if (s.includes('31') && s.includes('60')) return 'C';
    if (s.includes('more than 60')) return 'D';
    return '';
}

// 1670 - Distance traveled
function map1670(val) {
    const s = String(val || '').trim().toLowerCase();
    if (s.includes('10 miles or less')) return 'A';
    if (s.includes('11') && s.includes('30')) return 'B';
    if (s.includes('31') && s.includes('50')) return 'C';
    if (s.includes('51') && s.includes('100')) return 'D';
    if (s.includes('more than 100')) return 'E';
    return '';
}

// 1671 - NPS recommendation (0-10)
function map1671(val) {
    const n = parseInt(String(val || '').trim(), 10);
    if (n === 0) return 'A';
    if (n === 1) return 'B';
    if (n === 2) return 'C';
    if (n === 3) return 'D';
    if (n === 4) return 'E';
    if (n === 5) return 'F';
    if (n === 6) return 'G';
    if (n === 7) return 'H';
    if (n === 8) return 'I';
    if (n === 9) return 'J';
    if (n === 10) return 'K';
    return '';
}

// 1672 - How learned about exhibition
function map1672(val) {
    const s = String(val || '').trim().toLowerCase();
    if (s === 'newspaper') return 'A';
    if (s === 'billboard') return 'B';
    if (s.includes('email from venue')) return 'C';
    if (s === 'radio') return 'D';
    if (s.includes('word of mouth')) return 'E';
    if (s.includes('social media')) return 'F';
    if (s === 'television') return 'G';
    if (s.includes('signs within')) return 'H';
    if (s.includes('venue website')) return 'I';
    if (s.includes('online') || s.includes('digital advertising')) return 'J';
    if (s === 'other') return 'K';
    return '';
}

// 1673 - Who visiting with
function map1673(val) {
    const s = String(val || '').trim().toLowerCase();
    if (s.includes('other type of group')) return 'A';
    if (s.includes('adult') && s.includes('only')) return 'B';
    if (s.includes('combination') || (s.includes('adults') && s.includes('children'))) return 'C';
    if (s === 'alone') return 'D';
    if (s.includes('chaperone') || s.includes('school group')) return 'E';
    return '';
}

// ---------------- transforms/formatters ----------------
function transformRow(row, defaults) {
    const qas = [];
    for (const colName of Object.keys(row)) {
        if (isYesValue(row[colName])) {
            const mapping = matchCheckboxColumnName(colName);
            if (mapping) qas.push(mapping);
        }
    }

    const incomeKey = 'What is your annual household income?';
    const timeKey = 'How much time did you spend in the exhibition?';
    const distKey = 'How far did you travel to visit the exhibition?';
    const npsKey = 'How likely is it that you would recommend this exhibition to a friend or colleague?';
    const learnKey = 'How did you learn about the exhibition?';
    const visitKey = 'Who are you visiting with today?';

    const incomeAns = map1458(row[incomeKey]); if (incomeAns) qas.push({ question: '1458', answer: incomeAns });
    const timeAns = map1669(row[timeKey]);     if (timeAns) qas.push({ question: '1669', answer: timeAns });
    const distAns = map1670(row[distKey]);     if (distAns) qas.push({ question: '1670', answer: distAns });
    const npsAns = map1671(row[npsKey]);       if (npsAns) qas.push({ question: '1671', answer: npsAns });
    const learnAns = map1672(row[learnKey]);   if (learnAns) qas.push({ question: '1672', answer: learnAns });
    const visitAns = map1673(row[visitKey]);   if (visitAns) qas.push({ question: '1673', answer: visitAns });

    let nextIndex = 1;
    for (let i = 1; i <= 30; i++) {
        if (row[`question${i}`]) nextIndex = i + 1;
    }

    qas.forEach(({ question, answer }) => {
        if (nextIndex <= 30) {
            row[`question${nextIndex}`] = question;
            row[`answer${nextIndex}`] = answer;
            nextIndex++;
        }
    });

    return row;
}

function createHeader() {
    const headerCode = "H";
    const vendorId = pad(sqwadVendorId, 20);
    const dateTime = pad(getCurrentDateTimeFormatted(), 16);
    const version = pad("V2", 2);
    const filler48 = pad("", 48);
    const headerEmail = pad("tester@ford.com", 80);
    const filler1054 = pad("", 1054);
    let record = headerCode + vendorId + dateTime + version + filler48 + headerEmail + filler1054;
    if (record.length < 1221) record = record.padEnd(1221, " ");
    else if (record.length > 1221) record = record.substring(0, 1221);
    return record;
}

function createDetail(row, defaults) {
    row = transformRow(row, defaults);

    const divisionCode = pad(row.divisionCode || "FD", 3);
    const businessFlag = pad(row.businessFlag || "I", 1);
    const consumerKey = pad(row.consumerKey || "", 11);
    const title = pad(row.title || "", 6);
    const businessName = pad(row.businessName || "", 40);
    const firstName = pad(row.firstName || row['First Name'] || "", 30);
    const middleInitial = pad(row.middleInitial || "", 1);
    const lastName = pad(row.lastName || row['Last Name'] || "", 35);
    const suffix = pad(row.suffix || "", 5);
    const street1 = pad(row.street1 || row['Street'] || "", 40);
    const street2 = pad(row.street2 || "", 40);
    const city = pad(row.city || row['City'] || "", 40);
    const state = pad(row.state || row['State'] || "", 2);
    const country = pad(row.country || "USA", 3);

    const zipCodeFull = row.zip || row['Zip Code'] || "";
    const zipObject = parseZip(zipCodeFull);
    const zip = pad(zipObject.zip, 6);
    const zip4 = pad(zipObject.extension || "", 4);

    const phoneHome = pad(row.phoneHome || row['Phone Number'] || "", 10);
    const phoneWork = pad(row.phoneWork || "", 10);
    const email = pad(row.email || row['Email'] || "", 80);

    let campaignNumber = pad(row.campaignNumber || row['UTM Campaign'] || defaults.defaultUtmCampaign || "", 10);
    let sequenceNumberRaw = row.sequenceNumber || row['Sequence Number'] || row['SRC Code'] || defaults.defaultSequenceNumber || "";

    if (typeof sequenceNumberRaw === 'string' && sequenceNumberRaw.includes('-')) {
        const [c, s] = sequenceNumberRaw.split('-');
        campaignNumber = pad(c || "", 10);
        sequenceNumberRaw = s || "";
    } else {
        // If no hyphen format, prefer default campaign from defaults
        campaignNumber = pad(defaults.defaultUtmCampaign || campaignNumber, 10);
    }

    const sequenceNumber = pad(sequenceNumberRaw, 10);
    const requestDate = pad(getCurrentDateTimeFormatted(row.requestDate || row['Sign Up Time'] || ""), 16);

    const externalVendorTracking = pad("", 43); // (note from your comment: supposed to be 50)
    const filler10 = pad("", 10);
    const vin = pad(row.vin || "", 17);
    const preferredDealer = pad(row.preferredDealer || "", 6);
    const fulfillmentCode = pad(row.fulfillmentCode || "", 15);
    const fulfillmentYear = pad(row.fulfillmentYear || "", 4);
    const fulfillmentChannel = pad(row.fulfillmentChannel || "", 1);
    const fulfillmentLanguage = pad(row.fulfillmentLanguage || "", 2);

    let qaArray = "";
    for (let i = 1; i <= 30; i++) {
        let question = row["question" + i] || "";
        if (!isNaN(question) && question !== "") question = question.toString().padStart(4, "0");
        else question = pad(question, 4);
        let answer = pad(row["answer" + i] || "", 20);
        qaArray += question + answer;
    }

    let record =
        divisionCode + businessFlag + consumerKey + title + businessName + firstName +
        middleInitial + lastName + suffix + street1 + street2 + city + state + country +
        zip + zip4 + phoneHome + phoneWork + email + campaignNumber + sequenceNumber +
        externalVendorTracking + filler10 + requestDate + vin + preferredDealer +
        fulfillmentCode + fulfillmentYear + fulfillmentChannel + fulfillmentLanguage +
        qaArray;

    if (record.length < 1221) record = record.padEnd(1221, " ");
    else if (record.length > 1221) record = record.substring(0, 1221);

    return record;
}

function createTrailer(results) {
    const trailerCode = "T";
    const vendorId = pad(sqwadVendorId, 20);
    const dateTime = pad(getCurrentDateTimeFormatted(), 16);
    const filler50 = pad("", 50);
    const recordCountField = pad(results.length.toString(), 10);
    const filler1124 = pad("", 1124);

    let record = trailerCode + vendorId + dateTime + filler50 + recordCountField + filler1124;
    if (record.length < 1221) record = record.padEnd(1221, " ");
    else if (record.length > 1221) record = record.substring(0, 1221);
    return record;
}

// ---------------- handler ----------------
function handleNflUpload(req, res) {
    const defaultUtmSourceInput = req.body.defaultUtmSource || '';
    const defaultSequenceCode = req.body.defaultSequenceCode || '';
    const defaultSequenceNumber = req.body.defaultSequenceNumber || '';
    const defaultUtmCampaign = req.body.defaultUtmCampaign || '';
    const exportFormat = req.body.exportFormat || 'txt'; // "txt" or "csv"
    const rowsPerFileInput = parseRowsPerFile(req.body.rowsPerFile);
    const rowsPerFile = rowsPerFileInput ?? 5000;

    const defaults = {
        defaultUtmSource: defaultUtmSourceInput,
        defaultSequenceCode,
        defaultUtmCampaign,
        defaultSequenceNumber
    };

    const csvFilePath = req.file.path;
    const results = [];

    fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
            // Remove columns where all rows are empty.
            const allKeys = new Set();
            results.forEach(row => Object.keys(row).forEach(key => allKeys.add(key)));
            const columnsToRemove = [];
            allKeys.forEach(key => {
                const allEmpty = results.every(row => {
                    const value = row[key];
                    return !value || value.toString().trim() === "";
                });
                if (allEmpty) columnsToRemove.push(key);
            });
            results.forEach(row => columnsToRemove.forEach(key => delete row[key]));

            // Keep only rows with a valid email
            const filteredResults = results.filter(row => {
                const email = row.email || row['Email'] || "";
                return isValidEmail(email);
            });

            // Remove temp file
            fs.unlink(csvFilePath, err => { if (err) console.error(err); });

            // CSV branch
            if (exportFormat === 'csv') {
                const transformed = filteredResults.map(r => transformRow(r, defaults));
                if (rowsPerFile && transformed.length > rowsPerFile) {
                    res.setHeader('Content-Type', 'application/zip');
                    res.setHeader('Content-Disposition', 'attachment; filename=converted_csv_parts.zip');

                    const archive = archiver('zip', { zlib: { level: 9 } });
                    archive.on('error', (err) => { throw err; });
                    archive.pipe(res);

                    for (let i = 0; i < transformed.length; i += rowsPerFile) {
                        const chunk = transformed.slice(i, i + rowsPerFile);
                        const csvOutput = Papa.unparse(chunk);
                        const partNum = Math.floor(i / rowsPerFile) + 1;
                        archive.append(csvOutput, { name: `converted_part${partNum}.csv` });
                    }

                    return archive.finalize();
                }
                const csvOutput = Papa.unparse(transformed);
                res.setHeader("Content-Type", "text/csv");
                res.setHeader("Content-Disposition", "attachment; filename=converted.csv");
                return res.send(csvOutput);
            }

            // TXT->ZIP branch
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', 'attachment; filename=converted.zip');

            const CHUNK_SIZE = 15000;
            const chunkSize = rowsPerFile || CHUNK_SIZE;
            const archive = archiver('zip', { zlib: { level: 9 } });
            archive.on('error', (err) => { throw err; });
            archive.pipe(res);

            for (let i = 0; i < filteredResults.length; i += chunkSize) {
                const chunk = filteredResults.slice(i, i + chunkSize);
                const header  = createHeader();
                const details = chunk.map(r => createDetail(r, defaults));
                const trailer = createTrailer(chunk);

                const content = [header, ...details, trailer].join('\n');
                const partNum = Math.floor(i / chunkSize) + 1;
                const recordCount = chunk.length;
                archive.append(content, { name: `converted_part${partNum}_records_${recordCount}.txt` });
            }

            archive.finalize();
        });
}

module.exports = { handleNflUpload };
