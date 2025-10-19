// src/app/components/UploadForm.js
"use client";

import { useState } from 'react';
import Image from 'next/image';
// 1. Impor db dan storage dari file konfigurasi Firebase Anda
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid'; // Untuk membuat nama file unik
import { db, storage } from '@/lib/firebaseClient';

const UploadForm = () => {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');


  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) { // Batas 10MB
        setError('Ukuran file terlalu besar. Maksimal 10MB.');
        return;
      }
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setError('');
      setSuccess('');
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreviewUrl('');
    setTitle('');
    setAuthor('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !title || !author) {
      setError('Harap lengkapi semua field dan pilih sebuah gambar.');
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccess('');

    try {
      // 2. Buat nama file yang unik untuk menghindari penimpaan file
      const fileExtension = file.name.split('.').pop();
      const uniqueFileName = `${uuidv4()}.${fileExtension}`;
      const storageRef = ref(storage, `karya/${uniqueFileName}`);

      // 3. Upload file ke Firebase Storage
      const snapshot = await uploadBytes(storageRef, file);
      
      // 4. Dapatkan URL download dari file yang baru diupload
      const downloadURL = await getDownloadURL(snapshot.ref);

      // 5. Simpan informasi karya ke Firestore
      await addDoc(collection(db, "karya"), {
        title: title,
        author: author,
        imageUrl: downloadURL,
        type: 2,
        voters: [],
        voteCount: 0,
        createdAt: serverTimestamp() // Tambahkan timestamp
      });

      setSuccess(`Karya "${title}" berhasil diupload!`);
      resetForm();

    } catch (err) {
      console.error("Error uploading file:", err);
      setError('Gagal mengupload karya. Silakan coba lagi.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg space-y-6">
      
      {/* (Area Drag and Drop tidak berubah, biarkan seperti sebelumnya) */}
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500 transition-colors">
        <input type="file" className="hidden" onChange={handleFileChange} accept="image/*" id="fileUpload" />
        <label htmlFor="fileUpload" className="cursor-pointer">
          {previewUrl ? (
            <div className="relative w-full h-48 rounded-md overflow-hidden">
                <Image src={previewUrl} alt="Preview" fill style={{ objectFit: 'contain' }} />
            </div>
          ) : (
            <div>
              <p className="text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-indigo-500">Klik untuk memilih</span> atau seret gambar ke sini
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PNG, JPG, GIF hingga 10MB</p>
            </div>
          )}
        </label>
      </div>

      {/* (Input untuk Judul & Nama tidak berubah) */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Judul Karya</label>
        <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-3" placeholder="Contoh: Senja di Pesisir Pantai" />
      </div>
      <div>
        <label htmlFor="author" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Anda</label>
        <input type="text" id="author" value={author} onChange={(e) => setAuthor(e.target.value)} className="mt-1 block w-full bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-3" placeholder="Contoh: Budi Karyawan"/>
      </div>

      {/* Pesan Error & Sukses */}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {success && <p className="text-sm text-green-500">{success}</p>}

      <button type="submit" disabled={isUploading} className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-all duration-300">
        {isUploading ? 'Mengunggah...' : 'Upload Karya'}
      </button>
    </form>
  );
};

export default UploadForm;