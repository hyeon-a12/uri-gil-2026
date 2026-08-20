const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const path = require('path');
const fs = require('fs');
const { info } = require('console');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
const upload = multer({ dest: 'uploads/' });

const OUTPUT_DIR = path.join(__dirname, 'output');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
[OUTPUT_DIR, UPLOAD_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// 폰트 경로
const FONT_PATH = path.join(__dirname, 'fonts', 'Pretendard-Bold.ttf')
  .replace(/\\/g, '/')
  .replace(/:/g, '\\:');

function formatTime(recordedAt) {
  const date = new Date(recordedAt);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}\uff1a${minutes}`;
}

function makeDrawtext(text, yPosition) {
  return {
    filter: 'drawtext',
    options: {
      text: text,
      fontfile: FONT_PATH,
      fontsize: 30,
      fontcolor: 'white',
      x: '(w-text_w)/2',
      y: yPosition,
    },
  };
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

  let clipMetadata = [];
  let settings = {};

  try {
    if (req.body.clipMetadata) {
      clipMetadata = JSON.parse(req.body.clipMetadata);
    }
    if (req.body.settings) {
      settings = JSON.parse(req.body.settings);
    }
  } catch (e) {
    console.warn('파싱 실패:', e.message);
  }

  console.log('받은 파일 수:', files.length);
  console.log('메타데이터:', clipMetadata);
  console.log('settings:', settings);

  const timestamp = Date.now();
  const tempFiles = [];

  try {
    const processedFiles = [];

    for (let i=0; i<files.length; i++) {
      const file = files[i];
      const meta = clipMetadata[i] ?? {};
      const processedPath = path.join(UPLOAD_DIR, `processed_${timestamp}_${i}.mp4`);
      tempFiles.push(processedPath);

      const infoType = settings.infoContentType;
      console.log('클립 처리 시작');

      const filters = [];
      if (!infoType) {}
      else if (infoType === 'time') {
        if (meta.recordedAt) {
          const timeStr = formatTime(meta.recordedAt);
          filters.push(makeDrawtext(timeStr, '(h-text_h)/2'));
        }
      } else if (infoType === 'location') {
        if (meta.placeName) {
          filters.push(makeDrawtext(meta.placeName, '(h-text_h)/2'));
        }
      } else if (infoType === 'both') {
        if (meta.recordedAt) {
          const timeStr = formatTime(meta.recordedAt);
          filters.push(makeDrawtext(timeStr, '(h-text_h)/2-25'));
        }
        if (meta.placeName) {
          filters.push(makeDrawtext(meta.placeName, '(h-text_h)/2+25'));
        }
      }

      await new Promise((resolve, reject) => {
        const cmd = ffmpeg(file.path);

        if (filters.length > 0) {
          cmd.videoFilters(filters);
        }

        cmd
          .outputOptions([
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-preset', 'fast',
            '-pix_fmt', 'yuv420p',
          ])
          .output(processedPath)
          .on('start', (cmd) => console.log('FFmpeg 시작', cmd))
          .on('end', () => {
            console.log('클립 완료');
            processedFiles.push(processedPath);
            resolve(null);
          })
          .on('error', (err, stdout, stderr) => {
            console.error('FFmpeg 에러', err.message);
            reject(err);
          })
          .run();
      });
    }

    const listPath = path.join(UPLOAD_DIR, `list_${timestamp}.txt`);
    tempFiles.push(listPath);

    const listContent = processedFiles
      .map((p) => `file '${path.resolve(p).replace(/\\/g, '/')}'`)
      .join('\n');
    fs.writeFileSync(listPath, listContent);

    const outputPath = path.join(OUTPUT_DIR, `output_${timestamp}.mp4`);
    console.log('concat 리스트 생성', listPath);

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy'])
        .output(outputPath)
        .on('end', () => {
          console.log('병합 완료', outputPath);
          resolve(null);
        })
        .on('error', (err, stdout, stderr) => {
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
      tempFiles.forEach((f) => {
        try {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        } catch (_) {}
      });
      files.forEach((f) => {
        try {
          if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
        } catch (_) {}
      });
      console.log('임시 파일 정리 완료');
    }, 2000);
  } catch (error) {
    console.error('처리 실패', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });

    tempFiles.forEach((f) => {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch(_) {}
    });
    files.forEach((f) => {
      try {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      } catch (_) {}
    });
  }
});

app.get('/download/:filename', (req, res) => {
  const filePath = path.join(OUTPUT_DIR, req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('파일을 찾을 수 없습니다.');
  }

  res.sendFile(filePath);
});

app.listen(3000, () => console.log('서버 실행 중'));
