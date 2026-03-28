import { Injectable } from '@nestjs/common';

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const BASE32_MAP: Record<string, number> = {};
BASE32.split('').forEach((char, idx) => {
  BASE32_MAP[char] = idx;
});

@Injectable()
export class GeohashService {
  private readonly precision = 6;

  encode(lat: number, lng: number, precision: number = this.precision): string {
    let latRange = { min: -90, max: 90 };
    let lngRange = { min: -180, max: 180 };
    let hash = '';
    let bit = 0;
    let ch = 0;
    let isLng = true;

    while (hash.length < precision) {
      if (isLng) {
        const mid = (lngRange.min + lngRange.max) / 2;
        if (lng >= mid) {
          ch |= 1 << (4 - bit);
          lngRange.min = mid;
        } else {
          lngRange.max = mid;
        }
      } else {
        const mid = (latRange.min + latRange.max) / 2;
        if (lat >= mid) {
          ch |= 1 << (4 - bit);
          latRange.min = mid;
        } else {
          latRange.max = mid;
        }
      }
      isLng = !isLng;
      bit++;
      if (bit === 5) {
        hash += BASE32[ch];
        bit = 0;
        ch = 0;
      }
    }
    return hash;
  }

  decode(hash: string): { latitude: number; longitude: number } {
    let latRange = { min: -90, max: 90 };
    let lngRange = { min: -180, max: 180 };
    let isLng = true;

    for (const char of hash) {
      const idx = BASE32_MAP[char];
      if (idx === undefined) continue;
      for (let bit = 4; bit >= 0; bit--) {
        const bitValue = (idx >> bit) & 1;
        if (isLng) {
          const mid = (lngRange.min + lngRange.max) / 2;
          if (bitValue === 1) {
            lngRange.min = mid;
          } else {
            lngRange.max = mid;
          }
        } else {
          const mid = (latRange.min + latRange.max) / 2;
          if (bitValue === 1) {
            latRange.min = mid;
          } else {
            latRange.max = mid;
          }
        }
        isLng = !isLng;
      }
    }

    return {
      latitude: (latRange.min + latRange.max) / 2,
      longitude: (lngRange.min + lngRange.max) / 2,
    };
  }

  getNeighbors(hash: string): string[] {
    const { latitude, longitude } = this.decode(hash);
    const latDelta = 180 / Math.pow(32, Math.ceil(hash.length / 2));
    const lngDelta = 360 / Math.pow(32, Math.floor(hash.length / 2));

    const neighbors: string[] = [];
    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLng = -1; dLng <= 1; dLng++) {
        if (dLat === 0 && dLng === 0) continue;
        const nLat = latitude + dLat * latDelta;
        const nLng = longitude + dLng * lngDelta;
        if (nLat >= -90 && nLat <= 90 && nLng >= -180 && nLng <= 180) {
          neighbors.push(this.encode(nLat, nLng, hash.length));
        }
      }
    }
    return neighbors;
  }

  getNeighbor(hash: string, direction: 'n' | 's' | 'e' | 'w'): string | null {
    const { latitude, longitude } = this.decode(hash);
    const latDelta = 180 / Math.pow(32, Math.ceil(hash.length / 2));
    const lngDelta = 360 / Math.pow(32, Math.floor(hash.length / 2));

    let nLat = latitude;
    let nLng = longitude;

    switch (direction) {
      case 'n':
        nLat += latDelta;
        break;
      case 's':
        nLat -= latDelta;
        break;
      case 'e':
        nLng += lngDelta;
        break;
      case 'w':
        nLng -= lngDelta;
        break;
    }

    if (nLat < -90 || nLat > 90 || nLng < -180 || nLng > 180) {
      return null;
    }

    return this.encode(nLat, nLng, hash.length);
  }

  hilbertIndex(lat: number, lng: number): number {
    const x = ((lng + 180) / 360) * 100000;
    const y = ((lat + 90) / 180) * 100000;
    return Math.floor(x) * 65536 + Math.floor(y);
  }
}
