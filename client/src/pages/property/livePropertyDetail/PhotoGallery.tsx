import { useState } from "react";
import { ChevronLeft, ChevronRight, Heart, Home, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PhotoGallery({ photos, address }: { photos: string[]; address: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);

  if (photos.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl bg-muted lg:h-96">
        <Home className="h-24 w-24 text-muted-foreground/30" />
      </div>
    );
  }

  if (showAll) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{photos.length} Photos</h2>
          <Button variant="outline" size="sm" onClick={() => setShowAll(false)} data-testid="button-close-gallery">
            Close Gallery
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo, i) => (
            <div key={i} className="aspect-[4/3] overflow-hidden rounded-lg">
              <img src={photo} alt={`${address} photo ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const handlePrev = () => setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  const handleNext = () => setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));

  return (
    <div className="relative">
      <div className="grid gap-2 lg:grid-cols-4 lg:grid-rows-2" style={{ height: "420px" }}>
        <div className="relative col-span-2 row-span-2 overflow-hidden rounded-l-xl lg:col-span-2">
          <img
            src={photos[currentIndex]}
            alt={`${address} main`}
            className="h-full w-full object-cover"
            data-testid="img-main-photo"
          />
          <div className="absolute bottom-4 left-4 flex gap-2">
            <Button variant="secondary" size="icon" aria-label="Previous photo" onClick={handlePrev} data-testid="button-photo-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" aria-label="Next photo" onClick={handleNext} data-testid="button-photo-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="absolute bottom-4 right-4 flex gap-2">
            <Button variant="secondary" size="icon" aria-label="Save">
              <Heart className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" aria-label="Share">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {photos.slice(1, 5).map((photo, i) => (
          <div key={i} className={`hidden overflow-hidden lg:block ${i === 1 ? "rounded-tr-xl" : ""} ${i === 3 ? "rounded-br-xl" : ""}`}>
            <img src={photo} alt={`${address} photo ${i + 2}`} className="h-full w-full object-cover" loading="lazy" />
          </div>
        ))}
      </div>

      {photos.length > 5 && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute bottom-4 right-4 gap-1 lg:right-4"
          onClick={() => setShowAll(true)}
          data-testid="button-show-all-photos"
        >
          Show all {photos.length} photos
        </Button>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white lg:hidden">
        {currentIndex + 1} / {photos.length}
      </div>
    </div>
  );
}
