import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { useTrackActivity } from "@/hooks/useActivityTracker";
import { clearSavedPropertyFilters } from "@/lib/propertySearch";
import type { AutoCompleteSuggestion } from "./types";

/**
 * The location search box's own state machine: debounced suggestion fetch,
 * open/close of the dropdown (including the click-outside dismissal), and the
 * committed selection that switches the results grid into live-MLS mode.
 *
 * Extracted from Properties.tsx verbatim. The committed `selectedLocation` /
 * `selectedLocationLabel` are returned rather than kept private because the
 * page persists them (savePropertyFilters) and keys its live-search query off
 * them.
 */
export function useLocationAutocomplete(initial: {
  locationId: string | null;
  locationLabel: string;
}) {
  const trackActivity = useTrackActivity();

  const [searchQuery, setSearchQuery] = useState(initial.locationLabel);
  const [inputValue, setInputValue] = useState(initial.locationLabel);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(initial.locationId);
  const [selectedLocationLabel, setSelectedLocationLabel] = useState(initial.locationLabel);

  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedInput = useDebounce(inputValue, 300);

  const autoCompleteUrl = debouncedInput.length >= 2
    ? `/api/properties/auto-complete?input=${encodeURIComponent(debouncedInput)}`
    : null;

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery<AutoCompleteSuggestion[]>({
    queryKey: [autoCompleteUrl],
    enabled: !!autoCompleteUrl,
  });

  useEffect(() => {
    if (suggestions && suggestions.length > 0 && debouncedInput.length >= 2) {
      setShowSuggestions(true);
    }
  }, [suggestions, debouncedInput]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSuggestion = useCallback((suggestion: AutoCompleteSuggestion) => {
    setInputValue(suggestion.label);
    setSearchQuery(suggestion.label);
    setSelectedLocation(suggestion.id);
    setSelectedLocationLabel(suggestion.label);
    setShowSuggestions(false);
    trackActivity("property_search", "/properties", { location: suggestion.label, type: suggestion.type });
  }, [trackActivity]);

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    if (!value) {
      setSearchQuery("");
      setSelectedLocation(null);
      setSelectedLocationLabel("");
      setShowSuggestions(false);
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setSearchQuery(inputValue);
      setShowSuggestions(false);
    }
    if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }, [inputValue]);

  const handleFocus = useCallback(() => {
    if (suggestions && suggestions.length > 0 && inputValue.length >= 2) {
      setShowSuggestions(true);
    }
  }, [suggestions, inputValue]);

  const clearSearch = useCallback(() => {
    setInputValue("");
    setSearchQuery("");
    setSelectedLocation(null);
    setSelectedLocationLabel("");
    clearSavedPropertyFilters();
  }, []);

  return {
    inputValue,
    searchQuery,
    selectedLocation,
    selectedLocationLabel,
    showSuggestions,
    suggestions,
    suggestionsLoading,
    inputRef,
    suggestionsRef,
    handleInputChange,
    handleKeyDown,
    handleFocus,
    handleSelectSuggestion,
    clearSearch,
  };
}
