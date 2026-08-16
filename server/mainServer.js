const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// 영상 업로드 & 처리 API
app.post('/process-video', upload.single('video'), (req, res) => {
  const inputPath = req.file.path;
  const outputPath = `output/${Date.now()}.mp4`;

  ffmpeg(inputPath)
    .output(outputPath)
    .size('1280x720')
    .duration(30)
    .on('end', () => {
      res.json({ uri: `/download/${outputPath}` });
    })
    .on('error', (err) => {
      res.status(500).json({ error: err.message });
    })
    .run();
});

app.listen(3000, () => console.log('서버 실행 중'));
