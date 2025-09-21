import { useState, useEffect } from 'react';

type PdfJsLib = any; 
type LoadingStatus = 'idle' | 'loading' | 'ready' | 'error';

interface UsePdfJsReturn {
  pdfjsLib: PdfJsLib | null;
  status: LoadingStatus;
}

const PDF_JS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.min.js';
const PDF_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

let pdfJsPromise: Promise<PdfJsLib> | null = null;

export const usePdfJs = (): UsePdfJsReturn => {
  const [library, setLibrary] = useState<{ lib: PdfJsLib | null, status: LoadingStatus }>({ lib: null, status: 'idle' });

  useEffect(() => {
    // This effect runs only once on mount
    const loadPdfJs = () => {
      // If script is already available on window, use it
      if ((window as any).pdfjsLib) {
        const lib = (window as any).pdfjsLib;
        lib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
        setLibrary({ lib, status: 'ready' });
        return;
      }

      // If another component is already loading it, wait for the same promise
      if (pdfJsPromise) {
        setLibrary({ lib: null, status: 'loading' });
        pdfJsPromise.then(lib => {
          setLibrary({ lib, status: 'ready' });
        }).catch(() => {
          setLibrary({ lib: null, status: 'error' });
        });
        return;
      }

      // Start loading
      setLibrary({ lib: null, status: 'loading' });

      pdfJsPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = PDF_JS_URL;
        script.async = true;

        script.onload = () => {
          const lib = (window as any).pdfjsLib;
          if (lib) {
            lib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
            resolve(lib);
          } else {
            console.error("pdf.js script loaded but pdfjsLib is not available on window.");
            reject(new Error("pdfjsLib not found on window"));
          }
          // Clean up the script tag from the body
          document.body.removeChild(script);
        };

        script.onerror = (error) => {
          console.error("Failed to load pdf.js script:", error);
          reject(error);
          document.body.removeChild(script);
        };

        document.body.appendChild(script);
      });

      pdfJsPromise.then(lib => {
        setLibrary({ lib, status: 'ready' });
      }).catch(() => {
        setLibrary({ lib: null, status: 'error' });
      });
    };
    
    loadPdfJs();

  }, []); // Empty dependency array ensures this runs only once per component instance

  return { pdfjsLib: library.lib, status: library.status };
};
