// src/app/components/UploadForm.js (REDESIGN)
"use client";

import { useState, useRef } from 'react';
import Image from 'next/image';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';
import { db, storage } from '@/lib/firebaseClient';

const UploadForm = () => {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    if (!selectedFile.type.startsWith('image/')) {
      setError('File harus berupa gambar (PNG, JPG, GIF)');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('Ukuran file terlalu besar. Maksimal 10MB.');
      return;
    }

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setError('');
    setSuccess('');
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreviewUrl('');
    setTitle('');
    setAuthor('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
      const fileExtension = file.name.split('.').pop();
      const uniqueFileName = `${uuidv4()}.${fileExtension}`;
      const storageRef = ref(storage, `karya/${uniqueFileName}`);

      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      await addDoc(collection(db, "karya"), {
        title: title,
        author: author,
        imageUrl: downloadURL,
        voters: [],
        voteCount: 0,
        createdAt: serverTimestamp()
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
    <form onSubmit={handleSubmit} className="w-full bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl space-y-8 border border-gray-100 dark:border-gray-700">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Upload Karya Baru
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Bagikan kreativitas Anda dengan komunitas
        </p>
      </div>

      {/* Drag & Drop Area - REDESIGN */}
      <div
        className={`border-3 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
          isDragging
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          className="hidden" 
          onChange={handleFileChange} 
          accept="image/*" 
          id="fileUpload" 
        />
        <label htmlFor="fileUpload" className="cursor-pointer block">
          {previewUrl ? (
            <div className="relative w-full h-64 rounded-lg overflow-hidden mb-4">
              <Image 
                src={previewUrl} 
                alt="Preview" 
                fill 
                style={{ objectFit: 'cover' }}
                className="rounded-lg"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
                <div className="bg-white/90 dark:bg-gray-900/90 rounded-full p-3 backdrop-blur-sm transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                  <svg className="w-6 h-6 text-gray-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                <span className="font-semibold text-purple-600 dark:text-purple-400">Klik untuk memilih</span> atau seret gambar ke sini
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                PNG, JPG, hingga 10MB
              </p>
            </div>
          )}
        </label>
      </div>

      {/* Input Fields - REDESIGN */}
      <div className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Judul Karya
            <span className="text-red-500 ml-1">*</span>
          </label>
          <input 
            type="text" 
            id="title" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm p-4 transition-all duration-300"
            placeholder="Contoh: Senja di Pesisir Pantai" 
          />
        </div>
        
        <div>
          <label htmlFor="author" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Nama Anda
            <span className="text-red-500 ml-1">*</span>
          </label>
          <input 
            type="text" 
            id="author" 
            value={author} 
            onChange={(e) => setAuthor(e.target.value)} 
            className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm p-4 transition-all duration-300"
            placeholder="Contoh: Budi Karyawan"
          />
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-green-700 dark:text-green-400">{success}</p>
          </div>
        </div>
      )}

      {/* Submit Button - REDESIGN */}
      <button 
        type="submit" 
        disabled={isUploading}
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-4 px-6 rounded-xl hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-xl"
      >
        {isUploading ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Mengunggah...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center space-x-2">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>Upload Karya</span>
          </div>
        )}
      </button>

      {/* Tips */}
      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Pastikan gambar berkualitas tinggi dan sesuai dengan tema seni digital</p>
      </div>
    </form>
  );
};

export default UploadForm;