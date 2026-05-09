const express = require('express');
const QRCode = require('qrcode');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');

const app = express();
const PORT = 3000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/generate', upload.single('logo'), async (req, res) => {
  const { text, color, bgColor, size, errorLevel, format } = req.body;
  const qrWidth = parseInt(size) || 300;
  const isSvg = format === 'svg';

  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'Text is required' });
  }

  if (isSvg && req.file) {
    return res.status(400).json({ error: 'Logo integration is only supported for PNG export.' });
  }

  try {
    const options = {
      width: qrWidth,
      margin: 2,
      errorCorrectionLevel: req.file ? 'H' : (errorLevel || 'M'),
      color: {
        dark: color || '#000000',
        light: bgColor || '#ffffff',
      },
    };

    if (isSvg) {
      options.type = 'svg';
      const svgString = await QRCode.toString(text.trim(), options);
      return res.json({ qr: `data:image/svg+xml;base64,${Buffer.from(svgString).toString('base64')}`, format: 'svg' });
    }

    const qrBuffer = await QRCode.toBuffer(text.trim(), options);

    if (req.file) {
      const logoWidth = Math.floor(qrWidth * 0.25);
      
      const resizedLogo = await sharp(req.file.buffer)
        .resize(logoWidth, logoWidth, { fit: 'inside' })
        .toBuffer();

      const finalQrBuffer = await sharp(qrBuffer)
        .composite([{ input: resizedLogo, gravity: 'center' }])
        .png()
        .toBuffer();

      const dataUrl = `data:image/png;base64,${finalQrBuffer.toString('base64')}`;
      return res.json({ qr: dataUrl, format: 'png' });
    }

    const dataUrl = `data:image/png;base64,${qrBuffer.toString('base64')}`;
    return res.json({ qr: dataUrl, format: 'png' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});