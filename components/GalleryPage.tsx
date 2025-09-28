import React, { useState, useEffect } from 'react';
import { X as XIcon, ChevronLeft, ChevronRight } from 'lucide-react';

// --- How to add your photos ---
// For detailed instructions, see the README.md file in the `/assets` folder.
//
// 1. Place your image files inside the `/assets` folder.
// 2. Add the path to your new image in the 'images' array below.
//    The path must start with '/assets/'.
//
// Example: To add a photo named "cat.jpg", you would add the line:
// '/assets/cat.jpg',
// Define gallery images with new URL pattern
const images = [
  new URL('../assets/gallery1.jpg', import.meta.url).href,
  new URL('../assets/gallery2.jpg', import.meta.url).href,
  new URL('../assets/gallery3.jpg', import.meta.url).href,
  new URL('../assets/gallery4.jpg', import.meta.url).href,
  new URL('../assets/gallery5.jpg', import.meta.url).href,
  new URL('../assets/gallery6.jpg', import.meta.url).href,
  new URL('../assets/gallery7.jpg', import.meta.url).href,
  new URL('../assets/gallery8.jpg', import.meta.url).href,
  new URL('../assets/gallery9.jpg', import.meta.url).href,
];

const GalleryPage: React.FC = () => {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{[key: string]: { width: number; height: number }}>({});

  useEffect(() => {
    // Preload images to get their dimensions
    images.forEach((src) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setImageDimensions(prev => ({
          ...prev,
          [src]: {
            width: img.naturalWidth,
            height: img.naturalHeight
          }
        }));
      };
    });
  }, []);

  const getAspectRatioStyle = (src: string) => {
    const dimensions = imageDimensions[src];
    if (!dimensions) return {}; // Default size while loading

    const ratio = dimensions.width / dimensions.height;
    return {
      aspectRatio: `${dimensions.width} / ${dimensions.height}`,
      gridColumn: ratio > 1.3 ? 'span 2' : 'span 1',
      height: 'auto',
      width: '100%'
    };
  };

  const openModal = (index: number) => {
    setSelectedImageIndex(index);
  };

  const closeModal = () => {
    setSelectedImageIndex(null);
  };
  
  const showNextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (selectedImageIndex !== null) {
      setSelectedImageIndex((selectedImageIndex + 1) % images.length);
    }
  };

  const showPrevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (selectedImageIndex !== null) {
      setSelectedImageIndex((selectedImageIndex - 1 + images.length) % images.length);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImageIndex !== null) {
        if (e.key === 'ArrowRight') {
          showNextImage();
        } else if (e.key === 'ArrowLeft') {
          showPrevImage();
        } else if (e.key === 'Escape') {
          closeModal();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedImageIndex]);


  return (
    <div className="flex-1 flex flex-col h-full bg-background text-foreground overflow-y-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-4xl font-bold text-center text-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>
        Photo Gallery
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 auto-rows-auto gap-6 p-6 animate-fade-in-up">
        {images.map((src, index) => (
          <div
            key={src}
            className="group relative cursor-pointer overflow-hidden rounded-lg shadow-lg"
            style={getAspectRatioStyle(src)}
            onClick={() => openModal(index)}
            role="button"
            tabIndex={0}
            aria-label={`View image ${index + 1}`}
          >
            <div className="absolute inset-0 bg-gray-200 animate-pulse">
              <div className="w-full h-full animate-shimmer bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:400%_100%]"></div>
            </div>
            <img
              src={src}
              alt={`Gallery image ${index + 1}`}
              className="absolute inset-0 w-full h-full object-cover transform transition-all duration-300 group-hover:scale-110 relative z-10"
              loading="lazy"
              onLoad={(e) => {
                const target = e.target as HTMLElement;
                target.style.opacity = '1';
                const img = e.target as HTMLImageElement;
                setImageDimensions(prev => ({
                  ...prev,
                  [src]: {
                    width: img.naturalWidth,
                    height: img.naturalHeight
                  }
                }));
              }}
              style={{ opacity: 0, transition: 'opacity 0.3s ease-in-out' }}
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <span className="text-white text-lg font-semibold">View</span>
            </div>
          </div>
        ))}
      </div>

      {selectedImageIndex !== null && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in-up" 
          style={{ animationDuration: '0.3s' }}
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="gallery-modal-title"
        >
          <div className="relative w-full h-full max-w-[90vw] max-h-[90vh] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <h2 id="gallery-modal-title" className="sr-only">Image Viewer</h2>
            {selectedImageIndex !== null && (
              <div 
                className="relative w-full h-full flex items-center justify-center"
                style={{
                  aspectRatio: imageDimensions[images[selectedImageIndex]]
                    ? `${imageDimensions[images[selectedImageIndex]].width} / ${imageDimensions[images[selectedImageIndex]].height}`
                    : 'auto'
                }}
              >
                <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-lg"></div>
                <img
                  src={images[selectedImageIndex]}
                  alt={`Enlarged gallery image ${selectedImageIndex + 1}`}
                  className="w-full h-full object-contain rounded-lg shadow-2xl relative z-10"
              onLoad={(e) => {
                const target = e.target as HTMLElement;
                target.style.opacity = '1';
              }}
              style={{ opacity: 0, transition: 'opacity 0.3s ease-in-out' }}
            />
            
            <button onClick={closeModal} className="absolute top-2 right-2 sm:top-4 sm:right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/80 transition-colors" aria-label="Close image viewer">
              <XIcon size={24} />
            </button>

            <button onClick={showPrevImage} className="absolute left-2 top-1/2 -translate-y-1/2 sm:left-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/80 transition-colors" aria-label="Previous image">
              <ChevronLeft size={32} />
            </button>
            <button onClick={showNextImage} className="absolute right-2 top-1/2 -translate-y-1/2 sm:right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/80 transition-colors" aria-label="Next image">
              <ChevronRight size={32} />
            </button>
          </div>
        </div>
      )}
       <style>{`
        @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
            animation: fade-in-up 0.5s ease-out forwards;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: .5; }
        }
        .animate-pulse {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes shimmer {
            0% { background-position: 100% 0; }
            100% { background-position: -100% 0; }
        }
        .animate-shimmer {
            animation: shimmer 2s infinite linear;
        }
        .grid {
            grid-auto-flow: dense;
        }
        .image-container {
            position: relative;
            width: 100%;
        }
        .image-container::before {
            content: "";
            display: block;
            height: 0;
            width: 100%;
        }
        .image-container > * {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }
      `}</style>
    </div>
  );
};

export default GalleryPage;