# CSV to FFS Converter

A client-side web tool that converts CSV files into Ford's FFS (Ford Fulfillment System) fixed-width format. Everything runs in the browser -- no data is uploaded to any server.

**Live tool:** https://sqwadhq.github.io/csv-to-ffs-converter/

## How it works

1. Enter your Vendor ID
2. Optionally set a default UTM Campaign and Sequence Number
3. Choose an export format (fixed-width TXT or transformed CSV)
4. Select your CSV file and click convert
5. The converted file downloads automatically

## Uploaders

- **Main** -- Full converter with vehicle/fulfillment lookup, brochure language support, and extended survey question mapping
- **NFL** -- Simplified converter for NFL event data with exhibition-focused survey questions

## CSV Column Mapping

Click the **info icon** next to the page title for a full reference of supported column names, survey questions, and expected values. Also available in [CSV_COLUMN_REFERENCE.md](CSV_COLUMN_REFERENCE.md).

## Tech

Static HTML + JavaScript. No build step, no server, no dependencies to install.

- [PapaParse](https://www.papaparse.com/) -- CSV parsing
- [JSZip](https://stuk.github.io/jszip/) -- ZIP file generation

Both loaded via CDN.
