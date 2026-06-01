import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Home } from "lucide-react";

interface StreetViewProps {
  lat: number;
  lng: number;
  width?: number;
  height?: number;
}

export function StreetView({ lat, lng, width = 600, height = 300 }: StreetViewProps) {
  const [hasError, setHasError] = useState(false);

  const { data: config } = useQuery<{ key: string }>({
    queryKey: ["/api/config/maps-key"],
  });

  if (!config?.key || hasError) {
    return (
      <div
        className="flex items-center justify-center rounded-md bg-muted"
        style={{ width: "100%", height: `${height}px` }}
        data-testid="streetview-placeholder"
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Home className="h-8 w-8" />
          <span className="text-sm">Street view unavailable</span>
        </div>
      </div>
    );
  }

  const src = `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${lat},${lng}&key=${config.key}&return_error_codes=true`;

  return (
    <img
      src={src}
      alt={`Street view at ${lat}, ${lng}`}
      className="w-full rounded-md object-cover"
      style={{ height: `${height}px` }}
      loading="lazy"
      onError={() => setHasError(true)}
      data-testid="streetview-image"
    />
  );
}
