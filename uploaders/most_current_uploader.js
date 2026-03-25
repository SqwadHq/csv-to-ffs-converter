// upload-handler.js
// Based on: FFS Inbound Interface Specification v5.021 (03/20/2026)
const csv = require('csv-parser');
const fs = require('fs');
const Papa = require('papaparse');
const archiver = require('archiver');

// ---- Config & constants specific to upload flow ----
const FFS_SPEC_VERSION = "5.021"; // Update this when the spec changes
const sqwadVendorId = process.env.SQWAD_VENDOR_ID;

// ---- Generic helpers (copied from your file) ----
function getCurrentDateTimeFormatted(date) {
    const now = date ? new Date(date) : new Date();
    const month = ("0" + (now.getMonth() + 1)).slice(-2);
    const day = ("0" + now.getDate()).slice(-2);
    const year = now.getFullYear();
    const hours = ("0" + now.getHours()).slice(-2);
    const minutes = ("0" + now.getMinutes()).slice(-2);
    return `${month}/${day}/${year} ${hours}:${minutes}`;
}
function onlyDigits(value) { return (value || "").toString().replace(/\D/g, ""); }
function sanitizeAscii(text) { return (text||"").toString().replace(/[^\x00-\x7F]/g, ""); }
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
    return (val === "yes" || val === "y" || val === "true" || val === "checked" || val === "1" || val === "yes!" || val === "yep");
}
function matchCheckboxColumnName(columnName) {
    const name = columnName.toLowerCase();
    if (name.includes("18") && (name.includes("older") || name.includes("of age"))) return { question: "0985", answer: "A" };
    if (name.includes("please email me communications") || name.includes("opt-in") || name.includes("ford motor company and the local dealer"))
        return { question: "0799", answer: "A" };
    if ((name.includes("official rules") && name.includes("privacy policy")) || name.includes("read and agree"))
        return { question: "1430", answer: "A" };
    if (name.includes("21") && (name.includes("older") || name.includes("of age"))) return { question: "0985", answer: "A" };
    if (name.toLowerCase() === ('Are you a current Ford owner?').toLowerCase() || name.includes(('Are you a current Ford owner?').toLowerCase()))
        return { question: "0026", answer: "A" };
    return null;
}
function parseZip(input) {
    if (typeof input !== 'string') return { zip: null, extension: null };
    const regex = /\b(\d{5})(?:[-\s]?(\d{4}))?\b/;
    const match = input.trim().match(regex);
    if (!match) return { zip: null, extension: null };
    return { zip: match[1], extension: match[2] || null };
}
function likert1to5(val) {
    const n = Number(String(val || '').trim());
    if (n === 1) return 'A';
    if (n === 2) return 'B';
    if (n === 3) return 'C';
    if (n === 4) return 'D';
    if (n === 5) return 'E';
    return '';
}
function mapAgeBandTo0016(val) {
    const s = String(val || '').replace(/\s+/g,'').toLowerCase();
    if (/18[-–]24/.test(s)) return 'A';
    if (/25[-–]29/.test(s)) return 'B';
    if (/30[-–]34/.test(s)) return 'C';
    if (/35[-–]39/.test(s)) return 'D';
    if (/40[-–]44/.test(s)) return 'E';
    if (/45[-–]49/.test(s)) return 'F';
    if (/50[-–]59/.test(s)) return 'G';
    if (/60\+|over60|60andover|60plus/.test(s)) return 'H';
    return '';
}
function mapGenderTo0213(val) {
    const s = String(val || '').trim().toLowerCase();
    if (s.startsWith('male')) return 'A';
    if (s.startsWith('female')) return 'B';
    if (s.startsWith('prefer')) return 'C';
    return '';
}
const MAKE_CODE_MAP = {
    'FORD': 'FD','LINCOLN':'LIN','CHEVROLET':'CHV','CHEVY':'CHV','GMC':'GMC',
    'TOYOTA':'TOY','HONDA':'HON','NISSAN':'NIS','HYUNDAI':'HYU','KIA':'KIA',
    'JEEP':'JEE','DODGE':'DOD','RAM':'RAM','VOLKSWAGEN':'VW','VW':'VW',
    'BMW':'BMW','MERCEDES':'MER','MERCEDES-BENZ':'MER','AUDI':'AUD',
    'TESLA':'TEL','VOLVO':'VOL','SUBARU':'SUB','MAZDA':'MAZ','LEXUS':'LEX',
    'CADILLAC':'CAD','BUICK':'BUI','CHRYSLER':'CHR','PORSCHE':'POR',
    'INFINITI':'INF','ACURA':'ACU','JAGUAR':'JAG','LAND ROVER':'ROV','ROVER':'ROV',
    'RIVIAN':'RIV','GENESIS':'GEN','LUCID':'LUC','POLESTAR':'POL','VINFAST':'VFT',
    'OTHER':'OTH'
};
function mapMakeToCode(val) {
    if (!val) return '';
    const s = String(val).trim().toUpperCase();
    if (MAKE_CODE_MAP[s]) return MAKE_CODE_MAP[s];
    for (const k of Object.keys(MAKE_CODE_MAP)) if (s.includes(k)) return MAKE_CODE_MAP[k];
    return '';
}
function map1077(val) {
    const s = String(val || '').trim().toLowerCase();
    if (s.includes('0-30') || s.includes('0 – 30') || s.includes('0 — 30')) return 'A';
    if (s.includes('1-3')) return 'B';
    if (s.includes('4-6')) return 'C';
    if (s.includes('7+') || s.includes('7 +')) return 'D';
    if (s.includes('no definite')) return 'E';
    return '';
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

// ---- Fulfillment mapping & aliasing ----
// Updated per FFS Inbound Interface Specification v5.021 (03/20/2026) - Appendix A
const fulfillmentMap = {
    EN: {
        FORD: {
            // Current Model Year Brochures (English)
            "BRONCO": [{ year: "2026", code: "138" }],
            "BRONCO SPORT": [{ year: "2026", code: "141" }],
            "ELECTRIC VEHICLES": [{ year: "2026", code: "272" }],
            "ESCAPE": [{ year: "2026", code: "053" }],
            "EXPEDITION": [{ year: "2026", code: "007" }],
            "EXPLORER TREMOR": [{ year: "2026", code: "275" }], // Future vehicle — must be listed before EXPLORER
            "EXPLORER": [{ year: "2026", code: "006" }],
            "F-150": [{ year: "2026", code: "008" }],
            "F-150 LIGHTNING": [{ year: "2025", code: "262" }],
            "F-150 RAPTOR R": [{ year: "2024", code: "268" }],
            "FORD GT": [{ year: "2026", code: "210" }],
            "FORD PERFORMANCE - CARS": [{ year: "2026", code: "902" }],
            "FORD PERFORMANCE - TRUCKS": [{ year: "2026", code: "903" }],
            "MAVERICK": [{ year: "2026", code: "261" }],
            "MUSTANG": [{ year: "2026", code: "002" }],
            "MUSTANG GTD": [{ year: "2025", code: "273" }],
            "MUSTANG MACH-E": [{ year: "2026", code: "140" }],
            "RANGER": [{ year: "2026", code: "010" }],
            "SUPER DUTY (F-250)": [{ year: "2026", code: "012" }],
            "TRANSIT": [{ year: "2026", code: "132" }],
            "TRANSIT CONNECT WAGON": [{ year: "2023", code: "133" }],
        },
        LINCOLN: {
            "AVIATOR": [{ year: "2026", code: "201" }],
            "BLACK LABEL": [{ year: "2025", code: "220" }],
            "CORSAIR": [{ year: "2026", code: "224" }],
            "NAUTILUS": [{ year: "2026", code: "221" }],
            "NAVIGATOR": [{ year: "2026", code: "033" }],
        },
    },
    SP: {
        FORD: {
            "EDGE": [{ year: "2023", code: "107" }],
            "ESCAPE": [{ year: "2023", code: "124" }],
            "EXPEDITION": [{ year: "2023", code: "218" }],
            "EXPLORER": [{ year: "2023", code: "125" }],
            "F-150": [{ year: "2023", code: "118" }],
            "MUSTANG": [{ year: "2024", code: "119" }],
            "RANGER": [{ year: "2023", code: "254" }],
            "SUPER DUTY": [{ year: "2023", code: "136" }],
        },
    },
};
function normalizeLang(v, defaults) {
    const s = (v || defaults?.defaultFulfillmentLanguage || "EN").toString().trim().toUpperCase();
    return s === "SP" ? "SP" : "EN";
}
function parseDesiredYear(txt) {
    const m = (txt || "").toString().match(/\b(20\d{2})\b/);
    return m ? m[1] : null;
}
function normalizeVehicleAlias(s) {
    if (!s) return "";
    let v = s.toString().toUpperCase();
    const compact = v.replace(/[^A-Z0-9]+/g, " ").trim();
    v = compact
        .replace(/\bF\s*150\b/g, "F-150")
        .replace(/\bMACH\s*E\b/g, "MUSTANG MACH-E")
        .replace(/\bSUPER\s*DUTY\b/g, "SUPER DUTY (F-250)")
        .replace(/\bBRONCO\s*SPORT\b/g, "BRONCO SPORT")
        .replace(/\bEXPLORER\s*TREMOR\b/g, "EXPLORER TREMOR")
        .replace(/\bTRANSIT\s*CONNECT\b/g, "TRANSIT CONNECT WAGON")
        .replace(/\bELECTRIC\s*VEHICLES?\b/g, "ELECTRIC VEHICLES");
    return v.replace(/\s+/g, " ").trim();
}
function detectBrand(vehicleText) {
    const v = (vehicleText || "").toString().toUpperCase();
    const lincolnHits = ["AVIATOR","CORSAIR","NAUTILUS","NAVIGATOR","BLACK LABEL"];
    return lincolnHits.some(t => v.includes(t)) ? "LINCOLN" : "FORD";
}
function pickFromMap({ vehicleText, brand, lang, desiredYear }) {
    if (!vehicleText) return null;
    const normalized = normalizeVehicleAlias(vehicleText);
    const brandMap = fulfillmentMap[lang]?.[brand];
    if (!brandMap) return null;

    if (brandMap[normalized]) {
        const options = brandMap[normalized];
        if (desiredYear) {
            const hit = options.find(o => o.year === String(desiredYear));
            if (hit) return hit;
        }
        return options[options.length - 1];
    }
    const key = Object.keys(brandMap).find(k => normalized.includes(k));
    if (!key) return null;

    const options = brandMap[key];
    if (desiredYear) {
        const hit = options.find(o => o.year === String(desiredYear));
        if (hit) return hit;
    }
    return options[options.length - 1];
}
function collectVehiclesFromRow(row) {
    return Object.keys(row)
        .map(k => k.match(/^Vehicle\s*#\s*(\d+)/i))
        .filter(Boolean)
        .map(m => m[1])
        .sort((a,b) => a - b)
        .map(n => ({ n, text: row[`Vehicle #${n}`] }))
        .filter(v => v.text && String(v.text).trim() !== "");
}
function parseRowsPerFile(input) {
    const n = parseInt(input, 10);
    return Number.isInteger(n) && n > 0 ? n : null;
}

// ---- Row transforms & record formatters ----
function transformRow(row, defaults) {
    const qas = [];
    for (const colName of Object.keys(row)) {
        if (isYesValue(row[colName])) {
            const mapping = matchCheckboxColumnName(colName);
            if (mapping) qas.push(mapping);
        }
    }

    const ageKey   = 'What age range do you fall into?';
    const genKey   = 'Select Gender';
    const makeKey  = 'What is your current vehicle make?';
    const imkKey   = 'When do you plan to acquire your next vehicle?';
    const loveKey  = 'Ford is a brand that helps me do the things I love.';
    const confKey  = 'Ford is a brand that helps me feel capable and confident.';

    const ageAns = mapAgeBandTo0016(row[ageKey]); if (ageAns) qas.push({ question: '0016', answer: ageAns });
    const genAns = mapGenderTo0213(row[genKey]);  if (genAns) qas.push({ question: '0213', answer: genAns });
    const makeCode = mapMakeToCode(row[makeKey]); if (makeCode) qas.push({ question: '0988', answer: makeCode });
    const imkAns = map1077(row[imkKey]);          if (imkAns) qas.push({ question: '1077', answer: imkAns });
    const loveAns = likert1to5(row[loveKey]);     if (loveAns) qas.push({ question: '1644', answer: loveAns });
    const confAns = likert1to5(row[confKey]);     if (confAns) qas.push({ question: '1645', answer: confAns });

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
    for (let i = 1; i <= 30; i++) if (row[`question${i}`]) nextIndex = i + 1;

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
    const zipObject = parseZip(row.zip || row['Zip Code'] || "");
    const zip = pad(zipObject.zip, 6);
    const zip4 = pad(zipObject.extension || "", 4);
    const phoneHome = pad(onlyDigits(row.phoneHome) || onlyDigits(row['Phone Number']) || "", 10);
    const phoneWork = pad(onlyDigits(row.phoneWork) || "", 10);
    const email = pad(row.email || row['Email'] || "", 80);

    let campaignNumberRaw = (row.campaignNumber ?? row['UTM Campaign'] ?? defaults.defaultUtmCampaign ?? "");
    let sequenceNumberRaw = (row.sequenceNumber ?? row['Sequence Number'] ?? row['SRC Code'] ?? defaults.defaultSequenceNumber ?? "");
    if (typeof sequenceNumberRaw === 'string' && sequenceNumberRaw.includes('-')) {
        const [c, s] = sequenceNumberRaw.split('-');
        if (!campaignNumberRaw || String(campaignNumberRaw).trim() === "") campaignNumberRaw = (c || "").trim();
        sequenceNumberRaw = (s || "").trim();
    }
    if (!campaignNumberRaw && defaults.defaultUtmCampaign) campaignNumberRaw = defaults.defaultUtmCampaign;

    const campaignNumber = pad(String(campaignNumberRaw || ""), 10);
    const sequenceNumber = pad(String(sequenceNumberRaw || ""), 3);  // v5.021: positions 378-380, length 3
    const requestDate = pad(getCurrentDateTimeFormatted(row.requestDate || row['Sign Up Time'] || ""), 16);

    const externalVendorTracking = pad("", 50); // v5.021: positions 381-430, length 50
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
        if (!isNaN(question) && question !== "") {
            question = question.toString().padStart(4, "0");
        } else {
            question = pad(question, 4);
        }
        let answer = pad(row["answer" + i] || "", 20);
        qaArray += question + answer;
    }

    let record = divisionCode + businessFlag + consumerKey + title + businessName + firstName +
        middleInitial + lastName + suffix + street1 + street2 + city + state + country + zip + zip4 +
        phoneHome + phoneWork + email + campaignNumber + sequenceNumber + externalVendorTracking +
        filler10 + requestDate + vin + preferredDealer + fulfillmentCode + fulfillmentYear +
        fulfillmentChannel + fulfillmentLanguage + qaArray;

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

// ---- The only function you call from your route ----
function handleUpload(req, res) {
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

            // Filter out rows without a valid email.
            const filteredResults = results.filter(row => {
                const email = row.email || row['Email'] || "";
                return isValidEmail(email);
            });

            // Clean temp upload
            fs.unlink(csvFilePath, err => { if (err) console.error(err); });

            // If CSV export requested, just transform and return CSV
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

            // Otherwise, stream a zip of fixed-width .txt batches
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', 'attachment; filename=converted.zip');

            const CHUNK_SIZE = 2000;
            const chunkSize = rowsPerFile || CHUNK_SIZE;
            console.log(chunkSize);
            const archive = archiver('zip', { zlib: { level: 9 } });
            archive.on('error', (err) => { throw err; });
            archive.pipe(res);

            const finalDetails = [];

            for (const row of filteredResults) {
                const vehicles = collectVehiclesFromRow(row);
                let emitted = 0;

                for (const {n, text} of vehicles) {
                    const brand = detectBrand(text);
                    const lang = normalizeLang(row['Brochure Language'], defaults);
                    const yearWanted = parseDesiredYear(text);
                    const hit = pickFromMap({ vehicleText: text, brand, lang, desiredYear: yearWanted });
                    if (!hit) continue;

                    const cloned = { ...row };
                    cloned.fulfillmentCode = hit.code;
                    cloned.fulfillmentYear = hit.year;
                    cloned.fulfillmentChannel = "P";
                    cloned.fulfillmentLanguage = lang;
                    cloned.divisionCode = brand === "LINCOLN" ? "LM" : "FD";

                    const perVehicleSrc = (row[`SRC Code Vehicle ${n}`] || row['SRC Code'] || "").toString();
                    if (perVehicleSrc.includes("-")) {
                        const [c, s] = perVehicleSrc.split("-");
                        cloned.campaignNumber = (c || "").trim();
                        cloned.sequenceNumber = (s || "").trim();
                    }

                    finalDetails.push(createDetail(cloned, defaults));
                    emitted++;
                }

                if (!emitted) {
                    // emit a non-fulfillment record (still valid)
                    finalDetails.push(createDetail(row, defaults));
                }
            }

            for (let i = 0; i < finalDetails.length; i += chunkSize) {
                const chunk = finalDetails.slice(i, i + chunkSize);
                const header  = createHeader();
                const trailer = createTrailer(chunk);
                const content = [header, ...chunk, trailer].join('\n');
                const partNum = Math.floor(i / chunkSize) + 1;
                archive.append(content, { name: `converted_part${partNum}_records_${chunk.length}.txt` });
            }

            archive.finalize();
        });
}

module.exports = { handleUpload };
