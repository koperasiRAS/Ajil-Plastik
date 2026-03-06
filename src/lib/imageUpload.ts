import { supabase } from './supabase';

const MAX_SIZE = 1600;
const QUALITY = 0.8;

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > MAX_SIZE || height > MAX_SIZE) {
        if (width > height) {
          height = (height / width) * MAX_SIZE;
          width = MAX_SIZE;
        } else {
          width = (width / height) * MAX_SIZE;
          height = MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas not supported'));
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Compression failed')),
        'image/webp',
        QUALITY
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

export async function uploadProductImage(file: File, productId: string): Promise<string> {
  const compressed = await compressImage(file);
  const fileName = `${productId}_${Date.now()}.webp`;

  const { error } = await supabase.storage
    .from('product-images')
    .upload(fileName, compressed, {
      contentType: 'image/webp',
      upsert: true,
    });

  if (error) throw new Error(`Upload gagal: ${error.message}`);

  const { data } = supabase.storage
    .from('product-images')
    .getPublicUrl(fileName);

  return data.publicUrl;
}

export async function deleteProductImage(imageUrl: string): Promise<void> {
  const parts = imageUrl.split('/product-images/');
  if (parts.length < 2) return;
  const fileName = parts[1];

  await supabase.storage.from('product-images').remove([fileName]);
}
