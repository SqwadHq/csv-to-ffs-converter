const express = require('express');
const multer = require('multer');
const path = require('path');
const {handleUpload} = require("./uploaders/most_current_uploader");
const {handleNflUpload} = require("./uploaders/nfl_uploader");

const app = express();
const upload = multer({ dest: 'uploads/' });

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse URL-encoded data (for non-file fields)
app.use(express.urlencoded({ extended: true }));

// Endpoint to handle CSV file upload and conversion.
app.post('/upload', upload.single('csvFile'), handleUpload);
app.post('/nfl_upload', upload.single('csvFile'), handleNflUpload);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
