import { RecentClip, RecommendedPlace, TripRoute } from '../types/home';

export const mockRecentClips: RecentClip[] = [
  {
    id: '1',
    location: '협재해변',
    duration: '00:06',
    image: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?w=400',
  },
  {
    id: '2',
    location: '카페 이연',
    duration: '00:12',
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400',
  },
  {
    id: '3',
    location: '모슬포항',
    duration: '00:09',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
  },
];

export const mockRecommendedPlaces: RecommendedPlace[] = [
  {
    id: '1',
    title: 'Labengki Sombori',
    subtitle: 'Islands in Sulawesi',
    rating: 4.8,
    price: 250,
    duration: '3D2N',
    image: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=600',
  },
  {
    id: '2',
    title: 'Sailing Komodo',
    subtitle: 'Labuan Bajo',
    rating: 4.8,
    price: 200,
    duration: '3D2N',
    image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600',
  },
];

export const mockTripRoute: TripRoute = {
  title: '제주 서부 루트',
  subtitle: '2박 3일 · 영상 6개',
  markers: [
    { id: 'a', label: 1, x: '18%', y: '55%' },
    { id: 'b', label: 3, x: '52%', y: '28%' },
    { id: 'c', label: 3, x: '78%', y: '58%' },
  ],
};
