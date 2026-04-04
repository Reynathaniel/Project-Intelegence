export const compressImage = (file: File, maxWidth: number = 600, maxHeight: number = 600, quality: number = 0.5): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Basic validation
    if (!file.type.startsWith('image/')) {
      reject(new Error('File is not an image'));
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Iteratively reduce quality if needed, though 0.5 is usually enough
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          
          // Check if the resulting base64 is still too large for Firestore (1MB limit)
          // Base64 is ~1.33x the size of binary. 800KB binary is ~1.06MB base64.
          // We want to stay well under 1MB for the whole document.
          if (dataUrl.length > 800000) {
            // Try again with even lower quality and size
            resolve(compressImage(file, maxWidth / 2, maxHeight / 2, quality * 0.8));
          } else {
            resolve(dataUrl);
          }
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (err) => reject(new Error('Failed to load image for compression'));
    };
    reader.onerror = (err) => reject(new Error('Failed to read file'));
  });
};
