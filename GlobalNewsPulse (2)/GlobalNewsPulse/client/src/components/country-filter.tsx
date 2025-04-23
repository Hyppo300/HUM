import { useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Countries organized by geographical regions
const REGIONS = {
  Global: [
    { code: "GLOBAL", name: "Global News" },
    { code: "GLOBAL-TRENDING", name: "Trending News" },
  ],
  "North America": [
    { code: "US", name: "United States" },
    { code: "CA", name: "Canada" },
    { code: "MX", name: "Mexico" },
    { code: "CU", name: "Cuba" },
  ],
  "South America": [
    { code: "AR", name: "Argentina" },
    { code: "BR", name: "Brazil" },
    { code: "CO", name: "Colombia" },
    { code: "VE", name: "Venezuela" },
  ],
  Europe: [
    { code: "GB", name: "United Kingdom" },
    { code: "FR", name: "France" },
    { code: "DE", name: "Germany" },
    { code: "IT", name: "Italy" },
    { code: "ES", name: "Spain" },
    { code: "AT", name: "Austria" },
    { code: "BE", name: "Belgium" },
    { code: "BG", name: "Bulgaria" },
    { code: "CH", name: "Switzerland" },
    { code: "CZ", name: "Czech Republic" },
    { code: "GR", name: "Greece" },
    { code: "HU", name: "Hungary" },
    { code: "IE", name: "Ireland" },
    { code: "LT", name: "Lithuania" },
    { code: "LV", name: "Latvia" },
    { code: "NL", name: "Netherlands" },
    { code: "NO", name: "Norway" },
    { code: "PL", name: "Poland" },
    { code: "PT", name: "Portugal" },
    { code: "RO", name: "Romania" },
    { code: "RS", name: "Serbia" },
    { code: "SE", name: "Sweden" },
    { code: "SI", name: "Slovenia" },
    { code: "SK", name: "Slovakia" },
    { code: "UA", name: "Ukraine" },
  ],
  Asia: [
    { code: "CN", name: "China" },
    { code: "JP", name: "Japan" },
    { code: "IN", name: "India" },
    { code: "KR", name: "South Korea" },
    { code: "ID", name: "Indonesia" },
    { code: "MY", name: "Malaysia" },
    { code: "PH", name: "Philippines" },
    { code: "SG", name: "Singapore" },
    { code: "TH", name: "Thailand" },
    { code: "TW", name: "Taiwan" },
    { code: "HK", name: "Hong Kong" },
    { code: "IL", name: "Israel" },
    { code: "RU", name: "Russia" },
  ],
  "Middle East & Africa": [
    { code: "AE", name: "United Arab Emirates" },
    { code: "SA", name: "Saudi Arabia" },
    { code: "EG", name: "Egypt" },
    { code: "MA", name: "Morocco" },
    { code: "NG", name: "Nigeria" },
    { code: "TR", name: "Turkey" },
    { code: "ZA", name: "South Africa" },
  ],
  Oceania: [
    { code: "AU", name: "Australia" },
    { code: "NZ", name: "New Zealand" },
  ],
};

// Function to convert country code to flag emoji
function getFlagEmoji(countryCode: string) {
  // Special cases for GLOBAL and trending news
  if (countryCode === "GLOBAL") {
    return "🌎"; // Globe emoji for global news
  }

  if (countryCode === "GLOBAL-TRENDING") {
    return "🔥"; // Fire emoji for trending news
  }

  // Handle country-specific trending flags
  if (countryCode && countryCode.endsWith("-TRENDING")) {
    const baseCountry = countryCode.replace("-TRENDING", "");
    const codePoints = baseCountry
      .toUpperCase()
      .split("")
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints) + "🔥"; // Country flag + fire emoji
  }

  // For standard country codes, convert to flag emoji
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

interface CountryFilterProps {
  value?: string;
  onChange: (value: string | undefined) => void;
}

export function CountryFilter({ value, onChange }: CountryFilterProps) {
  const [open, setOpen] = useState(false);

  // Find the selected country name
  const selectedCountry = Object.values(REGIONS)
    .flat()
    .find((country) => country.code === value);

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-[120px] sm:w-auto">
      {/* Country Select */}
      <div className="w-full sm:w-[100px]">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              {value ? (
                <span className="flex items-center gap-2 ">
                  <span>{getFlagEmoji(value)}</span>
                  <span>{selectedCountry?.name}</span>
                </span>
              ) : (
                "Select country..."
              )}

              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0 sm:w-[50px]">
            <Command>
              <CommandInput placeholder="Search country..." />
              <CommandList className="max-h-[300px] overflow-auto">
                <CommandEmpty>No country found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="all"
                    onSelect={() => {
                      onChange(undefined);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        !value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    All Countries
                  </CommandItem>
                </CommandGroup>
                {Object.entries(REGIONS).map(([region, countries]) => (
                  <CommandGroup key={region} heading={region}>
                    <div className="grid grid-cols-1">
                      {countries.map((country) => (
                        <CommandItem
                          key={country.code}
                          value={country.name}
                          onSelect={() => {
                            onChange(country.code);
                            setOpen(false);
                          }}
                          className="flex items-center"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value === country.code
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          <span className="flex items-center gap-2">
                            <span className="w-6 inline-block text-center">
                              {getFlagEmoji(country.code)}
                            </span>
                            <span>{country.name}</span>
                          </span>
                        </CommandItem>
                      ))}
                    </div>
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
