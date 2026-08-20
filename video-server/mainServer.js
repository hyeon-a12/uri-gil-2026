const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const path = require('path');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
const upload = multer({ dest: 'uploads/' });

const OUTPUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 영상 업로드 & 처리 API
app.post('/process-video', upload.array('videos', 20), async(req, res) => {
  const files = req.files;

  if (!files || files.length === 0) {
    return res.status(400).json({
      success: false,
      message: '업로드된 영상이 없습니다.',
    });
  }

  const timestamp = Date.now();
  const listPath = path.join(__dirname, 'uploads', `list_${timestamp}.txt`);
  const outputPath = path.join(OUTPUT_DIR, `output_${timestamp}.mp4`);

  try {
    const listContent = files
      .map((f) => `file '${path.resolve(f.path).replace(/\\/g, '/')}'`)
      .join('\n');
    fs.writeFileSync(listPath, listContent);
    console.log('concat 리스트 생성', listPath);

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions([
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-preset', 'fast',
          '-pix_fmt', 'yuv420p',
        ])
        .output(outputPath)
        .on('start', (cmd) => console.log('FFmpeg 시작', cmd))
        .on('progress', (progress) => {
          console.log('진행률', Math.round(progress.percent ?? 0), '%');
        })
        .on('end', () => {
          console.log('병합 완료', outputPath);
          resolve(null);
        })
        .on('error', (err) => {
          console.error('FFmpeg 에러', err.message);
          reject(err);
        })
        .run();
    });

    const downloadUrl = `/download/${path.basename(outputPath)}`;
    res.json({
      success: true,
      downloadUrl: `http://${req.headers.host}${downloadUrl}`,
    });

    setTimeout(() => {
      try {
        fs.unlinkSync(listPath);
        files.forEach((f) => fs.unlinkSync(f.path));
        console.log('임시 파일 정리 완료');
      } catch (cleanupErr) {
        console.warn('정리 실패', cleanupErr.message);
      }
    }, 1000);
  } catch (error) {
    console.error('처리 실패', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });

    try {
      if (fs.existsSync(listPath)) fs.unlinkSync(listPath);
      files.forEach((f) => {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });
    } catch (_) {}
  }
});

app.get('/download/:filename', (req, res) => {
  const filePath = path.join(OUTPUT_DIR, req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('파일을 찾을 수 없습니다.');
  }

  res.sendFile(filePath);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`서버 실행 중: ${PORT}`));
