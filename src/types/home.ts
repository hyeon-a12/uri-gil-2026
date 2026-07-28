export interface RecentClip {
  id: string;
  location: string;
  duration: string;
  image: string;
}

export interface RecommendedPlace {
  id: string;
  title: string;
  subtitle: string;
  rating: number;
  price: number;
  duration: string;
  image: string;
}

export interface RouteMarker {
  id: string;
  label: number;
  x: string;
  y: string;
}

export interface TripRoute {
  title: string;
  subtitle: string;
  markers: RouteMarker[];
}
