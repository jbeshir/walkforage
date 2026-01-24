/**
 * cities.ts - High-priority cities for precision-5 geology data
 *
 * Top ~200 global cities by population, filtered to cities where
 * Macrostrat has coverage (primarily Americas, Europe, and parts of Asia/Africa).
 *
 * Each city gets a ~50km x 50km grid at precision-5 (~5km cells).
 */

export interface City {
  name: string;
  country: string;
  lat: number;
  lng: number;
  population: number; // Approximate, for prioritization
}

/**
 * High-priority cities for detailed geology data.
 * Sorted by population (descending).
 */
export const CITIES: City[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // North America (70 cities)
  // ═══════════════════════════════════════════════════════════════════════════

  // United States - Major metros
  { name: 'New York', country: 'USA', lat: 40.7128, lng: -74.006, population: 8336000 },
  { name: 'Los Angeles', country: 'USA', lat: 34.0522, lng: -118.2437, population: 3979000 },
  { name: 'Chicago', country: 'USA', lat: 41.8781, lng: -87.6298, population: 2693000 },
  { name: 'Houston', country: 'USA', lat: 29.7604, lng: -95.3698, population: 2320000 },
  { name: 'Phoenix', country: 'USA', lat: 33.4484, lng: -112.074, population: 1680000 },
  { name: 'Philadelphia', country: 'USA', lat: 39.9526, lng: -75.1652, population: 1584000 },
  { name: 'San Antonio', country: 'USA', lat: 29.4241, lng: -98.4936, population: 1547000 },
  { name: 'San Diego', country: 'USA', lat: 32.7157, lng: -117.1611, population: 1423000 },
  { name: 'Dallas', country: 'USA', lat: 32.7767, lng: -96.797, population: 1341000 },
  { name: 'San Jose', country: 'USA', lat: 37.3382, lng: -121.8863, population: 1027000 },
  { name: 'Austin', country: 'USA', lat: 30.2672, lng: -97.7431, population: 978000 },
  { name: 'Jacksonville', country: 'USA', lat: 30.3322, lng: -81.6557, population: 911000 },
  { name: 'Fort Worth', country: 'USA', lat: 32.7555, lng: -97.3308, population: 909000 },
  { name: 'Columbus', country: 'USA', lat: 39.9612, lng: -82.9988, population: 898000 },
  { name: 'San Francisco', country: 'USA', lat: 37.7749, lng: -122.4194, population: 874000 },
  { name: 'Indianapolis', country: 'USA', lat: 39.7684, lng: -86.1581, population: 876000 },
  { name: 'Charlotte', country: 'USA', lat: 35.2271, lng: -80.8431, population: 885000 },
  { name: 'Seattle', country: 'USA', lat: 47.6062, lng: -122.3321, population: 737000 },
  { name: 'Denver', country: 'USA', lat: 39.7392, lng: -104.9903, population: 727000 },
  { name: 'Washington DC', country: 'USA', lat: 38.9072, lng: -77.0369, population: 705000 },
  { name: 'Boston', country: 'USA', lat: 42.3601, lng: -71.0589, population: 685000 },
  { name: 'Nashville', country: 'USA', lat: 36.1627, lng: -86.7816, population: 692000 },
  { name: 'Detroit', country: 'USA', lat: 42.3314, lng: -83.0458, population: 639000 },
  { name: 'Portland', country: 'USA', lat: 45.5152, lng: -122.6784, population: 654000 },
  { name: 'Memphis', country: 'USA', lat: 35.1495, lng: -90.049, population: 651000 },
  { name: 'Las Vegas', country: 'USA', lat: 36.1699, lng: -115.1398, population: 644000 },
  { name: 'Baltimore', country: 'USA', lat: 39.2904, lng: -76.6122, population: 586000 },
  { name: 'Milwaukee', country: 'USA', lat: 43.0389, lng: -87.9065, population: 577000 },
  { name: 'Albuquerque', country: 'USA', lat: 35.0844, lng: -106.6504, population: 562000 },
  { name: 'Tucson', country: 'USA', lat: 32.2226, lng: -110.9747, population: 548000 },
  { name: 'Miami', country: 'USA', lat: 25.7617, lng: -80.1918, population: 467000 },
  { name: 'Atlanta', country: 'USA', lat: 33.749, lng: -84.388, population: 498000 },
  { name: 'Minneapolis', country: 'USA', lat: 44.9778, lng: -93.265, population: 429000 },
  { name: 'Cleveland', country: 'USA', lat: 41.4993, lng: -81.6944, population: 373000 },
  { name: 'New Orleans', country: 'USA', lat: 29.9511, lng: -90.0715, population: 391000 },
  { name: 'Tampa', country: 'USA', lat: 27.9506, lng: -82.4572, population: 399000 },
  { name: 'Pittsburgh', country: 'USA', lat: 40.4406, lng: -79.9959, population: 302000 },
  { name: 'Cincinnati', country: 'USA', lat: 39.1031, lng: -84.512, population: 309000 },
  { name: 'Kansas City', country: 'USA', lat: 39.0997, lng: -94.5786, population: 508000 },
  { name: 'St Louis', country: 'USA', lat: 38.627, lng: -90.1994, population: 302000 },
  { name: 'Salt Lake City', country: 'USA', lat: 40.7608, lng: -111.891, population: 200000 },

  // Canada
  { name: 'Toronto', country: 'Canada', lat: 43.6532, lng: -79.3832, population: 2930000 },
  { name: 'Montreal', country: 'Canada', lat: 45.5017, lng: -73.5673, population: 1780000 },
  { name: 'Vancouver', country: 'Canada', lat: 49.2827, lng: -123.1207, population: 675000 },
  { name: 'Calgary', country: 'Canada', lat: 51.0447, lng: -114.0719, population: 1336000 },
  { name: 'Edmonton', country: 'Canada', lat: 53.5461, lng: -113.4938, population: 1010000 },
  { name: 'Ottawa', country: 'Canada', lat: 45.4215, lng: -75.6972, population: 1017000 },
  { name: 'Winnipeg', country: 'Canada', lat: 49.8951, lng: -97.1384, population: 749000 },
  { name: 'Quebec City', country: 'Canada', lat: 46.8139, lng: -71.208, population: 542000 },

  // Mexico
  { name: 'Mexico City', country: 'Mexico', lat: 19.4326, lng: -99.1332, population: 21900000 },
  { name: 'Guadalajara', country: 'Mexico', lat: 20.6597, lng: -103.3496, population: 5268000 },
  { name: 'Monterrey', country: 'Mexico', lat: 25.6866, lng: -100.3161, population: 5119000 },
  { name: 'Puebla', country: 'Mexico', lat: 19.0414, lng: -98.2063, population: 3199000 },
  { name: 'Tijuana', country: 'Mexico', lat: 32.5149, lng: -117.0382, population: 2157000 },
  { name: 'Leon', country: 'Mexico', lat: 21.1221, lng: -101.6859, population: 1721000 },

  // ═══════════════════════════════════════════════════════════════════════════
  // South America (30 cities)
  // ═══════════════════════════════════════════════════════════════════════════

  // Brazil
  { name: 'São Paulo', country: 'Brazil', lat: -23.5505, lng: -46.6333, population: 22400000 },
  { name: 'Rio de Janeiro', country: 'Brazil', lat: -22.9068, lng: -43.1729, population: 13500000 },
  { name: 'Brasilia', country: 'Brazil', lat: -15.7942, lng: -47.8822, population: 4803000 },
  { name: 'Salvador', country: 'Brazil', lat: -12.9714, lng: -38.5014, population: 4018000 },
  { name: 'Fortaleza', country: 'Brazil', lat: -3.7172, lng: -38.5433, population: 4055000 },
  { name: 'Belo Horizonte', country: 'Brazil', lat: -19.9191, lng: -43.9386, population: 5110000 },
  { name: 'Manaus', country: 'Brazil', lat: -3.1019, lng: -60.025, population: 2220000 },
  { name: 'Curitiba', country: 'Brazil', lat: -25.4284, lng: -49.2733, population: 3615000 },
  { name: 'Recife', country: 'Brazil', lat: -8.0476, lng: -34.877, population: 4078000 },
  { name: 'Porto Alegre', country: 'Brazil', lat: -30.0346, lng: -51.2177, population: 4272000 },

  // Argentina
  {
    name: 'Buenos Aires',
    country: 'Argentina',
    lat: -34.6037,
    lng: -58.3816,
    population: 15000000,
  },
  { name: 'Cordoba', country: 'Argentina', lat: -31.4201, lng: -64.1888, population: 1613000 },
  { name: 'Rosario', country: 'Argentina', lat: -32.9442, lng: -60.6505, population: 1350000 },
  { name: 'Mendoza', country: 'Argentina', lat: -32.8895, lng: -68.8458, population: 1000000 },

  // Colombia
  { name: 'Bogotá', country: 'Colombia', lat: 4.711, lng: -74.0721, population: 10700000 },
  { name: 'Medellin', country: 'Colombia', lat: 6.2518, lng: -75.5636, population: 4020000 },
  { name: 'Cali', country: 'Colombia', lat: 3.4516, lng: -76.532, population: 2880000 },
  { name: 'Barranquilla', country: 'Colombia', lat: 10.9639, lng: -74.7964, population: 2370000 },

  // Peru
  { name: 'Lima', country: 'Peru', lat: -12.0464, lng: -77.0428, population: 11100000 },
  { name: 'Arequipa', country: 'Peru', lat: -16.409, lng: -71.5375, population: 1080000 },

  // Chile
  { name: 'Santiago', country: 'Chile', lat: -33.4489, lng: -70.6693, population: 6680000 },
  { name: 'Valparaiso', country: 'Chile', lat: -33.0472, lng: -71.6127, population: 980000 },

  // Venezuela
  { name: 'Caracas', country: 'Venezuela', lat: 10.4806, lng: -66.9036, population: 2940000 },
  { name: 'Maracaibo', country: 'Venezuela', lat: 10.6427, lng: -71.6125, population: 2220000 },

  // Ecuador
  { name: 'Quito', country: 'Ecuador', lat: -0.1807, lng: -78.4678, population: 2780000 },
  { name: 'Guayaquil', country: 'Ecuador', lat: -2.1894, lng: -79.8891, population: 2890000 },

  // Other
  { name: 'Montevideo', country: 'Uruguay', lat: -34.9011, lng: -56.1645, population: 1870000 },
  { name: 'Asuncion', country: 'Paraguay', lat: -25.2637, lng: -57.5759, population: 2970000 },
  { name: 'La Paz', country: 'Bolivia', lat: -16.5, lng: -68.15, population: 2000000 },

  // ═══════════════════════════════════════════════════════════════════════════
  // Europe (50 cities)
  // ═══════════════════════════════════════════════════════════════════════════

  // Western Europe
  { name: 'London', country: 'UK', lat: 51.5074, lng: -0.1278, population: 9000000 },
  { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, population: 11000000 },
  { name: 'Madrid', country: 'Spain', lat: 40.4168, lng: -3.7038, population: 6642000 },
  { name: 'Barcelona', country: 'Spain', lat: 41.3874, lng: 2.1686, population: 5575000 },
  { name: 'Rome', country: 'Italy', lat: 41.9028, lng: 12.4964, population: 4342000 },
  { name: 'Milan', country: 'Italy', lat: 45.4642, lng: 9.19, population: 3140000 },
  { name: 'Naples', country: 'Italy', lat: 40.8518, lng: 14.2681, population: 2180000 },
  { name: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405, population: 3645000 },
  { name: 'Munich', country: 'Germany', lat: 48.1351, lng: 11.582, population: 1472000 },
  { name: 'Hamburg', country: 'Germany', lat: 53.5511, lng: 9.9937, population: 1899000 },
  { name: 'Frankfurt', country: 'Germany', lat: 50.1109, lng: 8.6821, population: 753000 },
  { name: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lng: 4.9041, population: 872000 },
  { name: 'Brussels', country: 'Belgium', lat: 50.8503, lng: 4.3517, population: 1209000 },
  { name: 'Lisbon', country: 'Portugal', lat: 38.7223, lng: -9.1393, population: 2900000 },
  { name: 'Vienna', country: 'Austria', lat: 48.2082, lng: 16.3738, population: 1897000 },
  { name: 'Zurich', country: 'Switzerland', lat: 47.3769, lng: 8.5417, population: 434000 },
  { name: 'Geneva', country: 'Switzerland', lat: 46.2044, lng: 6.1432, population: 500000 },

  // Northern Europe
  { name: 'Stockholm', country: 'Sweden', lat: 59.3293, lng: 18.0686, population: 975000 },
  { name: 'Copenhagen', country: 'Denmark', lat: 55.6761, lng: 12.5683, population: 1336000 },
  { name: 'Oslo', country: 'Norway', lat: 59.9139, lng: 10.7522, population: 698000 },
  { name: 'Helsinki', country: 'Finland', lat: 60.1699, lng: 24.9384, population: 656000 },
  { name: 'Dublin', country: 'Ireland', lat: 53.3498, lng: -6.2603, population: 1388000 },

  // Eastern Europe
  { name: 'Moscow', country: 'Russia', lat: 55.7558, lng: 37.6173, population: 12500000 },
  { name: 'St Petersburg', country: 'Russia', lat: 59.9343, lng: 30.3351, population: 5380000 },
  { name: 'Warsaw', country: 'Poland', lat: 52.2297, lng: 21.0122, population: 1790000 },
  { name: 'Krakow', country: 'Poland', lat: 50.0647, lng: 19.945, population: 780000 },
  { name: 'Prague', country: 'Czechia', lat: 50.0755, lng: 14.4378, population: 1309000 },
  { name: 'Budapest', country: 'Hungary', lat: 47.4979, lng: 19.0402, population: 1756000 },
  { name: 'Bucharest', country: 'Romania', lat: 44.4268, lng: 26.1025, population: 2130000 },
  { name: 'Sofia', country: 'Bulgaria', lat: 42.6977, lng: 23.3219, population: 1268000 },
  { name: 'Belgrade', country: 'Serbia', lat: 44.7866, lng: 20.4489, population: 1375000 },
  { name: 'Zagreb', country: 'Croatia', lat: 45.815, lng: 15.9819, population: 804000 },

  // Southern Europe / Mediterranean
  { name: 'Athens', country: 'Greece', lat: 37.9838, lng: 23.7275, population: 3154000 },
  { name: 'Istanbul', country: 'Turkey', lat: 41.0082, lng: 28.9784, population: 15460000 },
  { name: 'Ankara', country: 'Turkey', lat: 39.9334, lng: 32.8597, population: 5663000 },
  { name: 'Valencia', country: 'Spain', lat: 39.4699, lng: -0.3763, population: 1600000 },
  { name: 'Seville', country: 'Spain', lat: 37.3891, lng: -5.9845, population: 1100000 },

  // ═══════════════════════════════════════════════════════════════════════════
  // Africa (20 cities)
  // ═══════════════════════════════════════════════════════════════════════════

  { name: 'Cairo', country: 'Egypt', lat: 30.0444, lng: 31.2357, population: 21300000 },
  { name: 'Lagos', country: 'Nigeria', lat: 6.5244, lng: 3.3792, population: 15400000 },
  { name: 'Kinshasa', country: 'DRC', lat: -4.4419, lng: 15.2663, population: 14970000 },
  {
    name: 'Johannesburg',
    country: 'South Africa',
    lat: -26.2041,
    lng: 28.0473,
    population: 5783000,
  },
  { name: 'Cape Town', country: 'South Africa', lat: -33.9249, lng: 18.4241, population: 4618000 },
  { name: 'Durban', country: 'South Africa', lat: -29.8587, lng: 31.0218, population: 3720000 },
  { name: 'Nairobi', country: 'Kenya', lat: -1.2921, lng: 36.8219, population: 4920000 },
  { name: 'Casablanca', country: 'Morocco', lat: 33.5731, lng: -7.5898, population: 3710000 },
  { name: 'Algiers', country: 'Algeria', lat: 36.7538, lng: 3.0588, population: 3335000 },
  { name: 'Addis Ababa', country: 'Ethiopia', lat: 9.0054, lng: 38.7636, population: 5006000 },
  { name: 'Dar es Salaam', country: 'Tanzania', lat: -6.7924, lng: 39.2083, population: 6702000 },
  { name: 'Accra', country: 'Ghana', lat: 5.6037, lng: -0.187, population: 4200000 },
  { name: 'Abidjan', country: 'Ivory Coast', lat: 5.3097, lng: -4.0127, population: 5200000 },
  { name: 'Khartoum', country: 'Sudan', lat: 15.5007, lng: 32.5599, population: 5829000 },
  { name: 'Alexandria', country: 'Egypt', lat: 31.2001, lng: 29.9187, population: 5200000 },
  { name: 'Tunis', country: 'Tunisia', lat: 36.8065, lng: 10.1815, population: 2790000 },
  { name: 'Dakar', country: 'Senegal', lat: 14.7167, lng: -17.4677, population: 3938000 },
  { name: 'Kampala', country: 'Uganda', lat: 0.3476, lng: 32.5825, population: 3470000 },
  { name: 'Lusaka', country: 'Zambia', lat: -15.3875, lng: 28.3228, population: 2906000 },
  { name: 'Harare', country: 'Zimbabwe', lat: -17.8252, lng: 31.0335, population: 2123000 },

  // ═══════════════════════════════════════════════════════════════════════════
  // Asia (25 cities - limited Macrostrat coverage)
  // ═══════════════════════════════════════════════════════════════════════════

  // East Asia
  { name: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503, population: 37400000 },
  { name: 'Osaka', country: 'Japan', lat: 34.6937, lng: 135.5023, population: 19300000 },
  { name: 'Seoul', country: 'South Korea', lat: 37.5665, lng: 126.978, population: 9776000 },
  { name: 'Beijing', country: 'China', lat: 39.9042, lng: 116.4074, population: 21540000 },
  { name: 'Shanghai', country: 'China', lat: 31.2304, lng: 121.4737, population: 27060000 },
  { name: 'Hong Kong', country: 'China', lat: 22.3193, lng: 114.1694, population: 7500000 },
  { name: 'Taipei', country: 'Taiwan', lat: 25.033, lng: 121.5654, population: 2646000 },

  // Southeast Asia
  { name: 'Manila', country: 'Philippines', lat: 14.5995, lng: 120.9842, population: 13920000 },
  { name: 'Bangkok', country: 'Thailand', lat: 13.7563, lng: 100.5018, population: 10539000 },
  { name: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198, population: 5686000 },
  { name: 'Jakarta', country: 'Indonesia', lat: -6.2088, lng: 106.8456, population: 34540000 },
  { name: 'Kuala Lumpur', country: 'Malaysia', lat: 3.139, lng: 101.6869, population: 8285000 },
  {
    name: 'Ho Chi Minh City',
    country: 'Vietnam',
    lat: 10.8231,
    lng: 106.6297,
    population: 9050000,
  },
  { name: 'Hanoi', country: 'Vietnam', lat: 21.0278, lng: 105.8342, population: 8054000 },

  // South Asia
  { name: 'Mumbai', country: 'India', lat: 19.076, lng: 72.8777, population: 20411000 },
  { name: 'Delhi', country: 'India', lat: 28.6139, lng: 77.209, population: 31181000 },
  { name: 'Bangalore', country: 'India', lat: 12.9716, lng: 77.5946, population: 12327000 },
  { name: 'Kolkata', country: 'India', lat: 22.5726, lng: 88.3639, population: 14850000 },
  { name: 'Chennai', country: 'India', lat: 13.0827, lng: 80.2707, population: 11235000 },
  { name: 'Karachi', country: 'Pakistan', lat: 24.8607, lng: 67.0011, population: 16094000 },
  { name: 'Lahore', country: 'Pakistan', lat: 31.5204, lng: 74.3587, population: 12642000 },
  { name: 'Dhaka', country: 'Bangladesh', lat: 23.8103, lng: 90.4125, population: 21741000 },

  // Middle East
  { name: 'Dubai', country: 'UAE', lat: 25.2048, lng: 55.2708, population: 3478000 },
  { name: 'Tel Aviv', country: 'Israel', lat: 32.0853, lng: 34.7818, population: 4150000 },
  { name: 'Tehran', country: 'Iran', lat: 35.6892, lng: 51.389, population: 9135000 },

  // ═══════════════════════════════════════════════════════════════════════════
  // Oceania (10 cities)
  // ═══════════════════════════════════════════════════════════════════════════

  { name: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093, population: 5312000 },
  { name: 'Melbourne', country: 'Australia', lat: -37.8136, lng: 144.9631, population: 5078000 },
  { name: 'Brisbane', country: 'Australia', lat: -27.4698, lng: 153.0251, population: 2514000 },
  { name: 'Perth', country: 'Australia', lat: -31.9505, lng: 115.8605, population: 2085000 },
  { name: 'Adelaide', country: 'Australia', lat: -34.9285, lng: 138.6007, population: 1359000 },
  { name: 'Auckland', country: 'New Zealand', lat: -36.8509, lng: 174.7645, population: 1657000 },
  { name: 'Wellington', country: 'New Zealand', lat: -41.2865, lng: 174.7762, population: 418000 },
  { name: 'Gold Coast', country: 'Australia', lat: -28.0167, lng: 153.4, population: 679000 },
  { name: 'Canberra', country: 'Australia', lat: -35.2809, lng: 149.13, population: 453000 },
  { name: 'Hobart', country: 'Australia', lat: -42.8821, lng: 147.3272, population: 232000 },
];

/**
 * Get cities sorted by population (descending)
 */
export function getCitiesByPopulation(limit?: number): City[] {
  const sorted = [...CITIES].sort((a, b) => b.population - a.population);
  return limit ? sorted.slice(0, limit) : sorted;
}

/**
 * Get cities in a specific region
 */
export function getCitiesByRegion(
  region: 'north_america' | 'south_america' | 'europe' | 'africa' | 'asia' | 'oceania'
): City[] {
  const regionCountries: Record<string, string[]> = {
    north_america: ['USA', 'Canada', 'Mexico'],
    south_america: [
      'Brazil',
      'Argentina',
      'Colombia',
      'Peru',
      'Chile',
      'Venezuela',
      'Ecuador',
      'Uruguay',
      'Paraguay',
      'Bolivia',
    ],
    europe: [
      'UK',
      'France',
      'Spain',
      'Italy',
      'Germany',
      'Netherlands',
      'Belgium',
      'Portugal',
      'Austria',
      'Switzerland',
      'Sweden',
      'Denmark',
      'Norway',
      'Finland',
      'Ireland',
      'Russia',
      'Poland',
      'Czechia',
      'Hungary',
      'Romania',
      'Bulgaria',
      'Serbia',
      'Croatia',
      'Greece',
      'Turkey',
    ],
    africa: [
      'Egypt',
      'Nigeria',
      'DRC',
      'South Africa',
      'Kenya',
      'Morocco',
      'Algeria',
      'Ethiopia',
      'Tanzania',
      'Ghana',
      'Ivory Coast',
      'Sudan',
      'Tunisia',
      'Senegal',
      'Uganda',
      'Zambia',
      'Zimbabwe',
    ],
    asia: [
      'Japan',
      'South Korea',
      'China',
      'Taiwan',
      'Philippines',
      'Thailand',
      'Singapore',
      'Indonesia',
      'Malaysia',
      'Vietnam',
      'India',
      'Pakistan',
      'Bangladesh',
      'UAE',
      'Israel',
      'Iran',
    ],
    oceania: ['Australia', 'New Zealand'],
  };

  return CITIES.filter((city) => regionCountries[region]?.includes(city.country));
}
