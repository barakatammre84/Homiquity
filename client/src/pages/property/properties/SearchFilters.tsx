import { Grid, List, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { PROPERTY_TYPES, type AutoCompleteSuggestion, type SearchMode, type ViewMode } from "./types";
import type { useLocationAutocomplete } from "./useLocationAutocomplete";

export interface SearchFiltersProps {
  autocomplete: ReturnType<typeof useLocationAutocomplete>;
  searchMode: SearchMode;
  onSearchModeChange: (mode: SearchMode) => void;
  propertyType: string;
  onPropertyTypeChange: (value: string) => void;
  priceRange: number[];
  onPriceRangeChange: (value: number[]) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function SearchFilters({
  autocomplete,
  searchMode,
  onSearchModeChange,
  propertyType,
  onPropertyTypeChange,
  priceRange,
  onPriceRangeChange,
  viewMode,
  onViewModeChange,
}: SearchFiltersProps) {
  const {
    inputValue,
    showSuggestions,
    suggestions,
    suggestionsLoading,
    inputRef,
    suggestionsRef,
    handleInputChange,
    handleKeyDown,
    handleFocus,
    handleSelectSuggestion,
  } = autocomplete;

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="relative flex-1">
            <label className="mb-2 block text-sm font-medium">Search Location</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                placeholder="City, address, or ZIP code"
                className="pl-10"
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                data-testid="input-property-search"
              />
            </div>
            {showSuggestions && inputValue.length >= 2 && (
              <div
                ref={suggestionsRef}
                className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover shadow-md"
                data-testid="autocomplete-dropdown"
              >
                {suggestionsLoading ? (
                  <div className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
                    <Search className="h-4 w-4 animate-pulse" />
                    <span>Searching locations...</span>
                  </div>
                ) : suggestions && suggestions.length > 0 ? (
                  suggestions.map((suggestion: AutoCompleteSuggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover-elevate"
                      onClick={() => handleSelectSuggestion(suggestion)}
                      data-testid={`autocomplete-item-${suggestion.id}`}
                    >
                      <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{suggestion.label}</p>
                        <p className="text-xs capitalize text-muted-foreground">{suggestion.type.replace("_", " ")}</p>
                      </div>
                      {suggestion.stateCode && (
                        <Badge variant="secondary" className="shrink-0">{suggestion.stateCode}</Badge>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-muted-foreground">
                    No locations found
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="w-full lg:w-auto">
            <label className="mb-2 block text-sm font-medium">Search Mode</label>
            <div className="flex gap-1 rounded-md border p-1">
              <Button
                variant={searchMode === "buy" ? "default" : "ghost"}
                size="sm"
                onClick={() => onSearchModeChange("buy")}
                className="touch-target toggle-elevate"
                data-testid="button-mode-buy"
              >
                For Sale
              </Button>
              <Button
                variant={searchMode === "sold" ? "default" : "ghost"}
                size="sm"
                onClick={() => onSearchModeChange("sold")}
                className="touch-target toggle-elevate"
                data-testid="button-mode-sold"
              >
                Recently Sold
              </Button>
            </div>
          </div>

          <div className="w-full lg:w-48">
            <label className="mb-2 block text-sm font-medium">Property Type</label>
            <Select value={propertyType} onValueChange={onPropertyTypeChange}>
              <SelectTrigger data-testid="select-property-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full lg:w-64">
            <label className="mb-2 block text-sm font-medium">
              Price Range: {formatCurrency(priceRange[0])} - {formatCurrency(priceRange[1])}
            </label>
            <Slider
              value={priceRange}
              onValueChange={onPriceRangeChange}
              min={0}
              max={2000000}
              step={50000}
              className="py-2"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="icon" aria-label="Grid view"
              onClick={() => onViewModeChange("grid")}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="icon" aria-label="List view"
              onClick={() => onViewModeChange("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
