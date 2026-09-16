const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// 다운로드 준비된 결과물을 이 시간(ms) 뒤에 자동으로 지웁니다. 클라이언트는
// 렌더링 응답을 받자마자 같은 흐름 안에서 바로 다운로드하므로(video-edit.tsx),
// 정상적인 네트워크 지연/재시도를 감안해도 이 정도면 충분히 여유 있는 시간입니다.
const OUTPUT_RETENTION_MS = 10 * 60 * 1000;

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
const upload = multer({ dest: 'uploads/' });

const OUTPUT_DIR = path.join(__dirname, 'output');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
[OUTPUT_DIR, UPLOAD_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const FONT_DIR = path.join(__dirname, 'fonts');
const FONT_MAP = {
  pretendard: {
    regular: 'Pretendard-Regular.ttf',
    bold: 'Pretendard-Bold.ttf',
  },
  maruburi: {
    regular: 'MaruBuri-Regular.ttf',
    bold: 'MaruBuri-Bold.ttf',
  },
  keriskedu: {
    regular: 'KERISKEDU_R.ttf',
    bold: 'KERISKEDU_B.ttf',
  },
  hakgyoansimnadeuri: {
    regular: 'HakgyoansimNadeuri-Light.ttf',
    bold: 'HakgyoansimNadeuri-Bold.ttf',
  },
  hakgyoansimbyeolbichhaneul: {
    regular: 'HakgyoansimByeolbichhaneul-Light.ttf',
    bold: 'HakgyoansimByeolbichhaneul-Bold.ttf',
  },
};

function getFontPath(fontId, bold) {
  const font = FONT_MAP[fontId] ?? FONT_MAP.pretendard;
  const fileName = bold ? font.bold : font.regular;
  const fullPath = path.join(FONT_DIR, fileName);

  if (!fs.existsSync(fullPath)) {
    console.warn('폰트 파일 없음');
    return path.join(FONT_DIR, 'Pretendard-Bold.ttf')
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
  }

  return fullPath
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
}

function getXY(position) {
  const margin = 50;

  const map = {
    // 상단
    topLeft: { x: margin, y: margin },
    topCenter: { x: '(w-text_w)/2', y: margin },
    topRight: { x: `w-text_w-${margin}`, y: margin },

    // 중간
    middleLeft: { x: margin, y: '(h-text_h)/2' },
    center: { x: '(w-text_w)/2', y: '(h-text_h)/2' },
    middleRight: { x: `w-text_w-${margin}`, y: '(h-text_h)/2' },

    // 하단
    bottomLeft: { x: margin, y: `h-text_h-${margin}` },
    bottomCenter: { x: '(w-text_w)/2', y: `h-text_h-${margin}` },
    bottomRight: { x: `w-text_w-${margin}`, y: `h-text_h-${margin}` },
  };

  return map[position] ?? map.center;
}

function adjustY(yStr, offset) {
  if (!isNaN(Number(yStr))) {
    return String(Number(yStr) + offset);
  }

  if (offset >= 0) {
    return `${yStr}+${offset}`;
  } else {
    return `${yStr}${offset}`;
  }
}

function formatTime(recordedAt) {
  const date = new Date(recordedAt);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}\uff1a${minutes}`;
}

function makeDrawtext(text, xPosition, yPosition, color, bold, fontId, fontSize) {
  const fontPath = getFontPath(fontId, bold);  
  return {
    filter: 'drawtext',
    options: {
      text: text,
      fontfile: fontPath,
      fontsize: fontSize || 30,
      fontcolor: color || 'white',
      x: xPosition,
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
      const position = settings.textPosition ?? 'center';
      const { x, y } = getXY(position);

      const timeStyle = settings.timeStyle ?? {};
      const placeStyle = settings.placeStyle ?? {};

      console.log(`클립 ${i} 처리 시작`, {
        placeName: meta.placeName,
        recordedAt: meta.recordedAt,
        isMuted: meta.recordedAt,
        infoType,
        timeStyle,
        placeStyle,
      });

      const filters = [];
      if (!infoType) {}
      else if (infoType === 'time') {
        if (meta.recordedAt) {
          const timeStr = formatTime(meta.recordedAt);
          filters.push(makeDrawtext(
            timeStr, x, y,
            timeStyle.color, timeStyle.bold, timeStyle.fontId, timeStyle.fontSize
          ));
        }
      } else if (infoType === 'location') {
        if (meta.placeName) {
          filters.push(makeDrawtext(
            meta.placeName, x, y,
            placeStyle.color, placeStyle.bold, placeStyle.fontId, placeStyle.fontSize  // ← fontId 수정
          ));
        }
      } else if (infoType === 'both') {
        if (meta.recordedAt) {
          const timeStr = formatTime(meta.recordedAt);
          filters.push(makeDrawtext(
            timeStr, x, adjustY(y, -25),
            timeStyle.color, timeStyle.bold, timeStyle.fontId, timeStyle.fontSize
          ));
        }
        if (meta.placeName) {   // ← 별도의 if로 분리
          filters.push(makeDrawtext(
            meta.placeName, x, adjustY(y, 25),
            placeStyle.color, placeStyle.bold, placeStyle.fontId, placeStyle.fontSize
          ));
        }
      }

      await new Promise((resolve, reject) => {
        const cmd = ffmpeg(file.path);

        // 텍스트 필터
        if (filters.length > 0) {
          cmd.videoFilters(filters);
        }

        // 음소거 처리
        if (meta.isMuted) {
          cmd.audioFilters('volume=0');
        }

        cmd
          .outputOptions([
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-preset', 'fast',
            '-pix_fmt', 'yuv420p',
            // 스마트폰 카메라 원본은 가변 프레임레이트(VFR)인 경우가 많은데,
            // 이후 병합 단계가 -c copy(스트림 복사)라서 모든 클립의 타임베이스가
            // 동일해야 합니다. 여기서 고정 프레임레이트로 맞추고 타임스탬프를
            // 0부터 재정렬하지 않으면, concat 시 뒤 클립 타임스탬프가 앞 클립
            // 기준으로 잘못 해석돼 클립이 끝까지 재생되지 못하고 중간에
            // 끊기는 문제가 생깁니다.
            '-r', '30',
            '-vsync', 'cfr',
            '-avoid_negative_ts', 'make_zero',
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

    // 파일명에 타임스탬프만 쓰면 순서대로 추측해서 남의 영상을 내려받을 수
    // 있어서, 추측 불가능한 랜덤 이름을 씁니다(다운로드 URL은 이 파일명을
    // 그대로 포함해서 클라이언트에 내려주므로 클라이언트 쪽 변경은 필요 없음).
    const outputPath = path.join(OUTPUT_DIR, `${crypto.randomUUID()}.mp4`);
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
    // http://로 내려주면 릴리즈 빌드(안드로이드 API 28+ 기본 정책)에서 cleartext
    // 트래픽이 차단돼 다운로드가 조용히 실패합니다(HomeScreen.tsx의 같은 이슈 참고).
    // Railway 등 배포 환경은 TLS를 프록시 앞단에서 종료하기 때문에 req.headers.host로
    // 들어오는 요청은 원래 https였어도 서버 입장에선 http로 보여서, 프로토콜을
    // req.headers.host로부터 유추하지 않고 항상 https로 고정합니다.
    res.json({
      success: true,
      downloadUrl: `https://${req.headers.host}${downloadUrl}`,
    });

    // 병합된 결과물도 영상 데이터를 "일시적으로만 처리하고 보관하지 않는다"는
    // 원칙을 지키기 위해 일정 시간 뒤 자동 삭제합니다 — 소스 클립만 지우고
    // 최종 결과물은 무기한 남겨두던 문제를 해결.
    setTimeout(() => {
      try {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch (_) {}
    }, OUTPUT_RETENTION_MS);

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
  // path.basename으로 디렉터리 이동 문자(../ 등)를 제거해서 OUTPUT_DIR 밖의
  // 파일에 접근하지 못하게 합니다.
  const filePath = path.join(OUTPUT_DIR, path.basename(req.params.filename));

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('파일을 찾을 수 없습니다.');
  }

  res.sendFile(filePath);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`서버 실행 중: ${PORT}`));
