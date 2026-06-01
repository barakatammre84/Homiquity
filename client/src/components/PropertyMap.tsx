import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin } from "lucide-react";

interface PropertyMapProps {
  lat: number;
  lng: number;
  address: string;
  zoom?: number;
}

export function PropertyMap({ lat, lng, address, zoom = 15 }: PropertyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const { data: config } = useQuery<{ key: string }>({
    queryKey: ["/api/config/maps-key"],
  });

  useEffect(() => {
    if (!config?.key) return;
    if ((window as any).google?.maps) {
      setScriptLoaded(true);
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => setScriptLoaded(true));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${config.key}&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => console.error("Failed to load Google Maps script");
    document.head.appendChild(script);
  }, [config?.key]);

  useEffect(() => {
    if (!scriptLoaded || !mapRef.current || !(window as any).google?.maps) return;

    const google = (window as any).google;
    const position = { lat, lng };

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: position,
        zoom,
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      markerRef.current = new google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        title: address,
      });
    } else {
      mapInstanceRef.current.setCenter(position);
      mapInstanceRef.current.setZoom(zoom);
      markerRef.current?.setPosition(position);
      markerRef.current?.setTitle(address);
    }
  }, [scriptLoaded, lat, lng, zoom, address]);

  if (!config?.key) {
    return (
      <div className="flex h-[220px] w-full items-center justify-center rounded-md bg-muted" data-testid="map-placeholder">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <MapPin className="h-8 w-8" />
          <span className="text-sm">Map unavailable</span>
        </div>
      </div>
    );
  }

  if (!scriptLoaded) {
    return (
      <div className="flex h-[220px] w-full items-center justify-center rounded-md bg-muted" data-testid="map-loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="h-[220px] w-full rounded-md"
      data-testid="map-container"
    />
  );
}
