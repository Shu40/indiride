import { create } from 'zustand';
import { PlaceSuggestion, VehicleFareEstimate, RideBooking, VehicleCategory } from '../types';

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
}

interface RideState {
  pickup: LocationPoint | null;
  destination: LocationPoint | null;
  selectedCategory: VehicleCategory;
  estimates: VehicleFareEstimate[];
  routeGeometry: [number, number][];
  distanceKm: number;
  durationMins: number;

  activeBooking: RideBooking | null;
  driverLocation: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    pickupEtaMins?: number;
    isStale?: boolean;
    lastUpdatedAt?: string;
  } | null;
  driverToPickupRoute: [number, number][];
  isSearching: boolean;
  searchRadiusKm: number;

  setPickup: (point: LocationPoint | null) => void;
  setDestination: (point: LocationPoint | null) => void;
  swapLocations: () => void;
  setSelectedCategory: (category: VehicleCategory) => void;
  setFareEstimates: (estimates: VehicleFareEstimate[], distanceKm: number, durationMins: number, geometry?: [number, number][]) => void;
  setDriverToPickupRoute: (route: [number, number][]) => void;
  setActiveBooking: (booking: RideBooking | null) => void;
  updateBookingStatus: (status: any) => void;
  updateDriverLocation: (
    lat: number,
    lng: number,
    heading?: number,
    speed?: number,
    pickupEtaMins?: number,
    isStale?: boolean,
    lastUpdatedAt?: string
  ) => void;
  setDriverOffline: (isOffline: boolean) => void;
  resetBooking: () => void;
}

export const useRideStore = create<RideState>((set, get) => ({
  pickup: null,
  destination: null,
  selectedCategory: 'bike',
  estimates: [],
  routeGeometry: [],
  distanceKm: 0,
  durationMins: 0,

  activeBooking: null,
  driverLocation: null,
  driverToPickupRoute: [],
  isSearching: false,
  searchRadiusKm: 2.0,

  setPickup: (pickup) => set({ pickup }),
  setDestination: (destination) => set({ destination }),

  swapLocations: () => {
    const { pickup, destination } = get();
    set({ pickup: destination, destination: pickup });
  },

  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),

  setFareEstimates: (estimates, distanceKm, durationMins, geometry) =>
    set({
      estimates,
      distanceKm,
      durationMins,
      routeGeometry: geometry || [],
    }),

  setDriverToPickupRoute: (driverToPickupRoute) => set({ driverToPickupRoute }),

  setActiveBooking: (activeBooking) => {
    const isSearching = activeBooking
      ? ['SEARCHING_FOR_RIDER', 'REQUESTS_SENT', 'EXPANDING_SEARCH'].includes(activeBooking.status)
      : false;
    set({
      activeBooking,
      isSearching,
      searchRadiusKm: activeBooking?.current_search_radius_km || 2.0,
      driverToPickupRoute: activeBooking?.driver_to_pickup_route || get().driverToPickupRoute,
      driverLocation: activeBooking?.rider
        ? {
            latitude: activeBooking.rider.current_latitude || activeBooking.pickup_latitude,
            longitude: activeBooking.rider.current_longitude || activeBooking.pickup_longitude,
            heading: activeBooking.rider.heading || 0,
            speed: activeBooking.rider.speed || 0,
            pickupEtaMins: activeBooking.rider.pickup_eta_mins || activeBooking.pickup_eta_mins || 3,
            isStale: activeBooking.rider.is_stale || false,
            lastUpdatedAt: activeBooking.rider.last_location_update,
          }
        : null,
    });
  },

  updateBookingStatus: (status) => {
    const current = get().activeBooking;
    if (current) {
      set({
        activeBooking: { ...current, status },
        isSearching: ['SEARCHING_FOR_RIDER', 'REQUESTS_SENT', 'EXPANDING_SEARCH'].includes(status),
      });
    }
  },

  updateDriverLocation: (latitude, longitude, heading, speed, pickupEtaMins, isStale, lastUpdatedAt) => {
    const currentLoc = get().driverLocation;
    const currentBooking = get().activeBooking;
    set({
      driverLocation: {
        latitude,
        longitude,
        heading: heading !== undefined ? heading : currentLoc?.heading || 0,
        speed: speed !== undefined ? speed : currentLoc?.speed || 0,
        pickupEtaMins: pickupEtaMins !== undefined ? pickupEtaMins : currentLoc?.pickupEtaMins || 3,
        isStale: isStale !== undefined ? isStale : false,
        lastUpdatedAt: lastUpdatedAt || new Date().toISOString(),
      },
      activeBooking: currentBooking && currentBooking.rider ? {
        ...currentBooking,
        rider: {
          ...currentBooking.rider,
          current_latitude: latitude,
          current_longitude: longitude,
          pickup_eta_mins: pickupEtaMins !== undefined ? pickupEtaMins : currentBooking.rider.pickup_eta_mins,
          is_stale: isStale !== undefined ? isStale : false,
          last_location_update: lastUpdatedAt || new Date().toISOString(),
        }
      } : currentBooking,
    });
  },

  setDriverOffline: (isOffline: boolean) => {
    const currentLoc = get().driverLocation;
    if (currentLoc) {
      set({
        driverLocation: {
          ...currentLoc,
          isStale: isOffline,
        },
      });
    }
  },

  resetBooking: () =>
    set({
      pickup: null,
      destination: null,
      estimates: [],
      routeGeometry: [],
      driverToPickupRoute: [],
      distanceKm: 0,
      durationMins: 0,
      activeBooking: null,
      driverLocation: null,
      isSearching: false,
    }),
}));

