/**
 * GeoDataProvider - React context provider for GeoDataService
 *
 * Provides the GeoDataService to the React component tree.
 * Handles initialization and cleanup of the service.
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { GeoDataService } from '../services/GeoDataService';
import { ExpoTileLoader } from '../services/ExpoTileLoader';

interface GeoDataContextValue {
  geoDataService: GeoDataService | null;
  isLoading: boolean;
  error: Error | null;
}

const GeoDataContext = createContext<GeoDataContextValue>({
  geoDataService: null,
  isLoading: true,
  error: null,
});

interface GeoDataProviderProps {
  children: ReactNode;
}

/**
 * Provider component that creates and initializes the GeoDataService
 */
export function GeoDataProvider({ children }: GeoDataProviderProps) {
  const [geoDataService, setGeoDataService] = useState<GeoDataService | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    let service: GeoDataService | null = null;

    async function initialize() {
      try {
        const tileLoader = new ExpoTileLoader();
        service = new GeoDataService({ tileLoader });
        await service.initialize();

        if (mounted) {
          setGeoDataService(service);
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to initialize GeoDataService'));
          setIsLoading(false);
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
      if (service) {
        service.close();
      }
    };
  }, []);

  return (
    <GeoDataContext.Provider value={{ geoDataService, isLoading, error }}>
      {children}
    </GeoDataContext.Provider>
  );
}

/**
 * Hook to access the GeoDataService from context
 */
export function useGeoDataService(): GeoDataService {
  const { geoDataService, isLoading, error } = useContext(GeoDataContext);

  if (error) {
    throw error;
  }

  if (isLoading || !geoDataService) {
    throw new Error('GeoDataService not yet initialized. Make sure GeoDataProvider is mounted.');
  }

  return geoDataService;
}

/**
 * Hook to access the GeoDataService with loading state
 */
export function useGeoData(): GeoDataContextValue {
  return useContext(GeoDataContext);
}
