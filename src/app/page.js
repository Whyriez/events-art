// app/page.js (Halaman Utama - Dengan Pagination)
"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebaseClient";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  arrayUnion,
  increment,
  limit,
  where,
  startAfter,
  getCountFromServer,
} from "firebase/firestore";
import KaryaCard from "./components/KaryaCard";
import ImageModal from "./components/ImageModal";

export const runtime = "edge";

// Konstanta untuk pagination
const ITEMS_PER_PAGE = 8; // Jumlah item per halaman

export default function Home() {
  const [karyaList, setKaryaList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedKarya, setSelectedKarya] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("votes");

  // State untuk pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const openModal = (karya) => {
    setSelectedKarya(karya);
  };

  const closeModal = () => {
    setSelectedKarya(null);
  };

  const fetchKarya = async (reset = false) => {
    try {
      if (reset) {
        setIsLoading(true);
        setCurrentPage(1);
        setLastVisible(null);
      } else {
        setIsLoadingMore(true);
      }

      const baseQuery = collection(db, "karya");
      
      // MODIFIKASI: Gunakan array untuk menampung semua constraint query
      const queryConstraints = [];

      // 1. Tambahkan constraint filter 'where' jika event dipilih
      if (sortBy === "event1") {
        queryConstraints.push(where("type", "==", 1));
      } else if (sortBy === "event2") {
        queryConstraints.push(where("type", "==", 2)); // Asumsi type 2 untuk Event 2
      }

      // 2. Tambahkan constraint 'orderBy'
      // Untuk event, kita urutkan default berdasarkan vote terbanyak
      switch (sortBy) {
        case "newest":
          queryConstraints.push(orderBy("createdAt", "desc"));
          break;
        case "oldest":
          queryConstraints.push(orderBy("createdAt", "asc"));
          break;
        case "title":
          queryConstraints.push(orderBy("title", "asc"));
          break;
        case "event1": // Jatuh ke default (votes)
        case "event2": // Jatuh ke default (votes)
        case "votes":
        default:
          queryConstraints.push(orderBy("voteCount", "desc"));
          break;
      }

      // 3. Tambahkan constraint pagination
      if (lastVisible && !reset) {
        queryConstraints.push(startAfter(lastVisible));
      }
      queryConstraints.push(limit(ITEMS_PER_PAGE));

      // Gabungkan semua constraint menjadi satu query
      const q = query(baseQuery, ...queryConstraints);

      const querySnapshot = await getDocs(q);

      // Cek apakah ada halaman berikutnya
      setHasNextPage(querySnapshot.docs.length === ITEMS_PER_PAGE);

      // Simpan dokumen terakhir untuk pagination berikutnya
      if (querySnapshot.docs.length > 0) {
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      }

      const fetchedKarya = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (reset) {
        setKaryaList(fetchedKarya);
      } else {
        setKaryaList((prev) => [...prev, ...fetchedKarya]);
      }

      // Update total items count based on filter
      if (reset) {
        let countQuery;
        if (sortBy === "event1") {
          countQuery = query(baseQuery, where("type", "==", 1));
        } else if (sortBy === "event2") {
          countQuery = query(baseQuery, where("type", "==", 2));
        } else {
          countQuery = baseQuery;
        }
        const snapshot = await getCountFromServer(countQuery);
        setTotalItems(snapshot.data().count);
      }

      if (reset) {
        setCurrentPage(1);
      } else {
        setCurrentPage((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("User authenticated:", user.uid);
        setCurrentUser(user);
        fetchKarya(true); // Langsung fetch karya (dan total count di dalamnya)
      } else {
        console.log("No user, signing in anonymously...");
        signInAnonymously(auth)
          .then((result) => {
            console.log("Anonymous sign-in successful:", result.user.uid);
          })
          .catch((error) => {
            console.error("Full error object:", error);
          });
      }
    });
    return () => unsubscribe();
  }, []);

  // Effect untuk handle perubahan sort
  useEffect(() => {
    if (currentUser) {
      fetchKarya(true); // Reset dan fetch ulang data saat filter berubah
    }
  }, [sortBy, currentUser]);

  const handleVote = async (id) => {
    if (!currentUser) {
      alert("Sesi Anda tidak valid, silakan muat ulang halaman.");
      return;
    }

    const karyaToVote = karyaList.find((karya) => karya.id === id);
    if (karyaToVote.voters?.includes(currentUser.uid)) {
      console.log("Anda sudah pernah vote untuk karya ini.");
      return;
    }

    const updatedList = karyaList.map((karya) => {
      if (karya.id === id) {
        return {
          ...karya,
          voteCount: (karya.voteCount || 0) + 1,
          voters: [...(karya.voters || []), currentUser.uid],
        };
      }
      return karya;
    });

    // Sort berdasarkan pilihan
    const sortedList = sortKaryaList(updatedList, sortBy);
    setKaryaList(sortedList);

    try {
      const karyaRef = doc(db, "karya", id);
      await updateDoc(karyaRef, {
        voters: arrayUnion(currentUser.uid),
        voteCount: increment(1),
      });
    } catch (error) {
      console.error("Error updating vote:", error);
      const originalSorted = sortKaryaList(karyaList, sortBy);
      setKaryaList(originalSorted);
      alert("Gagal melakukan vote. Silakan coba lagi.");
    }
  };

  const sortKaryaList = (list, sortType) => {
    const sorted = [...list];
    switch (sortType) {
      case "newest":
        return sorted.sort(
          (a, b) =>
            new Date(b.createdAt?.toDate()) - new Date(a.createdAt?.toDate())
        );
      case "oldest":
        return sorted.sort(
          (a, b) =>
            new Date(a.createdAt?.toDate()) - new Date(b.createdAt?.toDate())
        );
      case "title":
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case "event1": // Jatuh ke default (votes)
      case "event2": // Jatuh ke default (votes)
      case "votes":
      default:
        return sorted.sort((a, b) => b.voteCount - a.voteCount);
    }
  };

  const handleLoadMore = () => {
    fetchKarya(false);
  };

  const handleSortChange = (e) => {
    const newSort = e.target.value;
    setSortBy(newSort);
  };

  // Filter untuk pencarian (client-side)
  const filteredKaryaList = karyaList.filter(
    (karya) =>
      karya.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      karya.author.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const showingStart = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const showingEnd = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-slate-900">
      {/* Navigation - Tetap sama */}
      <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                ArtGallery
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="/"
                className="text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 font-medium"
              >
                Gallery
              </a>
              <a
                href="/upload"
                className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-2 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all duration-300 font-medium"
              >
                Upload Karya
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        {/* Hero Section - Tetap sama */}
        <header className="text-center mb-12 py-16">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Discover{" "}
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Amazing Art
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
              Jelajahi galeri karya seni inspiratif dari kreator berbakat. Vote
              karya favoritmu dan bagikan apresiasimu kepada dunia.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href="/upload"
                className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-8 py-4 rounded-xl hover:from-purple-600 hover:to-blue-600 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                Bagikan Karyamu
              </a>
              <a
                href="#gallery"
                className="border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-8 py-4 rounded-xl hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-300 font-semibold"
              >
                Jelajahi Gallery
              </a>
            </div>
          </div>
        </header>

        {/* Gallery Section */}
        <section id="gallery" className="mb-16">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Koleksi Karya
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Menampilkan {showingStart}-{showingEnd} dari {totalItems} karya
                {searchTerm && ` • ${filteredKaryaList.length} hasil pencarian`}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Cari karya atau artis..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent w-full sm:w-64"
                />
              </div>

              <select
                value={sortBy}
                onChange={handleSortChange}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="votes">Paling Banyak Vote</option>
                <option value="newest">Terbaru</option>
                <option value="oldest">Terlama</option>
                <option value="title">Judul (A-Z)</option>
                <option value="event1">Event 1</option> {/* BARU */}
                <option value="event2">Event 2</option> {/* BARU */}
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(ITEMS_PER_PAGE)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 animate-pulse"
                >
                  <div className="bg-gray-300 dark:bg-gray-700 rounded-lg h-48 mb-4"></div>
                  <div className="bg-gray-300 dark:bg-gray-700 rounded h-4 mb-2"></div>
                  <div className="bg-gray-300 dark:bg-gray-700 rounded h-3 w-2/3"></div>
                </div>
              ))}
            </div>
          ) : filteredKaryaList.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-4 text-gray-400">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {searchTerm ? "Tidak ada karya ditemukan" : "Belum ada karya"}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {searchTerm
                  ? "Coba ubah kata kunci pencarian atau filter yang berbeda."
                  : "Jadilah yang pertama untuk mengupload karya!"}
              </p>
              <a
                href="/upload"
                className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all duration-300 font-medium"
              >
                Upload Karya Pertama
              </a>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredKaryaList.map((karya) => (
                  <KaryaCard
                    key={karya.id}
                    karya={karya}
                    onVote={handleVote}
                    hasVoted={karya.voters?.includes(currentUser?.uid)}
                    onImageClick={openModal}
                  />
                ))}
              </div>

              {/* Load More Button */}
              {hasNextPage && !searchTerm && (
                <div className="flex justify-center mt-12">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-8 py-3 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all duration-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isLoadingMore ? (
                      <>
                        <svg
                          className="animate-spin h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Memuat...
                      </>
                    ) : (
                      "Muat Lebih Banyak"
                    )}
                  </button>
                </div>
              )}

              {/* Pagination Info */}
              {!searchTerm && (
                <div className="text-center mt-6 text-gray-600 dark:text-gray-400">
                  <p>
                    Halaman {currentPage}
                    {totalPages > 0 && ` dari ${totalPages}`}
                    {hasNextPage &&
                      ` • Masih ada ${totalItems - showingEnd} karya lainnya`}
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        {selectedKarya && (
          <ImageModal karya={selectedKarya} onClose={closeModal} />
        )}
      </main>

      {/* Footer - Tetap sama */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <span className="text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                ArtGallery
              </span>
            </div>
            <div className="text-gray-600 dark:text-gray-400 text-center md:text-right">
              <p>&copy; 2025 ArtGallery. All rights reserved.</p>
              <p className="text-sm mt-1">
                Platform berbagi karya seni digital
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
