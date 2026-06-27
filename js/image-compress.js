/* BATIG — Compress payment screenshots to small JPEG (KB) */
const ImageCompress = {
  dataUrlSizeKB(dataUrl) {
    if (!dataUrl) return 0;
    const base64 = dataUrl.split(',')[1] || '';
    return Math.round((base64.length * 3) / 4 / 1024);
  },

  compressFile(file, opts = {}) {
    const maxW = opts.maxWidth || 1200;
    const maxKB = opts.maxKB || 120;
    let quality = opts.quality ?? 0.82;

    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file selected'));
      if (!file.type.startsWith('image/')) return reject(new Error('Please upload an image'));

      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.width;
        let h = img.height;
        if (w > maxW) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        let kb = this.dataUrlSizeKB(dataUrl);

        while (kb > maxKB && quality > 0.35) {
          quality -= 0.08;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          kb = this.dataUrlSizeKB(dataUrl);
        }

        resolve({ dataUrl, sizeKB: kb, width: w, height: h, quality });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read image'));
      };
      img.src = url;
    });
  }
};
