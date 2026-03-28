declare module 'ngeohash' {
  export function encode(longitude: number, latitude: number, precision?: number): string;
  export function decode(hash: string): { latitude: number; longitude: number };
  export function decode_bbox(hash: string): [number, number, number, number];
  export function bboxes(minLat: number, minLon: number, maxLat: number, maxLon: number, precision?: number): string[];
  export function neighbor(hash: string, direction: [number, number]): string;
  export function neighbors(hash: string): string[];
}