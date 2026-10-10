const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

export const distanceMeters = (a, b) => {
    const dLat = rad(b.latitude - a.latitude);
    const dLng = rad(b.longitude - a.longitude);
    const h = Math.sin(dLat / 2) ** 2
        + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};

export const bearing = (a, b) => {
    const y = Math.sin(rad(b.longitude - a.longitude)) * Math.cos(rad(b.latitude));
    const x = Math.cos(rad(a.latitude)) * Math.sin(rad(b.latitude))
        - Math.sin(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.cos(rad(b.longitude - a.longitude));
    return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
};

const lerp = (a, b, t) => ({
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
});

/**
 * A road-ish dog-leg route from `from` to `to`, resampled to `count` points
 * evenly spaced by distance.
 */
export const buildRoute = (from, to, count = 30) => {
    const corners = [
        from,
        { latitude: from.latitude + (to.latitude - from.latitude) * 0.15, longitude: from.longitude + (to.longitude - from.longitude) * 0.55 },
        { latitude: from.latitude + (to.latitude - from.latitude) * 0.7, longitude: from.longitude + (to.longitude - from.longitude) * 0.75 },
        to,
    ];
    const segLengths = corners.slice(1).map((p, i) => distanceMeters(corners[i], p));
    const total = segLengths.reduce((s, d) => s + d, 0) || 1;

    const points = [];
    for (let i = 0; i < count; i += 1) {
        let target = (total * i) / (count - 1);
        let seg = 0;
        while (seg < segLengths.length - 1 && target > segLengths[seg]) {
            target -= segLengths[seg];
            seg += 1;
        }
        const t = segLengths[seg] ? Math.min(1, target / segLengths[seg]) : 0;
        const p = lerp(corners[seg], corners[seg + 1], t);
        points.push({ latitude: Number(p.latitude.toFixed(6)), longitude: Number(p.longitude.toFixed(6)) });
    }
    return points;
};

export const routeLength = (points) => points.slice(1).reduce((s, p, i) => s + distanceMeters(points[i], p), 0);
